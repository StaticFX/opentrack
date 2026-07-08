<script lang="ts">
	import { enhance } from '$app/forms';
	import { HardDrive, Cloud, Check, TriangleAlert } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const s = $derived(data.storage);
</script>

<svelte:head><title>Storage · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 class="text-xl font-semibold tracking-tight">Storage</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Where uploaded attachments are stored. Defaults to local disk; point it at any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO).</p>
	</header>

	<div class="mb-5 flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
		{#if s.active}
			<Cloud size={20} class="text-brand-600" />
			<div><div class="text-sm font-medium">S3 is the active backend</div><div class="text-xs text-neutral-500">New uploads go to your bucket.</div></div>
			<span class="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300"><Check size={11} /> Active</span>
		{:else}
			<HardDrive size={20} class="text-neutral-500" />
			<div><div class="text-sm font-medium">Local disk (default)</div><div class="text-xs text-neutral-500">Attachments are written to the data volume.</div></div>
			{#if s.configured}<span class="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800">S3 configured, not enabled</span>{/if}
		{/if}
	</div>

	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-1 flex items-center gap-2 text-sm font-semibold"><Cloud size={15} /> S3-compatible storage</h2>
		<p class="mb-4 text-sm text-neutral-500">R2: region <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">auto</code> + endpoint <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">https://&lt;account&gt;.r2.cloudflarestorage.com</code>. MinIO: set the endpoint and enable path-style.</p>

		{#if f?.error}<p class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.error}</p>{/if}
		{#if f?.saved}<p class="mb-3 text-sm text-green-600">Saved.</p>{/if}

		<form method="POST" action="?/saveStorage" use:enhance class="space-y-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<Field label="Bucket"><Input name="bucket" value={s.bucket} placeholder="opentrack" /></Field>
				<Field label="Region"><Input name="region" value={s.region} placeholder="auto" /></Field>
			</div>
			<Field label="Endpoint" hint="Leave blank for AWS S3."><Input name="endpoint" value={s.endpoint} placeholder="https://<account>.r2.cloudflarestorage.com" /></Field>
			<div class="grid gap-3 sm:grid-cols-2">
				<Field label="Access key ID"><Input name="accessKeyId" value={s.accessKeyId} placeholder="access key id" /></Field>
				<Field label="Secret access key"><Input name="secretAccessKey" type="password" placeholder={s.hasSecret ? '•••••• (leave blank to keep)' : 'secret access key'} /></Field>
			</div>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="forcePathStyle" checked={s.forcePathStyle} class="size-4 accent-brand-600" /> Force path-style URLs <span class="text-xs text-neutral-400">(needed for MinIO)</span></label>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="s3Enabled" checked={s.s3Enabled} class="size-4 accent-brand-600" /> Use S3 for new uploads</label>

			<div class="flex items-center gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
				<Button size="sm" variant="primary" type="submit">Save</Button>
				<button type="submit" formaction="?/testStorage" class="text-xs text-brand-600 hover:underline">Test connection</button>
				{#if f?.tested}<span class="flex items-center gap-1 text-sm text-green-600"><Check size={13} /> Connected</span>{/if}
				{#if f?.testError}<span class="flex items-center gap-1 text-sm text-red-600"><TriangleAlert size={13} /> {f.testError}</span>{/if}
			</div>
		</form>

		{#if s.configured}
			<p class="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
				Switching the backend only affects <strong>new</strong> uploads — existing files keep the backend they were stored with. Disabling S3 while S3 objects exist still needs these credentials to serve them.
			</p>
		{/if}
	</section>
</div>
