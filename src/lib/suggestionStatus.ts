import type { SuggestionStatus } from '$lib/constants';

export const SUGGESTION_STATUS_META: Record<SuggestionStatus, { label: string; color: string }> = {
	open: { label: 'Open', color: '#6b7280' },
	accepted: { label: 'Accepted', color: '#22c55e' },
	declined: { label: 'Declined', color: '#ef4444' },
	duplicate: { label: 'Duplicate', color: '#9ca3af' },
	converted: { label: 'Converted', color: '#14b8a6' }
};
