import { twMerge } from 'tailwind-merge';

/** Join conditional class names (falsy values dropped), resolving Tailwind
 * conflicts last-wins (`cn('p-2', 'p-4')` → `'p-4'`). */
export function cn(...parts: Array<string | false | null | undefined>): string {
	return twMerge(parts.filter(Boolean).join(' '));
}
