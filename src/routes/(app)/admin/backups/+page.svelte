<script lang="ts">
	import { enhance } from '$app/forms';
	import { DatabaseBackup, Download, RotateCcw, Trash2, Check, TriangleAlert, Cloud, HardDrive } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const cfg = $derived(data.config);

	let auto = $state(data.config.auto);
	let destination = $state(data.config.destination);

	const destOptions = $derived([
		{ value: 'local', label: 'Local disk' },
		...(data.config.s3Available ? [{ value: 's3', label: 'S3 bucket (offsite)' }] : [])
	]);

	function fmtSize(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}
	function fmtDate(d: string | Date): string {
		return new Date(d).toLocaleString();
	}
</script>

<svelte:head><title>Backups · Admin · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
	<header class="mb-6">
		<h1 class="flex items-center gap-2 text-xl font-semibold tracking-tight"><DatabaseBackup size={20} /> Backups</h1>
		<p class="mt-0.5 text-sm text-neutral-500">Snapshot the database and restore it if something goes wrong.</p>
	</header>

	{#if !data.supported}
		<p class="rounded-xl border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
			Integrated backups are available on SQLite deployments. This instance uses Postgres — use your database provider's backup tooling (e.g. <code class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">pg_dump</code>).
		</p>
	{:else}
		<!-- Schedule -->
		<section class="mb-5 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
			<h2 class="mb-3 text-sm font-semibold">Automatic backups</h2>
			<form method="POST" action="?/saveSchedule" use:enhance class="space-y-3">
				<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="auto" bind:checked={auto} class="size-4 accent-brand-600" /> Run automatic backups on a schedule</label>
				<div class="grid gap-3 sm:grid-cols-3">
					<Field label="Every (hours)"><Input name="intervalHours" type="number" value={String(cfg.intervalHours)} min="1" /></Field>
					<Field label="Keep (backups)" hint="older auto backups pruned"><Input name="retention" type="number" value={String(cfg.retention)} min="1" /></Field>
					<Field label="Store in"><Select name="destination" bind:value={destination} options={destOptions} /></Field>
				</div>
				{#if !data.config.s3Available}
					<p class="text-xs text-neutral-400">Configure S3 in <a href="/admin/integrations" class="text-brand-600 hover:underline">Integrations</a> to store backups offsite.</p>
				{/if}
				<div class="flex items-center gap-3">
					<Button size="sm" variant="primary" type="submit">Save schedule</Button>
					{#if f?.savedSchedule}<span class="text-sm text-green-600">Saved</span>{/if}
				</div>
			</form>
		</section>

		<!-- Manual -->
		<section class="mb-5 flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<form method="POST" action="?/backupNow" use:enhance>
				<Button size="sm" variant="primary" type="submit"><DatabaseBackup size={14} /> Back up now</Button>
			</form>
			<span class="text-xs text-neutral-500">Creates a snapshot immediately (stored in {destination === 's3' ? 'S3' : 'local disk'}).</span>
			{#if f?.created}<span class="ml-auto flex items-center gap-1 text-sm text-green-600"><Check size={13} /> Created</span>{/if}
			{#if f?.error}<span class="ml-auto flex items-center gap-1 text-sm text-red-600"><TriangleAlert size={13} /> {f.error}</span>{/if}
		</section>

		{#if f?.restoring}
			<p class="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
				<TriangleAlert size={14} class="mr-1 inline" /> Restore staged.
				{#if f.willRestart}The app is restarting to apply it — reload in ~20 seconds.{:else}Restart the server to apply it.{/if}
			</p>
		{/if}

		<!-- List -->
		<section class="rounded-xl border border-neutral-200 dark:border-neutral-800">
			<h2 class="border-b border-neutral-100 px-4 py-3 text-sm font-semibold dark:border-neutral-800">Backups</h2>
			{#if !data.backups.length}
				<p class="px-4 py-6 text-sm text-neutral-400">No backups yet.</p>
			{:else}
				<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
					{#each data.backups as b (b.id)}
						<li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
							<span class="shrink-0 text-neutral-400">
								{#if b.destination === 's3'}<Cloud size={15} />{:else}<HardDrive size={15} />{/if}
							</span>
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium">{b.filename}</div>
								<div class="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
									<span>{fmtDate(b.createdAt)}</span>
									{#if b.status === 'ok'}<span>· {fmtSize(b.size)}</span>{/if}
									<span class="rounded-full px-1.5 py-0.5 text-[10px] {b.kind === 'auto' ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'}">{b.kind}</span>
									{#if b.status === 'failed'}<span class="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600 dark:bg-red-950/40">failed{b.error ? `: ${b.error}` : ''}</span>{/if}
								</div>
							</div>
							{#if b.status === 'ok'}
								<div class="flex shrink-0 items-center gap-1">
									<a href={`/admin/backups/${b.id}/download`} class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Download" aria-label="Download"><Download size={15} /></a>
									<form method="POST" action="?/restore" use:enhance>
										<input type="hidden" name="id" value={b.id} />
										<button type="submit" class="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40" title="Restore" aria-label="Restore"
											onclick={(e) => !confirm(`Restore from “${b.filename}”?\n\nThis REPLACES the current database with this snapshot and restarts the app. The current DB is copied aside first, but all changes since this backup will be lost.`) && e.preventDefault()}><RotateCcw size={15} /></button>
									</form>
									<form method="POST" action="?/deleteBackup" use:enhance>
										<input type="hidden" name="id" value={b.id} />
										<button type="submit" class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Delete" aria-label="Delete"
											onclick={(e) => !confirm(`Delete backup “${b.filename}”?`) && e.preventDefault()}><Trash2 size={15} /></button>
									</form>
								</div>
							{:else}
								<form method="POST" action="?/deleteBackup" use:enhance>
									<input type="hidden" name="id" value={b.id} />
									<button type="submit" class="rounded-md p-1.5 text-neutral-400 hover:text-red-600" aria-label="Delete"><Trash2 size={15} /></button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
