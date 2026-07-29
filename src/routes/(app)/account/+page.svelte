<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Link2, Check, X, KeyRound, ShieldCheck, Bell, UserRound } from '@lucide/svelte';
	import SettingsShell from '$lib/components/app/SettingsShell.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import BrandIcon from '$lib/components/integrations/BrandIcon.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();

	// ── Web Push ────────────────────────────────────────────────────────────
	let pushOn = $state(data.push.subscribed);
	let pushBusy = $state(false);
	let pushError = $state('');
	const pushSupported =
		typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

	function urlBase64ToUint8Array(base64: string): Uint8Array {
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(b64);
		return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
	}

	async function enablePush() {
		pushError = '';
		pushBusy = true;
		try {
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') throw new Error('Notification permission was denied.');
			const reg = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(data.push.publicKey!) as BufferSource
			});
			const res = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub)
			});
			if (!res.ok) throw new Error('Could not save the subscription.');
			pushOn = true;
			toast('Browser notifications enabled.', { tone: 'success' });
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Could not enable notifications.';
		} finally {
			pushBusy = false;
		}
	}

	async function disablePush() {
		pushBusy = true;
		try {
			const reg = await navigator.serviceWorker.getRegistration('/sw.js');
			const sub = await reg?.pushManager.getSubscription();
			if (sub) {
				await fetch('/api/push/unsubscribe', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			pushOn = false;
		} finally {
			pushBusy = false;
		}
	}
	const f = $derived(form as Record<string, any> | null);
	const user = $derived(data.user as { displayName: string; email: string | null; avatarUrl: string | null });

	const builtinLabel: Record<string, string> = { github: 'GitHub', discord: 'Discord', modrinth: 'Modrinth' };

	const enabledByKey = $derived(new Map(data.enabledProviders.map((p) => [p.key, p])));
	const linkedByKey = $derived(new Map(data.linked.map((l) => [l.provider, l])));
	// Every provider you can connect, plus any you've already linked.
	const providerKeys = $derived([
		...new Set([...data.enabledProviders.map((p) => p.key), ...data.linked.map((l) => l.provider)])
	]);
	const meta = (key: string) =>
		enabledByKey.get(key) ?? { key, label: builtinLabel[key] ?? key, icon: null };

	// ?linked=github (success) | ?linked=taken (already on another account)
	const linkedFlag = $derived(page.url.searchParams.get('linked'));

	const TAB_KEYS = ['profile', 'security', 'notifications'] as const;
	type Tab = (typeof TAB_KEYS)[number];
	const items = [
		{ label: 'Profile', icon: UserRound, tab: 'profile' },
		{ label: 'Sign-in & security', icon: ShieldCheck, tab: 'security' },
		{ label: 'Notifications', icon: Bell, tab: 'notifications' }
	];
	const tab = $derived<Tab>(
		(TAB_KEYS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '')
			? (page.url.searchParams.get('tab') as Tab)
			: 'profile'
	);
	const actionFor = (name: string) => `?tab=${tab}&/${name}`;

	// One page-level dirty guard: the password fields are the only edit-then-
	// save form here (TOTP is a one-shot wizard flow, not a dirty edit).
	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let savingPassword = $state(false);
	let current = $state('');
	let next = $state('');
	let confirmPw = $state('');

	function discardPassword() {
		current = '';
		next = '';
		confirmPw = '';
		dirtyGuard.markClean();
	}

	$effect(() => {
		if (f?.pwSaved) {
			dirtyGuard.markClean();
			current = '';
			next = '';
			confirmPw = '';
			toast('Password updated.', { tone: 'success' });
		} else if (f?.totpEnabled) {
			toast('Two-factor authentication enabled.', { tone: 'success' });
		} else if (f?.totpDisabled) {
			toast('Two-factor authentication disabled.', { tone: 'info' });
		} else if (f?.unlinked) {
			toast('Account disconnected.', { tone: 'info' });
		}
	});

	// Destruction Tier 2 (OAuth unlink) — the real form carries `provider`; the
	// button just gates submission behind a styled confirm dialog.
	let confirmOpen = $state(false);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let confirmDesc = $state('');
	function askUnlink(e: MouseEvent, label: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmDesc = `You'll no longer be able to sign in with ${label}. You can reconnect it any time.`;
		confirmOpen = true;
	}
	function confirmUnlink() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
	}
</script>

<svelte:head><title>Account · OpenTrack</title></svelte:head>

<SettingsShell
	scope="account"
	{items}
	active={tab}
	backHref="/dashboard"
	backLabel="Back to app"
	title={user.displayName}
	avatarUrl={user.avatarUrl}
>
	{#if tab === 'profile'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Profile</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Your identity across this instance.</p>
		</header>
		<section class="flex items-center gap-3 border-t border-[var(--rule)] pt-5">
			{#if user.avatarUrl}
				<img src={user.avatarUrl} alt="" class="size-11 rounded-full" />
			{:else}
				<div class="grid size-11 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-sm font-semibold text-[var(--dim)]">
					{user.displayName.slice(0, 1).toUpperCase()}
				</div>
			{/if}
			<div>
				<p class="flex items-center font-medium text-[var(--text)]">{user.displayName}{#if data.isAdmin}<Badge tone="accent" class="ml-2">Admin</Badge>{/if}</p>
				{#if user.email}<p class="text-[13px] text-[var(--dim)]">{user.email}</p>{/if}
			</div>
		</section>
	{:else if tab === 'security'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Sign-in &amp; security</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Connected accounts, password, and two-factor authentication.</p>
		</header>

		<!-- Connected accounts -->
		<section class="border-t border-[var(--rule)] pt-5">
			<h3 class="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]"><Link2 size={15} class="text-[var(--faint)]" /> Connected accounts</h3>
			<p class="mt-1 mb-4 text-[13px] text-[var(--dim)]">Link a provider to sign in with it and show your identity.</p>

			{#if linkedFlag === 'taken'}
				<p class="mb-3 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-3 text-[13px] text-[#f85149]">That account is already linked to a different user.</p>
			{:else if linkedFlag}
				<p class="mb-3 border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] p-3 text-[13px] text-[var(--green)]">{builtinLabel[linkedFlag] ?? linkedFlag} account connected.</p>
			{/if}

			<div class="border-t border-[var(--rule)]">
				{#each providerKeys as key (key)}
					{@const p = meta(key)}
					{@const linked = linkedByKey.get(key)}
					{@const enabled = enabledByKey.has(key)}
					<div class="flex items-center gap-3 border-b border-[var(--rule)] py-3">
						<span class="grid size-5 shrink-0 place-items-center text-[var(--dim)]">
							<BrandIcon name={p.icon || key} size={20} />
						</span>
						<div class="min-w-0 flex-1">
							<p class="text-[13px] font-medium text-[var(--text)]">{p.label}</p>
							{#if linked}
								<p class="flex items-center gap-1 text-[11px] text-[var(--green)]"><Check size={12} /> Connected{#if linked.providerUsername} as @{linked.providerUsername}{/if}</p>
							{:else if enabled}
								<p class="text-[11px] text-[var(--faint)]">Not connected</p>
							{:else}
								<p class="text-[11px] text-[var(--faint)]">Not available on this instance</p>
							{/if}
						</div>

						{#if linked}
							<form method="POST" action={actionFor('unlink')} use:enhance>
								<input type="hidden" name="provider" value={key} />
								<Button size="sm" variant="ghost" type="submit" onclick={(e) => askUnlink(e, p.label)} class="text-[#f85149] hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)]"><X size={14} /> Disconnect</Button>
							</form>
						{:else if enabled}
							<Button size="sm" variant="default" href={`/auth/oauth/${key}?link=1&redirect=/account`}>Connect</Button>
						{/if}
					</div>
				{:else}
					<p class="py-3 text-[13px] text-[var(--faint)]">No login providers are configured on this instance.</p>
				{/each}
			</div>

			{#if data.isAdmin}
				<p class="mt-4 text-[11px] text-[var(--faint)]">
					Configure login providers in
					<a href="/admin/privacy" class="mono-focus font-medium text-[var(--accent)] hover:underline">Admin → Sign-in &amp; OAuth</a> — including custom OAuth providers like Google.
				</p>
			{/if}
		</section>

		{#if data.hasPassword}
			<!-- Password + 2FA -->
			<section class="mt-8 border-t border-[var(--rule)] pt-5">
				<h3 class="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]"><KeyRound size={15} class="text-[var(--faint)]" /> Password</h3>
				{#if f?.pwError}<p class="mt-3 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-2.5 text-[13px] text-[#f85149]">{f.pwError}</p>{/if}
				<form
					method="POST"
					action={actionFor('changePassword')}
					use:enhance={() => async ({ update }) => {
						savingPassword = true;
						await update({ reset: true });
						savingPassword = false;
					}}
					oninput={() => dirtyGuard.markDirty()}
					class="mt-4 flex max-w-sm flex-col gap-3"
				>
					<Field label="Current password"><Input name="current" type="password" bind:value={current} autocomplete="current-password" /></Field>
					<Field label="New password" hint="At least 8 characters."><Input name="next" type="password" bind:value={next} autocomplete="new-password" /></Field>
					<Field label="Confirm new password"><Input name="confirm" type="password" bind:value={confirmPw} autocomplete="new-password" /></Field>
					<div><Button variant="primary" type="submit">Update password</Button></div>
					<SaveBar dirty={$dirty} saving={savingPassword} onDiscard={discardPassword} />
				</form>
			</section>

			<section class="mt-8 border-t border-[var(--rule)] pt-5">
				<h3 class="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text)]"><ShieldCheck size={14} class="text-[var(--faint)]" /> Two-factor authentication</h3>
				{#if f?.totpError}<p class="mb-2 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-2.5 text-[13px] text-[#f85149]">{f.totpError}</p>{/if}

				{#if data.totp.state === 'on'}
					<p class="mb-3 flex items-center gap-1 text-[13px] text-[var(--green)]"><Check size={14} /> Two-factor is on. You'll be asked for a code at sign-in.</p>
					<form method="POST" action={actionFor('disableTotp')} use:enhance class="flex max-w-sm items-end gap-2">
						<div class="flex-1"><Field label="Password to disable"><Input name="password" type="password" /></Field></div>
						<Button variant="ghost" type="submit" class="text-[#f85149] hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)]">Disable</Button>
					</form>
				{:else if data.totp.state === 'pending'}
					<p class="mb-2 text-[13px] text-[var(--dim)]">Scan this with your authenticator app (or enter the key), then confirm with a code.</p>
					<div class="mb-2 inline-block rounded-[4px] bg-white p-2 [&>svg]:size-40">{@html data.totp.qrSvg}</div>
					<p class="mb-3 text-[11px] text-[var(--faint)]">Setup key: <code class="data-mono rounded-[3px] bg-[var(--raised)] px-1.5 py-0.5 text-[var(--dim)]">{data.totp.secret}</code></p>
					<form method="POST" action={actionFor('confirmTotp')} use:enhance class="flex max-w-xs items-end gap-2">
						<div class="flex-1"><Field label="6-digit code"><Input name="code" inputmode="numeric" placeholder="123456" /></Field></div>
						<Button variant="primary" type="submit">Enable</Button>
					</form>
					<form method="POST" action={actionFor('cancelTotp')} use:enhance class="mt-2">
						<button class="mono-focus text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--text)]">Cancel setup</button>
					</form>
				{:else}
					<p class="mb-3 text-[13px] text-[var(--dim)]">Protect sign-in with a one-time code from an authenticator app (Google Authenticator, 1Password, …).</p>
					<form method="POST" action={actionFor('startTotp')} use:enhance>
						<Button variant="default" type="submit"><ShieldCheck size={15} /> Set up two-factor</Button>
					</form>
				{/if}
			</section>
		{/if}
	{:else if tab === 'notifications'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Notifications</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">
				Browser push alerts for tickets and suggestions you follow — replies, mentions, and status
				changes.
			</p>
		</header>
		<section class="border-t border-[var(--rule)] pt-5">
			{#if !data.push.configured}
				<p class="border border-[var(--rule)] bg-[var(--raised)] p-3 text-[13px] text-[var(--dim)]">
					Push isn't set up on this instance yet.{#if data.isAdmin}
						Configure VAPID keys in <a href="/admin/notifications" class="mono-focus text-[var(--accent)] underline">Admin → Notifications</a>.{/if}
				</p>
			{:else if !pushSupported}
				<p class="border border-[var(--rule)] bg-[var(--raised)] p-3 text-[13px] text-[var(--dim)]">
					This browser doesn't support push notifications.
				</p>
			{:else}
				{#if pushError}<p class="mb-2 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-2.5 text-[13px] text-[#f85149]">{pushError}</p>{/if}
				<div class="flex items-center justify-between">
					<span class="text-[13px] text-[var(--text)]">
						{#if pushOn}
							<span class="flex items-center gap-1 text-[var(--green)]"><Check size={14} /> Browser notifications are on</span>
						{:else}
							Browser notifications are off
						{/if}
					</span>
					{#if pushOn}
						<Button variant="ghost" onclick={disablePush} disabled={pushBusy}>Turn off</Button>
					{:else}
						<Button variant="default" onclick={enablePush} disabled={pushBusy}>
							<Bell size={15} /> Enable
						</Button>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</SettingsShell>

<Dialog bind:open={confirmOpen} title="Disconnect account?" description={confirmDesc}>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" onclick={confirmUnlink}>Disconnect</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={() => $pending, (v) => { if (!v) dirtyGuard.stay(); }}
	title="Discard changes?"
	description="You have unsaved edits on this tab. Leaving now will discard them."
>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => dirtyGuard.stay()}>Keep editing</Button>
		<Button variant="danger" type="button" onclick={() => dirtyGuard.discard()}>Discard</Button>
	{/snippet}
</Dialog>
