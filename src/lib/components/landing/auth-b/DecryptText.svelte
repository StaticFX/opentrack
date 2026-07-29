<!--
	DecryptText — "first boot" headline: the final text is present from SSR
	(so no-JS / crawlers get the real string via aria-label), then once
	mounted it scrambles through mono glyphs and resolves character-by-
	character left to right, like a terminal identifying itself. Runs once.
	prefers-reduced-motion (checked at mount, not reactively) skips straight
	to the resolved text — no flashing glyphs, no timers.
-->
<script lang="ts">
	type Props = { text: string; class?: string; startDelay?: number };
	let { text, class: className = '', startDelay = 120 }: Props = $props();

	const SCRAMBLE = '!<>-_\\/[]{}=+*^?#01';

	let display = $state(text);
	let settled = $state(false);

	$effect(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			settled = true;
			return;
		}

		let raf = 0;
		let startTimer = 0;
		let frame = 0;
		// Each character locks in on its own frame threshold, staggered left
		// to right, so the reveal reads as a sweep rather than a flicker.
		const lockFrame = (i: number) => 6 + i * 2;
		const lastLock = lockFrame(text.length - 1);

		function tick() {
			frame++;
			let out = '';
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				if (ch === ' ') {
					out += ' ';
				} else if (frame >= lockFrame(i)) {
					out += ch;
				} else {
					out += SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
				}
			}
			display = out;
			if (frame <= lastLock) {
				raf = requestAnimationFrame(tick);
			} else {
				display = text;
				settled = true;
			}
		}

		startTimer = window.setTimeout(() => {
			raf = requestAnimationFrame(tick);
		}, startDelay);

		return () => {
			clearTimeout(startTimer);
			cancelAnimationFrame(raf);
		};
	});
</script>

<span class={className} aria-label={text}>
	<span aria-hidden="true">{display}<span class="caret" class:hide={settled}>▍</span></span>
</span>

<style>
	.caret {
		display: inline-block;
		margin-left: 2px;
		color: var(--accent-fg);
		animation: caret-blink 1s steps(1) infinite;
	}
	.caret.hide {
		opacity: 0;
	}
	@keyframes caret-blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
			opacity: 1;
		}
	}
</style>
