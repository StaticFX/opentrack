import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireTicketAccess, requireUser } from '$lib/server/access';
import { db, schema } from '$lib/server/db';
import { linkPr, unlinkPr } from '$lib/server/github/pr';
import { ACCESS } from '$lib/server/permissions';
import { boardEvent } from '$lib/server/realtime/board';
import type { RequestHandler } from './$types';

async function projectLinked(projectId: string): Promise<boolean> {
	const [p] = await db
		.select({ repo: schema.projects.githubRepo, inst: schema.projects.githubInstallationId })
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	return !!(p?.repo && p?.inst);
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals.user);
	const { boardId, projectId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	if (!(await projectLinked(projectId))) {
		throw error(400, 'This project is not linked to a GitHub repository');
	}
	const prNumber = Number((await request.json()).number);
	if (!Number.isInteger(prNumber) || prNumber <= 0) throw error(400, 'A valid PR number is required');

	const ok = await linkPr(params.id, prNumber);
	if (!ok) throw error(502, 'Could not fetch that pull request from GitHub');
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals.user);
	const { boardId } = await requireTicketAccess(locals.user, params.id, ACCESS.COLLABORATOR);
	await unlinkPr(params.id);
	if (boardId) await boardEvent(boardId, 'ticket.updated', { ticketId: params.id }, user.id);
	return json({ ok: true });
};
