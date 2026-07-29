<script lang="ts">
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { CircleAlert, CircleCheck, Info, X } from '@lucide/svelte';
	import { dismissToast, toasts, type ToastItem, type ToastTone } from '$lib/toast';

	const dur = $derived(prefersReducedMotion.current ? 0 : 160);

	const icons = { success: CircleCheck, error: CircleAlert, info: Info } as const;
	const tints: Record<ToastTone, string> = {
		success: 'text-green-600 dark:text-green-400',
		error: 'text-red-600 dark:text-red-400',
		info: 'text-neutral-500 dark:text-neutral-400'
	};

	function act(t: ToastItem) {
		t.action?.fn();
		dismissToast(t.id);
	}
</script>

<!-- No aria-live here: toast() already pipes every message through announce(). -->
{#if $toasts.length > 0}
	<div class="fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col items-stretch gap-2">
		{#each $toasts as t (t.id)}
			{@const Icon = icons[t.tone]}
			<div
				transition:fly={{ y: 8, duration: dur }}
				class="hairline flex items-start gap-2.5 rounded-lg bg-white py-2.5 pr-1.5 pl-3 shadow-[var(--ot-shadow-float)] dark:bg-neutral-900"
			>
				<Icon size={15} class={`mt-px shrink-0 ${tints[t.tone]}`} aria-hidden="true" />
				<p class="min-w-0 flex-1 pt-px text-[13px] leading-snug text-neutral-800 dark:text-neutral-100">
					{t.msg}
				</p>
				{#if t.action}
					<button
						type="button"
						onclick={() => act(t)}
						class="focus-ring -my-0.5 shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-soft)]"
					>
						{t.action.label}
					</button>
				{/if}
				<button
					type="button"
					onclick={() => dismissToast(t.id)}
					aria-label="Dismiss"
					class="focus-ring -my-0.5 shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
				>
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>
{/if}
