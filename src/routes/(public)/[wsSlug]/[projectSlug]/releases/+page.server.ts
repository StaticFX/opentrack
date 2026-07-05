import { getReleaseDetail, listReleases } from '$lib/server/services/releases';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const p = await parent();
	const published = await listReleases(p.project.id, { publishedOnly: true });
	const details = await Promise.all(published.map((r) => getReleaseDetail(r.id)));

	return {
		releases: details.filter(Boolean).map((d) => ({
			id: d!.release.id,
			version: d!.release.version,
			name: d!.release.name,
			notes: d!.release.notes,
			releasedAt: d!.release.releasedAt,
			links: d!.links.map((l) => ({ label: l.label, url: l.url, type: l.type })),
			tickets: d!.tickets
		}))
	};
};
