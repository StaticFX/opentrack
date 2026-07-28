<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { ArrowLeft, Trash2, ExternalLink, Plus } from '@lucide/svelte';
	import { RELEASE_LINK_TYPES } from '$lib/constants';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const r = $derived(data.detail.release);
	const base = $derived(`/w/${page.params.wsSlug}/p/${page.params.projectSlug}`);

	let status = $state(r.status);
	let notesDraft = $state(r.notes ?? '');
	let genMsg = $state('');
	const statusOptions = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'published', label: 'Published' }
	];
	const linkTypeOptions = RELEASE_LINK_TYPES.map((t) => ({ value: t, label: t }));
</script>

<svelte:head><title>{r.version} — Releases</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
	<a href={`${base}/releases`} class="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-[var(--accent-fg)]"><ArrowLeft size={14} /> Releases</a>

	<!-- Identity: version is data (mono), state pill reflects what's saved. -->
	<div class="ot-rise mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" style="--rise-i:0">
		<h1 class="font-mono text-2xl font-bold tracking-tight tabular-nums">{r.version}</h1>
		{#if r.name}<span class="min-w-0 truncate font-display text-lg font-semibold tracking-tight text-neutral-500 dark:text-neutral-400">{r.name}</span>{/if}
		<span class="rounded-full px-2 py-0.5 font-mono text-[11px] font-medium {r.status === 'published' ? 'text-green-700 dark:text-green-300' : 'text-neutral-500 dark:text-neutral-400'}" style="background:color-mix(in oklab, currentColor 12%, transparent)">{r.status}</span>
	</div>

	<!-- Details -->
	<section class="pub-card ot-rise p-5" style="--rise-i:1">
		<form
			method="POST"
			action="?/update"
			use:enhance={() => async ({ result, update }) => {
				const d = result.type === 'success' ? (result.data as Record<string, unknown> | undefined) : undefined;
				// The "Generate" button posts to ?/generateNotes and returns a draft;
				// apply it into the editor instead of running the normal update flow.
				if (d && ('draft' in d || 'empty' in d)) {
					if (d.draft) { notesDraft = String(d.draft); genMsg = 'Draft generated from shipped tickets — edit before saving.'; }
					else genMsg = 'No tickets shipped since the last release.';
					return;
				}
				await update({ reset: false });
			}}
			class="flex flex-col gap-4"
		>
			<div class="flex gap-3">
				<Field label="Version"><Input name="version" value={r.version} required class="w-40 font-mono" /></Field>
				<div class="flex-1"><Field label="Name (optional)"><Input name="name" value={r.name ?? ''} /></Field></div>
			</div>
			<div>
				<div class="mb-1 flex items-center justify-between">
					<span class="text-sm font-medium">Release notes (markdown)</span>
					<Button variant="ghost" size="sm" type="submit" formaction="?/generateNotes">✨ Generate from shipped tickets</Button>
				</div>
				<Textarea name="notes" rows={8} bind:value={notesDraft} />
				{#if genMsg}<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{genMsg}</p>{/if}
			</div>
			<div class="flex items-end justify-between">
				<Field label="Status"><input type="hidden" name="status" value={status} /><Select bind:value={status} options={statusOptions} class="w-40" /></Field>
				<div class="flex items-center gap-3">
					{#if f?.saved}<span class="text-sm text-green-600 dark:text-green-400">Saved</span>{/if}
					<Button variant="accent" type="submit">Save</Button>
				</div>
			</div>
		</form>
	</section>

	<!-- Links -->
	<section class="pub-card ot-rise mt-6 p-5" style="--rise-i:2">
		<h2 class="mb-3 font-display text-[15px] font-semibold tracking-tight">Links</h2>
		{#if data.detail.links.length}
			<ul class="mb-3 divide-y divide-black/5 dark:divide-white/8">
				{#each data.detail.links as l (l.id)}
					<li class="flex items-center justify-between py-2 text-sm">
						<a href={l.url} target="_blank" rel="noopener" class="flex items-center gap-1.5 font-medium text-[var(--accent-fg)] hover:underline">
							<ExternalLink size={13} /> {l.label} <span class="font-mono text-xs font-normal text-neutral-400">({l.type})</span>
						</a>
						<form method="POST" action="?/removeLink" use:enhance>
							<input type="hidden" name="linkId" value={l.id} />
							<button class="rounded-md p-1 text-neutral-400 transition-colors hover:text-red-600" aria-label="Remove link"><Trash2 size={14} /></button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="?/addLink" use:enhance class="flex flex-wrap items-end gap-2">
			<Field label="Label"><Input name="label" placeholder="Download" class="w-32" /></Field>
			<div class="min-w-40 flex-1"><Field label="URL"><Input name="url" type="url" placeholder="https://…" /></Field></div>
			<Field label="Type"><Select name="type" options={linkTypeOptions} value="external" class="w-32" /></Field>
			<Button variant="default" type="submit"><Plus size={14} /> Add</Button>
		</form>
	</section>

	<!-- Shipped tickets -->
	<section class="pub-card ot-rise mt-6 p-5" style="--rise-i:3">
		<h2 class="mb-3 font-display text-[15px] font-semibold tracking-tight">Shipped in this release</h2>
		{#if data.detail.tickets.length}
			<ul class="mb-3 space-y-0.5">
				{#each data.detail.tickets as t (t.id)}
					<li class="flex items-center justify-between rounded-lg px-2 py-1 text-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
						<span class="min-w-0 truncate"><span class="font-mono text-xs tabular-nums text-neutral-400">#{t.number}</span> {t.title}</span>
						<form method="POST" action="?/removeTicket" use:enhance>
							<input type="hidden" name="ticketId" value={t.id} />
							<button class="rounded-md p-1 text-neutral-400 transition-colors hover:text-red-600" aria-label="Remove"><Trash2 size={13} /></button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<form method="POST" action="?/addTicket" use:enhance class="flex items-end gap-2">
			<Field label="Ticket #"><Input name="number" type="number" min="1" placeholder="42" class="w-24 font-mono" /></Field>
			<Button variant="default" type="submit"><Plus size={14} /> Add</Button>
		</form>
		{#if f?.error}<p class="mt-2 text-sm text-red-600">{f.error}</p>{/if}
	</section>

	<!-- Danger -->
	<section class="mt-6">
		<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm('Delete this release?')) e.preventDefault(); }}>
			<Button variant="danger" type="submit"><Trash2 size={14} /> Delete release</Button>
		</form>
	</section>
</div>
