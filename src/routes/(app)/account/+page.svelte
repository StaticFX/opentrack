<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Link2, Check, X, KeyRound, ShieldCheck, Bell } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import BrandIcon from '$lib/components/integrations/BrandIcon.svelte';

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
</script>

<svelte:head><title>Account · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Account</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Your profile and connected accounts.</p>
	</header>

	<!-- Profile -->
	<section class="mb-6 flex items-center gap-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		{#if user.avatarUrl}
			<img src={user.avatarUrl} alt="" class="size-11 rounded-full" />
		{:else}
			<div class="grid size-11 place-items-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
				{user.displayName.slice(0, 1).toUpperCase()}
			</div>
		{/if}
		<div>
			<p class="font-medium">{user.displayName}{#if data.isAdmin}<span class="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Admin</span>{/if}</p>
			{#if user.email}<p class="text-sm text-neutral-500">{user.email}</p>{/if}
		</div>
	</section>

	<!-- Connected accounts -->
	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><Link2 size={15} /> Connected accounts</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">Link a provider to sign in with it and show your identity.</p>

		{#if linkedFlag === 'taken'}
			<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">That account is already linked to a different user.</p>
		{:else if linkedFlag}
			<p class="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">{builtinLabel[linkedFlag] ?? linkedFlag} account connected.</p>
		{/if}

		<div class="space-y-3">
			{#each providerKeys as key (key)}
				{@const p = meta(key)}
				{@const linked = linkedByKey.get(key)}
				{@const enabled = enabledByKey.has(key)}
				<div class="flex items-center gap-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-800/60">
					<span class="grid size-5 shrink-0 place-items-center text-neutral-600 dark:text-neutral-300">
						<BrandIcon name={p.icon || key} size={20} />
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium">{p.label}</p>
						{#if linked}
							<p class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><Check size={12} /> Connected{#if linked.providerUsername} as @{linked.providerUsername}{/if}</p>
						{:else if enabled}
							<p class="text-xs text-neutral-400">Not connected</p>
						{:else}
							<p class="text-xs text-neutral-400">Not available on this instance</p>
						{/if}
					</div>

					{#if linked}
						<form method="POST" action="?/unlink" use:enhance>
							<input type="hidden" name="provider" value={key} />
							<Button size="sm" variant="ghost" type="submit" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><X size={14} /> Disconnect</Button>
						</form>
					{:else if enabled}
						<Button size="sm" variant="default" href={`/auth/oauth/${key}?link=1&redirect=/account`}>Connect</Button>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-neutral-400">No login providers are configured on this instance.</p>
			{/each}
		</div>

		{#if data.isAdmin}
			<p class="mt-4 text-xs text-neutral-500">
				Configure login providers in
				<a href="/admin/privacy" class="font-medium text-brand-600 hover:underline">Admin → Privacy</a> — including custom OAuth providers like Google.
			</p>
		{/if}
	</section>

	{#if data.hasPassword}
		<!-- Security -->
		<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
			<h2 class="flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} /> Security</h2>

			<!-- Change password -->
			<div class="mt-4">
				<h3 class="mb-2 text-sm font-medium">Change password</h3>
				{#if f?.pwError}<p class="mb-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.pwError}</p>{/if}
				{#if f?.pwSaved}<p class="mb-2 text-sm text-green-600">Password updated.</p>{/if}
				<form method="POST" action="?/changePassword" use:enhance={() => async ({ update }) => { await update({ reset: true }); }} class="flex max-w-sm flex-col gap-3">
					<Field label="Current password"><Input name="current" type="password" autocomplete="current-password" /></Field>
					<Field label="New password" hint="At least 8 characters."><Input name="next" type="password" autocomplete="new-password" /></Field>
					<Field label="Confirm new password"><Input name="confirm" type="password" autocomplete="new-password" /></Field>
					<div><Button variant="primary" type="submit">Update password</Button></div>
				</form>
			</div>

			<!-- Two-factor -->
			<div class="mt-6 border-t border-neutral-100 pt-4 dark:border-neutral-800">
				<h3 class="mb-1 flex items-center gap-1.5 text-sm font-medium"><ShieldCheck size={14} /> Two-factor authentication</h3>
				{#if f?.totpError}<p class="mb-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.totpError}</p>{/if}

				{#if data.totp.state === 'on'}
					<p class="mb-3 flex items-center gap-1 text-sm text-green-600 dark:text-green-400"><Check size={14} /> Two-factor is on. You'll be asked for a code at sign-in.</p>
					<form method="POST" action="?/disableTotp" use:enhance class="flex max-w-sm items-end gap-2">
						<div class="flex-1"><Field label="Password to disable"><Input name="password" type="password" /></Field></div>
						<Button variant="ghost" type="submit" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Disable</Button>
					</form>
				{:else if data.totp.state === 'pending'}
					<p class="mb-2 text-sm text-neutral-500">Scan this with your authenticator app (or enter the key), then confirm with a code.</p>
					<div class="mb-2 inline-block rounded-lg bg-white p-2 [&>svg]:size-40">{@html data.totp.qrSvg}</div>
					<p class="mb-3 text-xs text-neutral-500">Setup key: <code class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">{data.totp.secret}</code></p>
					<form method="POST" action="?/confirmTotp" use:enhance class="flex max-w-xs items-end gap-2">
						<div class="flex-1"><Field label="6-digit code"><Input name="code" inputmode="numeric" placeholder="123456" /></Field></div>
						<Button variant="primary" type="submit">Enable</Button>
					</form>
					<form method="POST" action="?/cancelTotp" use:enhance class="mt-2">
						<button class="text-xs text-neutral-400 hover:text-neutral-600">Cancel setup</button>
					</form>
				{:else}
					<p class="mb-3 text-sm text-neutral-500">Protect sign-in with a one-time code from an authenticator app (Google Authenticator, 1Password, …).</p>
					<form method="POST" action="?/startTotp" use:enhance>
						<Button variant="default" type="submit"><ShieldCheck size={15} /> Set up two-factor</Button>
					</form>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Notifications -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><Bell size={15} /> Notifications</h2>
		<p class="mt-1 mb-3 text-sm text-neutral-500">
			Get browser push alerts for tickets and suggestions you follow — replies, mentions, and status
			changes.
		</p>

		{#if !data.push.configured}
			<p class="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-800/50">
				Push isn't set up on this instance yet.{#if data.isAdmin}
					Configure VAPID keys in <a href="/admin/notifications" class="text-brand-600 underline">Admin → Notifications</a>.{/if}
			</p>
		{:else if !pushSupported}
			<p class="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-800/50">
				This browser doesn't support push notifications.
			</p>
		{:else}
			{#if pushError}<p class="mb-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{pushError}</p>{/if}
			<div class="flex items-center justify-between">
				<span class="text-sm">
					{#if pushOn}
						<span class="flex items-center gap-1 text-green-600 dark:text-green-400"><Check size={14} /> Browser notifications are on</span>
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
</div>
