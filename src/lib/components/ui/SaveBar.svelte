<script lang="ts">
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import Button from './Button.svelte';
	import { cn } from '$lib/utils/cn';

	// Sticky save bar rendered INSIDE the form it belongs to — Save submits the
	// wrapping form; the plain in-card submit stays as the no-JS fallback.
	type Props = {
		dirty: boolean;
		saving?: boolean;
		onDiscard: () => void;
		class?: string;
	};
	let { dirty, saving = false, onDiscard, class: klass }: Props = $props();

	const dur = $derived(prefersReducedMotion.current ? 0 : 160);
</script>

{#if dirty}
	<div
		role="status"
		class={cn('sticky bottom-0 z-20 pt-3 pb-1', klass)}
		transition:fly={{ y: 12, duration: dur }}
	>
		<div
			class="hairline flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-[var(--ot-shadow-float)] backdrop-blur dark:bg-neutral-900/90"
		>
			<span class="min-w-0 flex-1 truncate text-[13px] text-neutral-600 dark:text-neutral-300">
				Unsaved changes
			</span>
			<Button type="button" variant="ghost" size="sm" onclick={onDiscard}>Discard</Button>
			<Button type="submit" variant="primary" size="sm" loading={saving}>Save</Button>
		</div>
	</div>
{/if}
