import { and, asc, desc, eq, isNotNull, isNull, like, sql } from 'drizzle-orm';
import { CLOSED_CATEGORIES, PRIORITIES, type Priority } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { env } from '$lib/server/env';
import type { SessionUser } from '$lib/server/auth/session';
import { enqueueTicketPush } from '$lib/server/github/enqueue';
import { notifyIntegrations } from '$lib/server/integrations/notify';
import { boardEvent } from '$lib/server/realtime/board';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { addComment } from '$lib/server/services/comments';
import { logActivity } from '$lib/server/services/activity';
import { watch } from '$lib/server/services/notifications';
import { createTicket, getTicketDetail, updateTicket } from '$lib/server/services/tickets';
import { enqueueWorkflowEvent } from '$lib/server/services/workflow';
import type { McpContext } from './context';

/** JSON-Schema-ish tool descriptor understood by MCP clients. */
export interface McpTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: (ctx: McpContext, args: Record<string, unknown>) => Promise<unknown>;
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim();
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function requireActor(ctx: McpContext): SessionUser {
	if (!ctx.actor) throw new Error('This API key has no associated user account, so it cannot make changes.');
	return ctx.actor;
}

async function projectBySlug(workspaceId: string, slug: unknown) {
	const s = str(slug);
	if (!s) throw new Error('`project` (slug) is required.');
	const [p] = await db
		.select()
		.from(schema.projects)
		.where(and(eq(schema.projects.workspaceId, workspaceId), eq(schema.projects.slug, s)))
		.limit(1);
	if (!p) throw new Error(`No project with slug "${s}" in this workspace.`);
	return p;
}

async function ticketByNumber(projectId: string, number: unknown) {
	const n = Number(number);
	if (!Number.isInteger(n)) throw new Error('`number` must be an integer ticket number.');
	const [t] = await db
		.select()
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, projectId), eq(schema.tickets.number, n)))
		.limit(1);
	if (!t) throw new Error(`No ticket #${n} in that project.`);
	return t;
}

async function ticketUrl(workspaceId: string, projectSlug: string, number: number): Promise<string> {
	const [w] = await db.select({ slug: schema.workspaces.slug }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).limit(1);
	return `${env.origin}/${w?.slug ?? 'w'}/${projectSlug}/t/${number}`;
}

