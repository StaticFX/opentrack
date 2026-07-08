import { Lightbulb, Bug } from '@lucide/svelte';
import type { SuggestionKind } from '$lib/constants';

/** Display metadata for a feedback item's kind (badge label, colour, icon). */
export const SUGGESTION_KIND_META: Record<
	SuggestionKind,
	{ label: string; color: string; icon: typeof Lightbulb }
> = {
	suggestion: { label: 'Suggestion', color: '#8b5cf6', icon: Lightbulb },
	bug: { label: 'Bug', color: '#f97316', icon: Bug }
};
