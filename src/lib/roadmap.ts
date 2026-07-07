// Pure roadmap-lane derivation, shared by the public roadmap page and its test.
// Client-safe (no server imports).

export interface RoadmapColumn {
	id: string;
	category: string;
	/** Explicit lane override; null/undefined → derived from category. */
	roadmapLane?: string | null;
	icon?: string | null;
	color?: string;
}

/** The public roadmap lane a column falls into, honouring an explicit override. */
export function laneForColumn(col: RoadmapColumn): 'planned' | 'in_progress' | 'shipped' | 'hidden' {
	if (col.roadmapLane === 'planned' || col.roadmapLane === 'in_progress' || col.roadmapLane === 'shipped' || col.roadmapLane === 'hidden') {
		return col.roadmapLane;
	}
	switch (col.category) {
		case 'todo':
			return 'planned';
		case 'in_progress':
			return 'in_progress';
		case 'done':
			return 'shipped';
		default:
			// backlog, canceled, or anything unmapped stays off the roadmap.
			return 'hidden';
	}
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
	/** Icon + color of the first board column feeding this lane (for embeds). */
	icon?: string | null;
	color?: string;
}

/** The public roadmap lanes, in display order. Columns map onto them via
 *  `laneForColumn` (explicit override, else category default). */
const LANES = [
	{ key: 'planned', title: 'Planned' },
	{ key: 'in_progress', title: 'In Progress' },
	{ key: 'shipped', title: 'Shipped' }
] as const;

const SHIPPED_LIMIT = 30;

export function buildRoadmapLanes(
	columns: RoadmapColumn[],
	tickets: RoadmapTicketIn[],
	isPublic: boolean
): RoadmapLane[] {
	// Only tickets whose effective visibility resolves to public.
	const visible = tickets.filter((t) => isPublic && t.visibility !== 'private');
	// Resolve each column to its roadmap lane once (override, else category default).
	const laneOf = new Map(columns.map((c) => [c.id, laneForColumn(c)]));
	const card = (t: RoadmapTicketIn): RoadmapCard => ({
		number: t.number,
		title: t.title,
		votes: t.votes,
		comments: t.comments,
		labels: t.labels
	});

	return LANES.map((lane) => {
		// The first board column feeding this lane supplies its icon+color.
		const repCol = columns.find((c) => laneForColumn(c) === lane.key);
		let items = visible.filter((t) => t.columnId != null && laneOf.get(t.columnId) === lane.key);
		if (lane.key === 'shipped') {
			// Most-recently shipped first; cap the changelog-ish tail.
			items = [...items].sort((a, b) => b.number - a.number).slice(0, SHIPPED_LIMIT);
		} else {
			// Surface what the community wants most.
			items = [...items].sort((a, b) => b.votes - a.votes || b.number - a.number);
		}
		return {
			key: lane.key,
			title: lane.title,
			count: items.length,
			items: items.map(card),
			icon: repCol?.icon ?? null,
			color: repCol?.color
		};
	});
}
