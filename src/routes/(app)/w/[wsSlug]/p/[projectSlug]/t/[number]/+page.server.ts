import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { ACCESS } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

/**
 * Internal deep link to a ticket (used by in-app notifications). Members are
 * redirected onto the ticket's board with the ticket modal open; everyone else
 * (e.g. a logged-in public commenter) falls back to the read-only public page.
 */
export const load: PageServerLoad = async ({ parent, params }) => {
	const p = await parent();
	const number = Number(params.number);
	if (!Number.isFinite(number)) throw error(404, 'Not found');

	const [row] = await db
		.select({ id: schema.tickets.id, boardId: schema.tickets.boardId })
		.from(schema.tickets)
		.where(and(eq(schema.tickets.projectId, p.project.id), eq(schema.tickets.number, number)))
		.limit(1);
	if (!row) throw error(404, 'Not found');

	const ws = params.wsSlug;
	const proj = params.projectSlug;
	if (p.projectLevel >= ACCESS.VIEWER && row.boardId) {
		throw redirect(302, `/w/${ws}/p/${proj}/b/${row.boardId}?ticket=${row.id}`);
	}
	// Non-member (or a boardless ticket): send them to the public ticket page.
	throw redirect(302, `/${ws}/${proj}/t/${number}`);
};
