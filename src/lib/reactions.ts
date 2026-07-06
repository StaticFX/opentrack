// Client-safe reaction config. A small fixed palette keeps the UI tidy and
// prevents arbitrary/abusive emoji.
export const REACTION_EMOJI = ['👍', '❤️', '🎉', '🚀', '👀', '😄'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export interface ReactionSummary {
	emoji: string;
	count: number;
	/** Whether the current user has added this reaction. */
	reacted: boolean;
}
