// Client-safe view types for the HIGH-CONTRAST MONO landing. Self-contained on
// purpose: it depends only on core lib types ($lib/board, $lib/roadmap), never on
// landing/p/*, so the mono landing stands alone when the old variant is removed.
// The loader's return is structurally identical to these shapes, so `data.*`
// assigns straight into the components below.
import type { TicketCard } from '$lib/board';
import type { RoadmapLane } from '$lib/roadmap';

export interface LandSuggestion {
	id: string;
	title: string;
	body: string | null;
	kind: string;
	status: string;
	votes: number;
	comments: number;
	authorName: string | null;
	authorAvatar: string | null;
	authorUsername: string | null;
	createdAt: Date;
	voted: boolean;
}

export interface LandBoardColumn {
	id: string;
	name: string;
	color: string;
	icon: string | null;
	tickets: TicketCard[];
}

export interface LandRelease {
	id: string;
	version: string;
	name: string | null;
	notes: string | null;
	releasedAt: Date | null;
	ticketCount: number;
}

export interface ShowcaseData {
	wsSlug: string;
	wsName: string;
	slug: string;
	name: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	roadmapEnabled: boolean;
	boardId: string;
	ticketTotal: number;
	columns: LandBoardColumn[];
	suggestions: LandSuggestion[];
	lanes: RoadmapLane[];
	releases: LandRelease[];
}

export interface DirectoryProject {
	slug: string;
	name: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	stats: { open: number; shipped: number; lastActivityAt: Date | string | null };
}

export interface DirectoryWorkspace {
	slug: string;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	avatarUrl: string | null;
	projects: DirectoryProject[];
}

export interface LandTotals {
	projects: number;
	open: number;
	shipped: number;
}
