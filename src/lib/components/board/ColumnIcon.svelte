<script lang="ts">
	import { COLUMN_ICONS } from '$lib/columnIcons';

	type Props = { icon?: string | null; color: string; size?: number };
	let { icon, color, size = 14 }: Props = $props();

	const Cmp = $derived(icon ? COLUMN_ICONS[icon] : undefined);
</script>

{#if Cmp}
	<Cmp {size} {color} />
{:else}
	<span
		class="inline-block rounded-full"
		style={`width:${size - 4}px;height:${size - 4}px;background:${color}`}
	></span>
{/if}
