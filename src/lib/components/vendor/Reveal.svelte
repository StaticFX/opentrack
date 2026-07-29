<!--
	Reveal — FadeContent + AnimatedContent, vendored from Svelte Bits
	(https://sveltebits.xyz, github.com/DavidHDev/svelte-bits), merged into one component
	behind a mode prop ('fade' | 'rise').
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: gsap + ScrollTrigger replaced with IntersectionObserver + CSS keyframes
	(var(--ease-out-expo)); content renders fully visible in SSR/no-JS and only animates once
	mounted, intersecting the viewport, and prefers-reduced-motion does not match. Public
	pages only — internal surfaces never animate on load.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
		mode?: 'fade' | 'rise';
		delay?: number;
		duration?: number;
		distance?: number;
		threshold?: number;
		rootMargin?: string;
		class?: string;
	};

	let {
		children,
		mode = 'rise',
		delay = 0,
		duration = 0.5,
		distance = 14,
		threshold = 0.1,
		rootMargin = '0px',
		class: className = ''
	}: Props = $props();

	let el: HTMLDivElement | undefined = $state();
	let animating = $state(false);

	$effect(() => {
		if (!el || animating) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					animating = true;
					observer.disconnect();
				}
			},
			{ threshold, rootMargin }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div
	bind:this={el}
	class="reveal {className}"
	class:animating
	class:rise={mode === 'rise'}
	style:--reveal-distance="{distance}px"
	style:animation-delay="{delay}ms"
	style:animation-duration="{duration}s"
>
	{@render children?.()}
</div>

<style>
	.reveal.animating {
		animation-name: reveal-fade;
		animation-timing-function: var(--ease-out-expo);
		animation-fill-mode: both;
		will-change: transform, opacity;
	}
	.reveal.animating.rise {
		animation-name: reveal-rise;
	}
	@keyframes reveal-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes reveal-rise {
		from {
			opacity: 0;
			transform: translateY(var(--reveal-distance));
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	/* Belt-and-braces alongside the JS guard. */
	@media (prefers-reduced-motion: reduce) {
		.reveal.animating {
			animation: none;
		}
	}
</style>
