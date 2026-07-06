import { error, fail, redirect } from '@sveltejs/kit';
import type { ReleaseLinkType, ReleaseStatus } from '$lib/constants';
import { RELEASE_LINK_TYPES } from '$lib/constants';
import { canManageProject } from '$lib/server/permissions';
import { getBySlugs } from '$lib/server/services/projects';
import {
	addLink,
	addTicketByNumber,
	deleteRelease,
	generateChangelogDraft,
	getReleaseDetail,
	removeLink,
	removeTicket,
	updateRelease
} from '$lib/server/services/releases';
import type { Actions, PageServerLoad } from './$types';

async function requireManage(locals: App.Locals, wsSlug: string, projectSlug: string, releaseId: string) {
	const ctx = await getBySlugs(locals.user, wsSlug, projectSlug);
	if (!ctx || !canManageProject(ctx.level)) throw error(403, 'Not allowed');
	const detail = await getReleaseDetail(releaseId);
	if (!detail || detail.release.projectId !== ctx.project.id) throw error(404, 'Not found');
	return { ctx, detail };
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const p = await parent();
	if (!p.canManageProject) throw error(403, 'Maintainers only');
	const detail = await getReleaseDetail(params.id);
	if (!detail || detail.release.projectId !== p.project.id) throw error(404, 'Not found');
	return { detail };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const { ctx, detail } = await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		const form = await request.formData();
		const version = String(form.get('version') ?? '').trim();
		if (!version) return fail(400, { error: 'Version is required.' });
		const status = (String(form.get('status') ?? 'draft') === 'published' ? 'published' : 'draft') as ReleaseStatus;
		await updateRelease(params.id, {
			version,
			name: String(form.get('name') ?? '').trim() || null,
			notes: String(form.get('notes') ?? '').trim() || null,
			status
		});
		if (status === 'published' && detail.release.status !== 'published') {
			const { logActivity } = await import('$lib/server/services/activity');
			await logActivity({ projectId: ctx.project.id, subjectType: 'release', subjectId: params.id, actorId: locals.user?.id, type: 'release.published' });
			const { enqueueDiscordForSubject } = await import('$lib/server/discord/enqueue');
			await enqueueDiscordForSubject(ctx.project.id, 'release.published', 'release', params.id, {
				actor: locals.user?.displayName,
				description: String(form.get('notes') ?? '').trim() || undefined
			});
		}
		return { saved: true };
	},

	generateNotes: async ({ locals, params }) => {
		const { ctx } = await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		const draft = await generateChangelogDraft(ctx.project.id, params.id);
		return { draft, empty: draft === '' };
	},

	addLink: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		const form = await request.formData();
		const label = String(form.get('label') ?? '').trim();
		const url = String(form.get('url') ?? '').trim();
		const type = (RELEASE_LINK_TYPES.includes(String(form.get('type')) as ReleaseLinkType)
			? form.get('type')
			: 'external') as ReleaseLinkType;
		if (!label || !url) return fail(400, { error: 'Label and URL are required.' });
		await addLink(params.id, { label, url, type });
		return { saved: true };
	},

	removeLink: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		await removeLink(String((await request.formData()).get('linkId') ?? ''));
		return { saved: true };
	},

	addTicket: async ({ request, locals, params }) => {
		const { ctx } = await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		const number = Number((await request.formData()).get('number'));
		if (!number) return fail(400, { error: 'Enter a ticket number.' });
		const ok = await addTicketByNumber(params.id, ctx.project.id, number);
		if (!ok) return fail(404, { error: `No ticket #${number}.` });
		return { saved: true };
	},

	removeTicket: async ({ request, locals, params }) => {
		await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		await removeTicket(params.id, String((await request.formData()).get('ticketId') ?? ''));
		return { saved: true };
	},

	delete: async ({ locals, params }) => {
		await requireManage(locals, params.wsSlug, params.projectSlug, params.id);
		await deleteRelease(params.id);
		throw redirect(303, `/w/${params.wsSlug}/p/${params.projectSlug}/releases`);
	}
};
