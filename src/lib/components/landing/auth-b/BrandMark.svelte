<!--
	BrandMark — the OT instrument tile above the auth card. On mount it
	"powers on": a quick glow flash settling into a slow ambient breathe,
	like an LED coming alive. Static (full glow, no animation) under
	prefers-reduced-motion.
-->
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();

	let booted = $state(false);

	$effect(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			booted = true;
			return;
		}
		const t = setTimeout(() => (booted = true), 260);
		return () => clearTimeout(t);
	});
</script>

<span
	class="brand-mark relative grid size-11 place-items-center rounded-2xl text-[13px] font-bold text-white {className}"
	class:booted
	style="background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, oklch(0.7 0.15 250)));"
>
	OT
</span>

<style>
	.brand-mark {
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--accent) 45%, transparent),
			0 6px 20px -8px var(--accent-glow);
		transform: scale(0.85);
		opacity: 0;
		filter: brightness(1.6) saturate(1.3);
		transition:
			transform 0.5s var(--ease-spring),
			opacity 0.4s var(--ease-out-expo),
			filter 0.6s var(--ease-out-expo);
	}
	.brand-mark.booted {
		transform: scale(1);
		opacity: 1;
		filter: brightness(1) saturate(1);
		animation: mark-breathe 3.6s ease-in-out 0.6s infinite;
	}
	@keyframes mark-breathe {
		0%,
		100% {
			box-shadow:
				0 0 0 1px color-mix(in oklab, var(--accent) 45%, transparent),
				0 6px 20px -8px var(--accent-glow);
		}
		50% {
			box-shadow:
				0 0 0 1px color-mix(in oklab, var(--accent) 60%, transparent),
				0 8px 28px -6px var(--accent-glow);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.brand-mark {
			transform: none;
			opacity: 1;
			filter: none;
			transition: none;
		}
		.brand-mark.booted {
			animation: none;
		}
	}
</style>
