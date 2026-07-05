<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Users, Boxes, ShieldCheck, Shield, Ban, RotateCcw, Mail } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const me = $derived(data.user as { id: string });

	const providerLabel: Record<string, string> = {
		github: 'GitHub',
		discord: 'Discord',
		modrinth: 'Modrinth'
	};

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}

	function initials(name: string) {
		return name
			.split(/\s+/)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}
</script>

<svelte:head><title>Users · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-3xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Users</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Manage accounts and internal access.</p>
	</header>

	<!-- Stats -->
	<div class="mb-6 grid grid-cols-3 gap-3">
		<div class="flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<Users size={18} class="text-neutral-400" />
			<div><p class="text-lg font-semibold">{data.stats.users}</p><p class="text-xs text-neutral-500">Users</p></div>
		</div>
		<div class="flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<ShieldCheck size={18} class="text-neutral-400" />
			<div><p class="text-lg font-semibold">{data.stats.internal}</p><p class="text-xs text-neutral-500">Internal</p></div>
		</div>
		<div class="flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<Boxes size={18} class="text-neutral-400" />
			<div><p class="text-lg font-semibold">{data.stats.workspaces}</p><p class="text-xs text-neutral-500">Workspaces</p></div>
		</div>
	</div>

	<!-- Invite internal users -->
	<section class="mb-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><Mail size={15} /> Invite internal users</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Generate a code that grants internal access. Share the link to let someone in.
		</p>
		<form method="POST" action="?/createInvite" use:enhance class="flex flex-wrap items-end gap-3">
			<Field label="Uses"><Input name="maxUses" type="number" min="1" value="1" class="w-20" /></Field>
			<Button variant="primary" type="submit">Create invite</Button>
		</form>
		{#if f?.inviteLink}
			<div class="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
				<code class="min-w-0 flex-1 truncate text-sm">{f.inviteLink}</code>
				<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}><Copy size={14} /> Copy</Button>
			</div>
		{/if}
		{#if data.recentInvites.length}
			<p class="mt-4 mb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase">Recent codes</p>
			<ul class="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
				{#each data.recentInvites as inv (inv.id)}
					<li class="flex items-center justify-between py-1.5 text-neutral-500">
						<span>{new Date(inv.createdAt).toLocaleDateString()}</span>
						<span>{inv.uses}/{inv.maxUses} used</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- User list -->
	<section class="rounded-xl border border-neutral-200 dark:border-neutral-800">
		{#if f?.error}
			<p class="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30">{f.error}</p>
		{/if}
		<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
			{#each data.users as u (u.id)}
				<li class="flex items-center gap-3 px-5 py-3">
					{#if u.avatarUrl}
						<img src={u.avatarUrl} alt="" class="size-8 shrink-0 rounded-full" />
					{:else}
						<div class="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
							{initials(u.displayName)}
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate text-sm font-medium">{u.displayName}</span>
							{#if u.isAdmin}
								<span class="flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"><Shield size={10} /> Admin</span>
							{/if}
							{#if u.internal}
								<span class="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">Internal</span>
							{:else}
								<span class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">External</span>
							{/if}
							{#if u.status === 'suspended'}
								<span class="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">Disabled</span>
							{/if}
						</div>
						<p class="truncate text-xs text-neutral-500">
							@{u.username}{#if u.email} · {u.email}{/if}{#if u.providers.length} · {u.providers.map((p: string) => providerLabel[p] ?? p).join(', ')}{/if}
						</p>
					</div>

					{#if u.id !== me.id}
						<form method="POST" action="?/setStatus" use:enhance class="shrink-0">
							<input type="hidden" name="userId" value={u.id} />
							{#if u.status === 'suspended'}
								<input type="hidden" name="status" value="active" />
								<Button size="sm" variant="default" type="submit"><RotateCcw size={13} /> Enable</Button>
							{:else}
								<input type="hidden" name="status" value="suspended" />
								<Button size="sm" variant="ghost" type="submit" class="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Ban size={13} /> Disable</Button>
							{/if}
						</form>
					{:else}
						<span class="shrink-0 text-xs text-neutral-400">You</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
</div>
