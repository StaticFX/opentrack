// Pure roadmap-lane derivation, shared by the public roadmap page and its test.
// Client-safe (no server imports).

export interface RoadmapColumn {
	id: string;
	category: string;
}
export interface RoadmapTicketIn {
	number: number;
	title: string;
	votes: number;
	comments: number;
	labels: Array<{ id: string; name: string; color: string }>;
	columnId: string | null;
	visibility: string;
}
export interface RoadmapCard {
	number: number;
	title: string;
	votes: number;
	comments: number;
	labels: Array<{ id: string; name: string; color: string }>;
}
export interface RoadmapLane {
	key: string;
	title: string;
	count: number;
	items: RoadmapCard[];
}

/** Board-column categories that map onto each public roadmap lane. */
const LANES = [
	{ key: 'planned', title: 'Planned', categories: ['todo'] },
	{ key: 'in_progress', title: 'In Progress', categories: ['in_progress'] },
	{ key: 'shipped', title: 'Shipped', categories: ['done'] }
] as const;

const SHIPPED_LIMIT = 30;

export function buildRoadmapLanes(
	columns: RoadmapColumn[],
	tickets: RoadmapTicketIn[],
	isPublic: boolean
): RoadmapLane[] {
	// Only tickets whose effective visibility resolves to public.
	const visible = tickets.filter((t) => isPublic && t.visibility !== 'private');
	const catOf = new Map(columns.map((c) => [c.id, c.category]));
	const card = (t: RoadmapTicketIn): RoadmapCard => ({
		number: t.number,
		title: t.title,
		votes: t.votes,
		comments: t.comments,
		labels: t.labels
	});

	return LANES.map((lane) => {
		const cats = lane.categories as readonly string[];
		let items = visible.filter(
			(t) => t.columnId != null && cats.includes(catOf.get(t.columnId) ?? '')
		);
		if (lane.key === 'shipped') {
			// Most-recently shipped first; cap the changelog-ish tail.
			items = [...items].sort((a, b) => b.number - a.number).slice(0, SHIPPED_LIMIT);
		} else {
			// Surface what the community wants most.
			items = [...items].sort((a, b) => b.votes - a.votes || b.number - a.number);
		}
		return { key: lane.key, title: lane.title, count: items.length, items: items.map(card) };
	});
}
