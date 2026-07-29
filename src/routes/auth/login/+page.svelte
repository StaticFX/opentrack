<!--
	/auth/login — the "Immersive First Boot" sign-in experience: a
	full-viewport cursor-reactive dot field + blueprint grid + power-on rings
	behind a glowing glass auth card, with a terminal-style decrypt headline.
	All the actual contracts (providers, admin password form, 2FA step) are
	unchanged from the plain version this replaces — see Hero.svelte for the
	real forms/links; this file only derives the same view state the old
	page did and supplies the dark, cobalt-accent theme tokens the auth-b
	component family expects.
-->
<script lang="ts">
	import Hero from '$lib/components/landing/auth-b/Hero.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const redirectParam = $derived(
		data.redirectTo && data.redirectTo !== '/'
			? `?redirect=${encodeURIComponent(data.redirectTo)}`
			: ''
	);

	// Step 2 shows when the server asks for a code (fresh submit) or a pending
	// 2FA marker survives a reload — unless the last action reset the flow.
	const twoFactor = $derived(
		!f?.reset && (f?.needCode || (!!data.pendingUsername && f?.error == null))
	);
	const pendingName = $derived(f?.username ?? data.pendingUsername ?? '');
</script>

<svelte:head><title>Sign in · OpenTrack</title></svelte:head>

<div
	data-theme="dark"
	class="auth-b relative isolate min-h-dvh font-sans antialiased"
	style="
		--accent: oklch(0.64 0.19 262);
		--accent-solid: oklch(0.55 0.2 262);
		--accent-solid-hover: oklch(0.61 0.2 262);
		--accent-fg: oklch(0.78 0.13 262);
		--accent-soft: oklch(0.64 0.19 262 / 0.16);
		--accent-wash: oklch(0.64 0.19 262 / 0.08);
		--accent-border: oklch(0.64 0.19 262 / 0.4);
		--accent-glow: oklch(0.64 0.19 262 / 0.45);
		--ot-hairline: oklch(1 0 0 / 0.1);
		--ab-bg: oklch(0.145 0.016 258);
		--ab-bg-2: oklch(0.185 0.018 260);
		--ab-surface: oklch(0.2 0.018 259);
		--ab-surface-2: oklch(0.245 0.02 259);
		--ab-line: oklch(1 0 0 / 0.09);
		--ab-line-strong: oklch(1 0 0 / 0.16);
		--ab-text: oklch(0.97 0.005 258);
		--ab-text-dim: oklch(0.745 0.013 258);
		--ab-text-faint: oklch(0.52 0.013 258);
		background: var(--ab-bg);
		color: var(--ab-text);
		color-scheme: dark;
	"
>
	<Hero
		providers={data.providers}
		{redirectParam}
		oauthError={data.oauthError}
		{f}
		{twoFactor}
		{pendingName}
	/>
</div>

<style>
	.auth-b :global(.pub-label) {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
</style>
