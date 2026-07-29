<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	// Local state seeded from stored values; empty falls back to the built-in default.
	let name = $state(data.site.name ?? '');
	let headline = $state(data.site.headline ?? '');
	let tagline = $state(data.site.tagline ?? '');

	const shownName = $derived(name.trim() || data.defaults.name);
	const shownHeadline = $derived(headline.trim() || data.defaults.headline);
	const shownTagline = $derived(tagline.trim() || data.defaults.tagline);
	const badge = $derived((shownName.match(/[A-Z0-9]/g)?.slice(0, 2).join('') || shownName.slice(0, 2)).toUpperCase());

	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let saving = $state(false);

	function discard() {
		name = data.site.name ?? '';
		headline = data.site.headline ?? '';
		tagline = data.site.tagline ?? '';
		dirtyGuard.markClean();
	}

	$effect(() => {
		if (f?.savedSite) {
			dirtyGuard.markClean();
			toast('Landing page saved.', { tone: 'success' });
		}
	});
</script>

<svelte:head><title>Landing page · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Landing page</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">Copy shown to visitors on the instance home page.</p>
</header>

<section class="border-t border-[var(--rule)] pt-6">
	<div class="mb-4 flex items-center justify-between">
		<p class="text-[13px] text-[var(--dim)]">Leave a field blank to use the default.</p>
		<a href="/" target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"><ExternalLink size={12} aria-hidden="true" /> View</a>
	</div>

	<form
		method="POST"
		action="?/saveSite"
		use:enhance={() => async ({ update }) => {
			saving = true;
			await update({ reset: false });
			saving = false;
		}}
		oninput={() => dirtyGuard.markDirty()}
		class="flex flex-col gap-4"
	>
		<Field label="Site name" hint={`Header logo + browser title. Default: “${data.defaults.name}”.`}>
			<Input name="name" bind:value={name} placeholder={data.defaults.name} />
		</Field>
		<Field label="Headline" hint={`Default: “${data.defaults.headline}”.`}>
			<Input name="headline" bind:value={headline} placeholder={data.defaults.headline} />
		</Field>
		<Field label="Tagline" hint="Default: the standard intro line.">
			<Textarea name="tagline" bind:value={tagline} rows={2} placeholder={data.defaults.tagline} />
		</Field>

		<!-- Preview -->
		<div class="border border-[var(--rule)]">
			<div class="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--raised)] px-4 py-2.5">
				<span class="grid size-6 place-items-center rounded-[3px] bg-[var(--accent)] text-[10px] font-bold text-[var(--ground)]">{badge}</span>
				<span class="mono-display text-[13px] text-[var(--text)]">{shownName}</span>
			</div>
			<div class="px-4 py-5">
				<p class="mono-display text-2xl text-[var(--text)]">{shownHeadline}</p>
				<p class="mt-1.5 text-[13px] text-[var(--dim)]">{shownTagline}</p>
			</div>
		</div>

		<div><Button variant="primary" type="submit">Save</Button></div>
		<SaveBar dirty={$dirty} {saving} onDiscard={discard} />
	</form>
</section>

<Dialog
	bind:open={() => $pending, (v) => { if (!v) dirtyGuard.stay(); }}
	title="Discard changes?"
	description="You have unsaved edits. Leaving now will discard them."
>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => dirtyGuard.stay()}>Keep editing</Button>
		<Button variant="danger" type="button" onclick={() => dirtyGuard.discard()}>Discard</Button>
	{/snippet}
</Dialog>
