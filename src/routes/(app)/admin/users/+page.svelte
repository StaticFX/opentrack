<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Users, Boxes, ShieldCheck, Shield, Ban, RotateCcw, Mail } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

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
</script>

<svelte:head><title>Users · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Users</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">Manage accounts and internal access.</p>
</header>

<!-- Stats -->
<div class="mb-8 grid grid-cols-3 divide-x divide-[var(--rule)] border-t border-b border-[var(--rule)]">
	<div class="flex items-center gap-3 px-3 py-3">
		<Users size={15} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />
		<div class="min-w-0">
			<p class="mono-display text-lg text-[var(--text)]">{data.stats.users}</p>
			<p class="truncate text-[11px] tracking-wide text-[var(--faint)] uppercase">Users</p>
		</div>
	</div>
	<div class="flex items-center gap-3 px-3 py-3">
		<ShieldCheck size={15} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />
		<div class="min-w-0">
			<p class="mono-display text-lg text-[var(--text)]">{data.stats.internal}</p>
			<p class="truncate text-[11px] tracking-wide text-[var(--faint)] uppercase">Internal</p>
		</div>
	</div>
	<div class="flex items-center gap-3 px-3 py-3">
		<Boxes size={15} class="shrink-0 text-[var(--faint)]" aria-hidden="true" />
		<div class="min-w-0">
			<p class="mono-display text-lg text-[var(--text)]">{data.stats.workspaces}</p>
			<p class="truncate text-[11px] tracking-wide text-[var(--faint)] uppercase">Workspaces</p>
		</div>
	</div>
</div>

<!-- Invite internal users -->
<section class="mb-8 border-t border-[var(--rule)] pt-6">
	<h3 class="mono-display flex items-center gap-2 text-[13px] text-[var(--text)]"><Mail size={14} class="text-[var(--faint)]" aria-hidden="true" /> Invite internal users</h3>
	<p class="mt-1 mb-4 text-[13px] text-[var(--dim)]">
		Generate a code that grants internal access. Share the link to let someone in.
	</p>
	<form method="POST" action="?/createInvite" use:enhance class="flex flex-wrap items-end gap-3">
		<Field label="Uses"><Input name="maxUses" type="number" min="1" value="1" class="w-20" /></Field>
		<Button variant="primary" type="submit">Create invite</Button>
	</form>
	{#if f?.inviteLink}
		<div class="mt-4 flex items-center gap-2 border border-[var(--rule)] bg-[var(--raised)] p-3">
			<code class="data-mono min-w-0 flex-1 truncate text-[13px] text-[var(--text)]">{f.inviteLink}</code>
			<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}><Copy size={14} /> Copy</Button>
		</div>
	{/if}
	{#if data.recentInvites.length}
		<p class="mt-4 mb-1 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Recent codes</p>
		<ul class="border-t border-[var(--rule)] text-[13px]">
			{#each data.recentInvites as inv (inv.id)}
				<li class="flex items-center justify-between border-b border-[var(--rule)] py-1.5 text-[var(--dim)]">
					<span class="data-mono">{new Date(inv.createdAt).toLocaleDateString()}</span>
					<span class="data-mono">{inv.uses}/{inv.maxUses} used</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<!-- User list -->
<section class="border-t border-[var(--rule)] pt-6">
	<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// All users</p>
	{#if f?.error}
		<p class="mb-3 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] px-3 py-2 text-[13px] text-[#f85149]">{f.error}</p>
	{/if}
	<ul class="border-t border-[var(--rule)]">
		{#each data.users as u (u.id)}
			<li class="flex items-center gap-3 border-b border-[var(--rule)] py-3">
				<Avatar src={u.avatarUrl} name={u.displayName} size={32} />

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate text-[13px] font-medium text-[var(--text)]">{u.displayName}</span>
						{#if u.isAdmin}
							<Badge tone="violet" icon={Shield}>Admin</Badge>
						{/if}
						{#if u.internal}
							<Badge tone="green">Internal</Badge>
						{:else}
							<Badge>External</Badge>
						{/if}
						{#if u.status === 'suspended'}
							<Badge tone="red">Disabled</Badge>
						{/if}
					</div>
					<p class="truncate text-[12px] text-[var(--faint)]">
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
							<Button size="sm" variant="ghost" type="submit" class="text-[#f85149] hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)]"><Ban size={13} /> Disable</Button>
						{/if}
					</form>
				{:else}
					<span class="shrink-0 text-[12px] text-[var(--faint)]">You</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>
