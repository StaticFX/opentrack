import { and, asc, desc, eq } from 'drizzle-orm';
import type { ReleaseLinkType, ReleaseStatus } from '$lib/constants';
import { db, schema } from '$lib/server/db';

export type Release = typeof schema.releases.$inferSelect;
export type ReleaseLink = typeof schema.releaseLinks.$inferSelect;

export function listReleases(projectId: string, opts: { publishedOnly?: boolean } = {}): Promise<Release[]> {
	const filters = [eq(schema.releases.projectId, projectId)];
	if (opts.publishedOnly) filters.push(eq(schema.releases.status, 'published'));
	return db
		.select()
		.from(schema.releases)
		.where(and(...filters))
		.orderBy(desc(schema.releases.releasedAt), desc(schema.releases.createdAt));
}

export interface ReleaseDetail {
	release: Release;
	links: ReleaseLink[];
	tickets: Array<{ id: string; number: number; title: string }>;
}

export async function getReleaseDetail(id: string): Promise<ReleaseDetail | null> {
	const [release] = await db.select().from(schema.releases).where(eq(schema.releases.id, id)).limit(1);
	if (!release) return null;
	const [links, tickets] = await Promise.all([
		db
			.select()
			.from(schema.releaseLinks)
			.where(eq(schema.releaseLinks.releaseId, id))
			.orderBy(asc(schema.releaseLinks.label)),
		db
			.select({ id: schema.tickets.id, number: schema.tickets.number, title: schema.tickets.title })
			.from(schema.releaseTickets)
			.innerJoin(schema.tickets, eq(schema.releaseTickets.ticketId, schema.tickets.id))
			.where(eq(schema.releaseTickets.releaseId, id))
			.orderBy(asc(schema.tickets.number))
	]);
	return { release, links, tickets };
}

export interface CreateReleaseInput {
	version: string;
	name?: string;
	notes?: string;
	status?: ReleaseStatus;
}

export async function createRelease(projectId: string, input: CreateReleaseInput): Promise<string> {
	const [row] = await db
		.insert(schema.releases)
		.values({
			projectId,
			version: input.version,
			name: input.name ?? null,
			notes: input.notes ?? null,
			status: input.status ?? 'draft',
			releasedAt: input.status === 'published' ? new Date() : null
		})
		.returning({ id: schema.releases.id });
	return row.id;
}

export interface UpdateReleaseInput {
	version?: string;
	name?: string | null;
	notes?: string | null;
	status?: ReleaseStatus;
}

export async function updateRelease(id: string, patch: UpdateReleaseInput): Promise<void> {
	// Stamp releasedAt the first time it's published.
	let releasedAt: Date | undefined;
	if (patch.status === 'published') {
		const [cur] = await db
			.select({ releasedAt: schema.releases.releasedAt })
			.from(schema.releases)
			.where(eq(schema.releases.id, id))
			.limit(1);
		if (cur && !cur.releasedAt) releasedAt = new Date();
	}
	await db
		.update(schema.releases)
		.set({
			...(patch.version !== undefined ? { version: patch.version } : {}),
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.notes !== undefined ? { notes: patch.notes } : {}),
			...(patch.status !== undefined ? { status: patch.status } : {}),
			...(releasedAt ? { releasedAt } : {}),
			updatedAt: new Date()
		})
		.where(eq(schema.releases.id, id));
}

export async function deleteRelease(id: string): Promise<void> {
	await db.delete(schema.releases).where(eq(schema.releases.id, id));
}

export async function addLink(
	releaseId: string,
	input: { label: string; url: string; type: ReleaseLinkType }
): Promise<void> {
	await db.insert(schema.releaseLinks).values({ releaseId, label: input.label, url: input.url, type: input.type });
}

export async function removeLink(linkId: string): Promise<void> {
	await db.delete(schema.releaseLinks).where(eq(schema.releaseLinks.id, linkId));
}

/** Associate a ticket by its per-project number. */
export async function addTicketByNumber(releaseId: string, projectId: string, number: number): Promise<boolean> {
	const [t] = await db
		.select({ id: schema.tickets.id })
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, projectId), eq(schema.tickets.number, number)))
		.limit(1);
	if (!t) return false;
	await db.insert(schema.releaseTickets).values({ releaseId, ticketId: t.id }).onConflictDoNothing();
	return true;
}

export async function removeTicket(releaseId: string, ticketId: string): Promise<void> {
	await db
		.delete(schema.releaseTickets)
		.where(and(eq(schema.releaseTickets.releaseId, releaseId), eq(schema.releaseTickets.ticketId, ticketId)));
}
