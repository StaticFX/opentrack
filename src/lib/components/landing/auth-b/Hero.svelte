<!--
	Hero — the full-viewport "first boot" sign-in. This IS the real
	/auth/login page content: BootField fills the screen behind a centered,
	glowing auth card; BrandMark + DecryptText sell the power-on moment
	before the card's real controls take over. Every control inside the card
	is a genuine wired form/link — nothing here is mocked. The card swaps
	between the provider-list/admin step and the two-factor step based on
	props the page derives from `data`/`form`, exactly like the plain
	AuthCard version it replaces.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowUpRight, KeyRound } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import BootField from './BootField.svelte';
	import BrandMark from './BrandMark.svelte';
	import DecryptText from './DecryptText.svelte';
	import ProviderButton from './ProviderButton.svelte';
	import ValueTicker from './ValueTicker.svelte';

	type ProviderInfo = { key: string; label: string; icon: string | null };
	type Props = {
		providers: ProviderInfo[];
		redirectParam: string;
		oauthError?: string | null;
		f?: Record<string, any> | null;
		twoFactor: boolean;
		pendingName: string;
	};
	let {
		providers,
		redirectParam,
		oauthError = null,
		f = null,
		twoFactor,
		pendingName
	}: Props = $props();

	let showAdmin = $state(false);
</script>

<section id="top" class="hero relative isolate flex min-h-dvh flex-col overflow-hidden px-4 sm:px-6">
	<BootField />

	<nav class="relative z-10 flex items-center justify-between pt-4 sm:pt-5">
		<a href="/" class="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-semibold text-[var(--ab-text)]">
			<span
				class="grid size-6 place-items-center rounded-md text-[10px] font-bold text-white"
				style="background:var(--accent)"
			>
				OT
			</span>
			OpenTrack
		</a>
		<a
			href="/"
			class="focus-ring group inline-flex items-center gap-1 rounded-md text-xs font-medium text-[var(--ab-text-dim)] transition-colors hover:text-[var(--ab-text)]"
		>
			Explore live demo
			<ArrowUpRight size={13} class="transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
		</a>
	</nav>

	<div
		class="pointer-events-none absolute inset-x-4 top-16 z-10 hidden items-center justify-between font-mono text-[10px] tracking-[0.08em] text-[var(--ab-text-faint)] uppercase sm:inset-x-6 sm:flex"
		aria-hidden="true"
	>
		<span>// opentrack / auth</span>
		<span class="data-mono normal-case">build 2026.07 · self-hosted</span>
	</div>

	<div class="relative z-10 flex flex-1 flex-col items-center justify-center py-10 sm:py-14">
		<BrandMark class="mb-5" />

		<p
			class="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-[var(--ab-text-faint)] uppercase"
		>
			<span class="relative flex size-1.5" aria-hidden="true">
				<span class="ot-breathe absolute inline-flex size-full rounded-full" style="background:var(--accent)"></span>
				<span class="relative inline-flex size-1.5 rounded-full" style="background:var(--accent)"></span>
			</span>
			system ready
		</p>

		<h1 class="type-poster mt-3 text-center text-[32px] leading-[1.1] text-[var(--ab-text)] sm:text-4xl">
			<DecryptText text="Welcome to OpenTrack" />
		</h1>

		<p class="mt-3 max-w-[22rem] text-center text-[13.5px] leading-relaxed text-[var(--ab-text-dim)]">
			Sign in to watch the board move, vote on what's next, and ship in the open.
		</p>

		<div class="auth-card mt-8 w-full max-w-[400px] rounded-2xl p-5 sm:p-7">
			<div class="mb-5 flex items-center justify-between">
				<span class="pub-label" style="color:var(--ab-text-faint)">
					{twoFactor ? 'Auth / Verify' : 'Auth / Identify'}
				</span>
				<span class="data-mono" style="color:var(--ab-text-faint)">v0.9 · edge</span>
			</div>

			{#if twoFactor}
				<p class="mb-4 text-[13px] leading-relaxed" style="color:var(--ab-text-dim)">
					Signing in as <span class="font-medium" style="color:var(--ab-text)">{pendingName}</span>.
				</p>
				<form method="POST" action="?/code" use:enhance class="flex flex-col gap-4">
					{#if f?.error}
						<p
							class="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:border-red-400/20 dark:text-red-400"
						>
							{f.error}
						</p>
					{/if}
					<Field label="One-time code">
						<Input
							name="code"
							inputmode="numeric"
							autocomplete="one-time-code"
							placeholder="123456"
							maxlength={8}
							autofocus
							required
							class="text-center text-lg tracking-[0.4em]"
						/>
					</Field>
					<Button type="submit" variant="accent" class="w-full">Verify &amp; sign in</Button>
				</form>
				<form method="POST" action="?/cancel" use:enhance class="mt-3">
					<button
						type="submit"
						class="focus-ring w-full rounded-md text-center text-xs text-[var(--ab-text-faint)] transition-colors hover:text-[var(--ab-text-dim)]"
					>
						← Use a different account
					</button>
				</form>
			{:else}
				{#if oauthError}
					<p
						class="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-sm text-red-600 dark:border-red-400/20 dark:text-red-400"
					>
						{oauthError}
					</p>
				{/if}

				{#if providers.length > 0}
					<div class="flex flex-col gap-2.5">
						{#each providers as provider (provider.key)}
							<ProviderButton
								href={`/auth/oauth/${provider.key}${redirectParam}`}
								label={provider.label}
								icon={provider.icon || provider.key}
							/>
						{/each}
					</div>
				{:else}
					<p
						class="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-600 dark:border-amber-400/20 dark:text-amber-400"
					>
						No sign-in providers are configured yet.
					</p>
				{/if}

				<div class="divider-scan my-5">or</div>

				{#if showAdmin}
					<form method="POST" action="?/password" use:enhance class="flex flex-col gap-3">
						{#if f?.error}
							<p
								class="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:border-red-400/20 dark:text-red-400"
							>
								{f.error}
							</p>
						{/if}
						<Field label="Username">
							<Input name="username" autocomplete="username" value={f?.username ?? ''} required />
						</Field>
						<Field label="Password">
							<Input name="password" type="password" autocomplete="current-password" required />
						</Field>
						<Button type="submit" variant="accent" class="w-full">Continue</Button>
						<button
							type="button"
							onclick={() => (showAdmin = false)}
							class="focus-ring rounded-md text-center text-xs text-[var(--ab-text-faint)] transition-colors hover:text-[var(--ab-text-dim)]"
						>
							← back to providers
						</button>
					</form>
				{:else}
					<button
						type="button"
						onclick={() => (showAdmin = true)}
						class="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-[var(--ab-text-faint)] transition-colors hover:text-[var(--ab-text-dim)]"
					>
						<KeyRound size={13} /> Admin sign in
					</button>
				{/if}
			{/if}
		</div>

		<div class="mt-7 w-full max-w-[400px]">
			<ValueTicker />
		</div>
	</div>
</section>

<style>
	.auth-card {
		background: color-mix(in oklab, var(--ab-surface) 88%, transparent);
		border: 1px solid var(--ab-line-strong);
		backdrop-filter: blur(16px);
		box-shadow:
			0 0 0 1px oklch(1 0 0 / 0.03) inset,
			0 30px 70px -30px oklch(0 0 0 / 0.65),
			0 0 60px -18px var(--accent-glow);
	}
</style>