export const MCP_TOOLS: McpTool[] = [
	{
		name: 'list_projects',
		description: 'List the projects in this workspace (slug, name, description).',
		inputSchema: { type: 'object', properties: {} },
		handler: async (ctx) => {
			const rows = await db
				.select({ slug: schema.projects.slug, name: schema.projects.name, description: schema.projects.description })
				.from(schema.projects)
				.where(eq(schema.projects.workspaceId, ctx.workspaceId))
				.orderBy(asc(schema.projects.position));
			return { projects: rows };
		}
	},
	{
		name: 'list_tickets',
		description: 'List tickets in a project. Optionally filter by status (open/closed/all).',
		inputSchema: {
			type: 'object',
			properties: {
				project: { type: 'string', description: 'Project slug' },
				status: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Default: all' },
				limit: { type: 'number', description: 'Max results (1–200, default 50)' }
			},
			required: ['project']
		},
		handler: async (ctx, args) => {
			const p = await projectBySlug(ctx.workspaceId, args.project);
			const status = str(args.status) || 'all';
			const limit = clamp(Number(args.limit) || 50, 1, 200);
			const conds = [eq(schema.tickets.projectId, p.id)];
			if (status === 'open') conds.push(isNull(schema.tickets.closedAt));
			if (status === 'closed') conds.push(isNotNull(schema.tickets.closedAt));
			const rows = await db
				.select({
					number: schema.tickets.number,
					title: schema.tickets.title,
					priority: schema.tickets.priority,
					closedAt: schema.tickets.closedAt,
					column: schema.boardColumns.name
				})
				.from(schema.tickets)
				.leftJoin(schema.boardColumns, eq(schema.tickets.columnId, schema.boardColumns.id))
				.where(and(...conds))
				.orderBy(desc(schema.tickets.updatedAt))
				.limit(limit);
			return {
				project: p.slug,
				count: rows.length,
				tickets: rows.map((t) => ({
					number: t.number,
					title: t.title,
					priority: t.priority,
					status: t.closedAt ? 'closed' : 'open',
					column: t.column
				}))
			};
		}
	},
	{
		name: 'get_ticket',
		description: 'Get full detail for one ticket by project slug + ticket number.',
		inputSchema: {
			type: 'object',
			properties: {
				project: { type: 'string', description: 'Project slug' },
				number: { type: 'number', description: 'Ticket number' }
			},
			required: ['project', 'number']
		},
		handler: async (ctx, args) => {
			const p = await projectBySlug(ctx.workspaceId, args.project);
			const t = await ticketByNumber(p.id, args.number);
			const d = await getTicketDetail(t.id);
			if (!d) throw new Error('Ticket not found.');
			return {
				project: p.slug,
				number: d.number,
				title: d.title,
				description: d.description,
				status: d.closedAt ? 'closed' : 'open',
				priority: d.priority,
				author: d.authorName,
				assignees: d.assignees.map((a) => a.displayName),
				labels: d.labels.map((l) => l.name),
				createdAt: d.createdAt,
				url: await ticketUrl(ctx.workspaceId, p.slug, d.number)
			};
		}
	},
	{
		name: 'search_tickets',
		description: 'Search tickets across this workspace by title text.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Text to match in ticket titles' },
				limit: { type: 'number', description: 'Max results (1–50, default 20)' }
			},
			required: ['query']
		},
		handler: async (ctx, args) => {
			const q = str(args.query).toLowerCase();
			if (!q) throw new Error('`query` is required.');
			const limit = clamp(Number(args.limit) || 20, 1, 50);
			const rows = await db
				.select({
					number: schema.tickets.number,
					title: schema.tickets.title,
					project: schema.projects.slug,
					closedAt: schema.tickets.closedAt
				})
				.from(schema.tickets)
				.innerJoin(schema.projects, eq(schema.tickets.projectId, schema.projects.id))
				.where(and(eq(schema.projects.workspaceId, ctx.workspaceId), like(sql`lower(${schema.tickets.title})`, `%${q}%`)))
				.orderBy(desc(schema.tickets.updatedAt))
				.limit(limit);
			return {
				query: q,
				count: rows.length,
				results: rows.map((r) => ({ project: r.project, number: r.number, title: r.title, status: r.closedAt ? 'closed' : 'open' }))
			};
		}
	},
	{
		name: 'create_ticket',
		description: 'Create a ticket in a project. Fires the same automations as the app (GitHub sync, notifications, workflows).',
		inputSchema: {
			type: 'object',
			properties: {
				project: { type: 'string', description: 'Project slug' },
				title: { type: 'string' },
				description: { type: 'string' },
				priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'urgent'] }
			},
			required: ['project', 'title']
		},
		handler: async (ctx, args) => {
			const actor = requireActor(ctx);
			const p = await projectBySlug(ctx.workspaceId, args.project);
			const title = str(args.title);
			if (!title) throw new Error('`title` is required.');
			const priority = (PRIORITIES as readonly string[]).includes(str(args.priority))
				? (str(args.priority) as Priority)
				: 'none';
			const description = args.description != null ? str(args.description) : undefined;

			const [board] = await listBoards(p.id);
			if (!board) throw new Error('Project has no board to add tickets to.');
			const cols = await getBoardColumns(board.id);
			const col =
				cols.find((c) => c.category === 'backlog') ??
				cols.find((c) => c.category === 'todo') ??
				cols.find((c) => !CLOSED_CATEGORIES.includes(c.category as never)) ??
				cols[0];
			if (!col) throw new Error('Project board has no columns.');

			const ticket = await createTicket(actor, { projectId: p.id, boardId: board.id, columnId: col.id, title, description, priority });
			// Same side-effects as the board create endpoint.
			await boardEvent(board.id, 'ticket.created', { ticketId: ticket.id }, actor.id);
			await enqueueTicketPush(ticket.id, actor.id);
			await logActivity({ projectId: p.id, subjectType: 'ticket', subjectId: ticket.id, actorId: actor.id, type: 'ticket.created' });
			await watch('ticket', ticket.id, actor.id, 'author');
			await notifyIntegrations(p.id, 'ticket.created', 'ticket', ticket.id, { actor: actor.displayName, description });
			await enqueueWorkflowEvent(p.id, 'ticket.created', ticket.id);

			return { number: ticket.number, url: await ticketUrl(ctx.workspaceId, p.slug, ticket.number) };
		}
	},
	{
		name: 'update_ticket',
		description: 'Update a ticket’s title, description, and/or priority.',
		inputSchema: {
			type: 'object',
			properties: {
				project: { type: 'string', description: 'Project slug' },
				number: { type: 'number' },
				title: { type: 'string' },
				description: { type: 'string' },
				priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'urgent'] }
			},
			required: ['project', 'number']
		},
		handler: async (ctx, args) => {
			const actor = requireActor(ctx);
			const p = await projectBySlug(ctx.workspaceId, args.project);
			const t = await ticketByNumber(p.id, args.number);
			const patch: { title?: string; description?: string; priority?: Priority } = {};
			if (args.title != null) patch.title = str(args.title);
			if (args.description != null) patch.description = str(args.description);
			if (args.priority != null && (PRIORITIES as readonly string[]).includes(str(args.priority))) {
				patch.priority = str(args.priority) as Priority;
			}
			if (!Object.keys(patch).length) throw new Error('Nothing to update — provide title, description, and/or priority.');

			await updateTicket(t.id, patch);
			if (t.boardId) await boardEvent(t.boardId, 'ticket.updated', { ticketId: t.id }, actor.id);
			await enqueueTicketPush(t.id, actor.id);
			await logActivity({ projectId: p.id, subjectType: 'ticket', subjectId: t.id, actorId: actor.id, type: 'ticket.updated' });
			return { ok: true, number: t.number };
		}
	},
	{
		name: 'add_comment',
		description: 'Add a comment to a ticket.',
		inputSchema: {
			type: 'object',
			properties: {
				project: { type: 'string', description: 'Project slug' },
				number: { type: 'number' },
				body: { type: 'string' }
			},
			required: ['project', 'number', 'body']
		},
		handler: async (ctx, args) => {
			const actor = requireActor(ctx);
			const p = await projectBySlug(ctx.workspaceId, args.project);
			const t = await ticketByNumber(p.id, args.number);
			const body = str(args.body);
			if (!body) throw new Error('`body` is required.');
			await addComment('ticket', t.id, actor.id, body);
			if (t.boardId) await boardEvent(t.boardId, 'ticket.commented', { ticketId: t.id }, actor.id);
			await logActivity({ projectId: p.id, subjectType: 'ticket', subjectId: t.id, actorId: actor.id, type: 'ticket.commented' });
			await watch('ticket', t.id, actor.id, 'commented');
			return { ok: true };
		}
	}
];
