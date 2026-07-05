<script lang="ts">
	import { enhance } from '$app/forms';
	import { Palette, ExternalLink } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

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
</script>

<svelte:head><title>Appearance · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Appearance</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Customize the public landing page (<code class="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">/</code>).</p>
	</header>

	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<div class="mb-1 flex items-center justify-between">
			<h2 class="flex items-center gap-2 text-sm font-semibold"><Palette size={15} /> Landing page</h2>
			<a href="/" target="_blank" rel="noreferrer" class="flex items-center gap-1 text-xs text-brand-600 hover:underline"><ExternalLink size={12} /> View</a>
		</div>
		<p class="mb-4 text-sm text-neutral-500">Shown to visitors on the instance home page and in the public header. Leave a field blank to use the default.</p>

		<form
			method="POST"
			action="?/saveSite"
			use:enhance={() => async ({ update }) => { await update({ reset: false }); }}
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
			<div class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
				<div class="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
					<span class="grid size-6 place-items-center rounded-md bg-brand-600 text-[10px] font-bold text-white">{badge}</span>
					<span class="text-sm font-semibold tracking-tight">{shownName}</span>
				</div>
				<div class="px-4 py-5">
					<p class="text-2xl font-bold tracking-tight">{shownHeadline}</p>
					<p class="mt-1.5 text-sm text-neutral-500">{shownTagline}</p>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<Button variant="primary" type="submit">Save</Button>
				{#if f?.savedSite}<span class="text-sm text-green-600">Saved</span>{/if}
			</div>
		</form>
	</section>
</div>
