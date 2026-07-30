import type { ShowcaseData } from '$lib/components/landing/mono/types';
import { getConfig } from '$lib/server/config';
import { buildRoadmapLanes } from '$lib/roadmap';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { getProjectHeartbeat } from '$lib/server/services/public';
import { listForWorkspace } from '$lib/server/services/projects';
import { getReleaseDetail, listReleases } from '$lib/server/services/releases';
import { listSuggestions } from '$lib/server/services/suggestions';
import { listBoardTickets } from '$lib/server/services/tickets';
import { listPublic } from '$lib/server/services/workspaces';
import { resolveVoter } from '$lib/server/util/anon';
import type { PageServerLoad } from './$types';

/** Sort helper: null/undefined sorts as "never" (oldest), not "now". */
function activityMs(t: Date | string | null): number {
	return t ? new Date(t).getTime() : -1;
}

export const load: PageServerLoad = async ({ locals, cookies, getClientAddress, depends }) => {
	const { site, legal } = await getConfig();
	const workspaces = await listPublic();

	// Directory items — same item-building shape as (public)/+page.server.ts, so the
	// clean projects directory at the foot of the page is REAL instance data.
	const items = await Promise.all(
		workspaces.map(async (ws) => {
			const projects = await listForWorkspace(null, ws, null);
			const withStats = await Promise.all(
				projects.map(async (p) => ({
					id: p.project.id,
					slug: p.project.slug,
					name: p.project.name,
					description: p.project.description,
					color: p.project.color,
					icon: p.project.icon,
					roadmapEnabled: p.project.roadmapEnabled,
					stats: await getProjectHeartbeat(p.project.id, true)
				}))
			);
			withStats.sort(
				(a, b) => activityMs(b.stats.lastActivityAt) - activityMs(a.stats.lastActivityAt)
			);
			const lastActivityAt = withStats.reduce<Date | string | null>(
				(latest, p) =>
					activityMs(p.stats.lastActivityAt) > activityMs(latest) ? p.stats.lastActivityAt : latest,
				null
			);
			return {
				slug: ws.slug,
				name: ws.name,
				description: ws.description,
				icon: ws.icon,
				color: ws.color,
				avatarUrl: ws.avatarUrl,
				lastActivityAt,
				projects: withStats
			};
		})
	);
	const visible = items
		.filter((w) => w.projects.length > 0)
		.sort((a, b) => activityMs(b.lastActivityAt) - activityMs(a.lastActivityAt));

	const allProjects = visible.flatMap((w) =>
		w.projects.map((p) => ({ ...p, wsSlug: w.slug, wsName: w.name }))
	);
	const totals = {
		projects: allProjects.length,
		open: allProjects.reduce((n, p) => n + p.stats.open, 0),
		shipped: allProjects.reduce((n, p) => n + p.stats.shipped, 0)
	};

	// The showcase is the busiest public project — the one with the most public
	// work to actually show — with freshest activity breaking ties. The live board
	// is this page's centrepiece, so it must be a full board, not a near-empty one
	// that a pure-recency pick would surface on a lightly-seeded instance.
	const pick =
		[...allProjects].sort((a, b) => {
			const contentA = a.stats.open + a.stats.shipped;
			const contentB = b.stats.open + b.stats.shipped;
			return (
				contentB - contentA ||
				activityMs(b.stats.lastActivityAt) - activityMs(a.stats.lastActivityAt)
			);
		})[0] ?? null;

	let showcase: ShowcaseData | null = null;
	if (pick && pick.stats.open + pick.stats.shipped > 0) {
		const boards = await listBoards(pick.id);
		const boardId = boards[0]?.id ?? null;
		if (boardId) {
			// Live board: this dep key is what the embedded board's SSE subscription
			// invalidates, re-running this loader so the columns below refresh in place.
			depends(`board:${boardId}`);
			const voter = resolveVoter(locals.user, cookies, getClientAddress);

			const [columns, tickets, sugg, published] = await Promise.all([
				getBoardColumns(boardId),
				listBoardTickets(boardId),
				listSuggestions(pick.id, { sort: 'top', status: 'all', publicOnly: true, voter }),
				listReleases(pick.id, { publishedOnly: true })
			]);
			const publicTickets = tickets.filter((t) => t.visibility !== 'private');
			const boardColumns = columns.map((c) => ({
				id: c.id,
				name: c.name,
				color: c.color,
				icon: c.icon,
				tickets: publicTickets.filter((t) => t.columnId === c.id)
			}));

			const lanes = pick.roadmapEnabled ? buildRoadmapLanes(columns, tickets, true) : [];

			const details = await Promise.all(published.slice(0, 3).map((r) => getReleaseDetail(r.id)));
			const releases = details.filter(Boolean).map((d) => ({
				id: d!.release.id,
				version: d!.release.version,
				name: d!.release.name,
				notes: d!.release.notes,
				releasedAt: d!.release.releasedAt,
				ticketCount: d!.tickets.length
			}));

			showcase = {
				wsSlug: pick.wsSlug,
				wsName: pick.wsName,
				slug: pick.slug,
				name: pick.name,
				description: pick.description,
				color: pick.color,
				icon: pick.icon,
				roadmapEnabled: pick.roadmapEnabled,
				boardId,
				ticketTotal: publicTickets.length,
				columns: boardColumns,
				suggestions: sugg.cards.slice(0, 6).map((c) => ({
					id: c.id,
					title: c.title,
					body: c.body,
					kind: c.kind,
					status: c.status,
					votes: c.votes,
					comments: c.comments,
					authorName: c.authorName,
					authorAvatar: c.authorAvatar,
					authorUsername: c.authorUsername,
					createdAt: c.createdAt,
					voted: sugg.votedIds.has(c.id)
				})),
				lanes,
				releases
			};
		}
	}

	// Directory payload — drop the internal ids/activity the directory doesn't render.
	const directory = visible.map((w) => ({
		slug: w.slug,
		name: w.name,
		description: w.description,
		icon: w.icon,
		color: w.color,
		avatarUrl: w.avatarUrl,
		projects: w.projects.map((p) => ({
			slug: p.slug,
			name: p.name,
			description: p.description,
			color: p.color,
			icon: p.icon,
			stats: { open: p.stats.open, shipped: p.stats.shipped, lastActivityAt: p.stats.lastActivityAt }
		}))
	}));

	return {
		site,
		totals,
		showcase,
		directory,
		signedIn: !!locals.user,
		cookie: legal.cookie
	};
};
