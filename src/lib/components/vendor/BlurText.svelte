<!--
	BlurText — vendored from Svelte Bits (https://sveltebits.xyz, github.com/DavidHDev/svelte-bits)
	Copyright (c) 2026 David Haz — MIT + Commons Clause (used as part of this application).
	Local adaptations: 'motion' dependency replaced with pure CSS keyframes (var(--ease-out-expo),
	per-span animation-delay); dropped the motion-specific animationFrom/animationTo/easing/
	onAnimationComplete props. Root is a <span> (phrasing content, usable inside headings);
	spans render fully visible in SSR/no-JS and only animate once mounted, intersecting the
	viewport, and prefers-reduced-motion does not match.
-->
<script lang="ts">
	type Props = {
		text?: string;
		delay?: number;
		class?: string;
		animateBy?: 'words' | 'letters';
		direction?: 'top' | 'bottom';
		threshold?: number;
		rootMargin?: string;
		stepDuration?: number;
	};

	let {
		text = '',
		delay = 70,
		class: className = '',
		animateBy = 'words',
		direction = 'top',
		threshold = 0.1,
		rootMargin = '0px',
		stepDuration = 0.45
	}: Props = $props();

	const segments = $derived(animateBy === 'words' ? text.split(' ') : text.split(''));

	let containerEl: HTMLSpanElement | undefined = $state();
	let animating = $state(false);

	$effect(() => {
		if (!containerEl || animating) return;
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
		observer.observe(containerEl);
		return () => observer.disconnect();
	});
</script>

<span
	bind:this={containerEl}
	class="blur-text inline-flex flex-wrap {className}"
	class:animating
	class:from-top={direction === 'top'}
>
	{#each segments as segment, index (index)}
		<span
			class="inline-block"
			style:animation-delay="calc({index} * {delay}ms)"
			style:animation-duration="{stepDuration}s"
			>{segment === ' ' ? '\u00A0' : segment}{animateBy === 'words' && index < segments.length - 1
				? '\u00A0'
				: ''}</span
		>
	{/each}
</span>

<style>
	.blur-text.animating > span {
		animation-name: blur-text-in-bottom;
		animation-timing-function: var(--ease-out-expo);
		animation-fill-mode: both;
		will-change: transform, filter, opacity;
	}
	.blur-text.animating.from-top > span {
		animation-name: blur-text-in-top;
	}

	@keyframes blur-text-in-top {
		from {
			filter: blur(10px);
			opacity: 0;
			transform: translateY(-14px);
		}
		to {
			filter: blur(0);
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes blur-text-in-bottom {
		from {
			filter: blur(10px);
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			filter: blur(0);
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
