<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	// Mono empty state: a hairline-framed glyph over a Space Mono line — "nothing
	// here yet, and that's an invitation" in the document's own voice. No cards.
	type Props = {
		icon: Component<{ size?: number | string }>;
		title: string;
		body?: string;
		children?: Snippet;
	};
	let { icon: Icon, title, body, children }: Props = $props();
</script>

<div class="mx-auto max-w-md px-6 py-14 text-center">
	<p class="text-[11px] tracking-[0.2em] text-[var(--faint)] uppercase">// empty</p>
	<div class="mx-auto mt-4 grid size-12 place-items-center border border-[var(--rule)] text-[var(--faint)]">
		<Icon size={22} />
	</div>
	<p class="mono-display mt-4 text-lg text-[var(--text)]">{title}</p>
	{#if body}<p class="mt-1.5 text-[13px] leading-relaxed text-[var(--dim)]">{body}</p>{/if}
	{#if children}<div class="mt-4">{@render children()}</div>{/if}
</div>
