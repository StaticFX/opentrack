import type { Priority } from '$lib/constants';

export const PRIORITY_META: Record<Priority, { label: string; color: string; rank: number }> = {
	none: { label: 'No priority', color: '#9ca3af', rank: 0 },
	low: { label: 'Low', color: '#64748b', rank: 1 },
	medium: { label: 'Medium', color: '#3b82f6', rank: 2 },
	high: { label: 'High', color: '#f59e0b', rank: 3 },
	urgent: { label: 'Urgent', color: '#ef4444', rank: 4 }
};
