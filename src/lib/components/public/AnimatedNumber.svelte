<script lang="ts">
	import { countUp } from '$lib/attachments/countUp';

	type Props = { value: number; class?: string };
	let { value, class: klass = '' }: Props = $props();
</script>

<!-- SSR emits the final value; the attachment replays it as a count-up on first view. -->
<span class={`font-mono tabular-nums ${klass}`} {@attach countUp(value)}>{value}</span>
