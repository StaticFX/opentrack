<script lang="ts">
	import { enhance } from '$app/forms';
	import { Download, RotateCcw, Trash2, TriangleAlert, Cloud, HardDrive } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	const cfg = $derived(data.config);

	let auto = $state(data.config.auto);
	let intervalHours = $state(String(data.config.intervalHours));
	let retention = $state(String(data.config.retention));
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

	const scheduleDirty = createDirtyGuard();
	const scheduleDirtyState = scheduleDirty.dirty;
	const schedulePending = scheduleDirty.pending;
	let savingSchedule = $state(false);

	function discardSchedule() {
		auto = data.config.auto;
		intervalHours = String(data.config.intervalHours);
		retention = String(data.config.retention);
		destination = data.config.destination;
		scheduleDirty.markClean();
	}

	// Destruction Tier 2/3 — the pending action lives on the real per-row form;
	// the button just intercepts the click to gate submission behind a dialog.
	let confirmOpen = $state(false);
	let confirmKind = $state<'delete' | 'restore' | null>(null);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let confirmFilename = $state('');
	let typedFilename = $state('');
	const restoreDisabled = $derived(confirmKind === 'restore' && typedFilename !== confirmFilename);

	function askDelete(e: MouseEvent, filename: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmFilename = filename;
		confirmKind = 'delete';
		confirmOpen = true;
	}
	function askRestore(e: MouseEvent, filename: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmFilename = filename;
		typedFilename = '';
		confirmKind = 'restore';
		confirmOpen = true;
	}
	function confirmDestructive() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
		if (confirmKind === 'delete') toast('Backup deleted.', { tone: 'success' });
	}
	$effect(() => {
		if (!confirmOpen) typedFilename = '';
	});

	$effect(() => {
		if (f?.savedSchedule) {
			scheduleDirty.markClean();
			toast('Backup schedule saved.', { tone: 'success' });
		} else if (f?.created) {
			toast(`Backup “${f.created}” created.`, { tone: 'success' });
		}
	});
</script>

<svelte:head><title>Backups · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Backups</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">Snapshot the database and restore it if something goes wrong.</p>
</header>

{#if !data.supported}
	<p class="border border-[var(--rule)] p-5 text-[13px] text-[var(--dim)]">
		Integrated backups are available on SQLite deployments. This instance uses Postgres — use your database provider's backup tooling (e.g. <code class="bg-[var(--raised)] px-1 text-[var(--text)]">pg_dump</code>).
	</p>
{:else}
	<!-- Schedule -->
	<section class="mb-8 border-t border-[var(--rule)] pt-6">
		<h3 class="mono-display text-[13px] text-[var(--text)]">Automatic backups</h3>
		<form
			method="POST"
			action="?/saveSchedule"
			use:enhance={() => async ({ update }) => {
				savingSchedule = true;
				await update();
				savingSchedule = false;
			}}
			oninput={() => scheduleDirty.markDirty()}
			class="mt-3 space-y-3"
		>
			<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="auto" bind:checked={auto} class="size-4 accent-[var(--accent)]" /> Run automatic backups on a schedule</label>
			<div class="grid gap-3 sm:grid-cols-3">
				<Field label="Every (hours)"><Input name="intervalHours" type="number" bind:value={intervalHours} min="1" /></Field>
				<Field label="Keep (backups)" hint="older auto backups pruned"><Input name="retention" type="number" bind:value={retention} min="1" /></Field>
				<Field label="Store in"><Select name="destination" bind:value={destination} options={destOptions} /></Field>
			</div>
			{#if !data.config.s3Available}
				<p class="text-[12px] text-[var(--faint)]">Configure S3 in <a href="/admin/integrations" class="text-[var(--accent)] hover:underline">Integrations</a> to store backups offsite.</p>
			{:else if data.bucketVisibility === 'public'}
				<p class="flex items-start gap-2 border border-[color-mix(in_srgb,#f85149_35%,transparent)] bg-[color-mix(in_srgb,#f85149_10%,transparent)] p-3 text-[12px] text-[#f85149]">
					<TriangleAlert size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
					<span>The configured S3 bucket appears to be <strong>publicly readable</strong>. A backup contains your entire database — do <strong>not</strong> store backups in a public bucket. Make it private first.</span>
				</p>
			{:else if data.bucketVisibility === 'unknown' && destination === 's3'}
				<p class="text-[12px] text-[var(--amber)]">Couldn't verify the bucket's visibility — make sure it's private before relying on S3 backups.</p>
			{/if}
			<div><Button size="sm" variant="primary" type="submit">Save schedule</Button></div>
			<SaveBar dirty={$scheduleDirtyState} saving={savingSchedule} onDiscard={discardSchedule} />
		</form>
	</section>

	<!-- Manual -->
	<section class="mb-8 flex items-center gap-3 border-t border-[var(--rule)] pt-6">
		<form method="POST" action="?/backupNow" use:enhance>
			<Button size="sm" variant="primary" type="submit">Back up now</Button>
		</form>
		<span class="text-[12px] text-[var(--faint)]">Creates a snapshot immediately (stored in {destination === 's3' ? 'S3' : 'local disk'}).</span>
		{#if f?.error}<span class="ml-auto flex items-center gap-1 text-[13px] text-[#f85149]"><TriangleAlert size={13} aria-hidden="true" /> {f.error}</span>{/if}
	</section>

	{#if f?.restoring}
		<p class="mb-8 border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] p-4 text-[13px] font-medium text-[var(--amber)]">
			<TriangleAlert size={14} class="mr-1 inline" aria-hidden="true" /> Restore staged.
			{#if f.willRestart}The app is restarting to apply it — reload in ~20 seconds.{:else}Restart the server to apply it.{/if}
		</p>
	{/if}

	<!-- List -->
	<section class="border-t border-[var(--rule)] pt-6">
		<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Backups</p>
		{#if !data.backups.length}
			<p class="text-[13px] text-[var(--faint)]">No backups yet.</p>
		{:else}
			<ul class="border-t border-[var(--rule)]">
				{#each data.backups as b (b.id)}
					<li class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--rule)] py-3 text-[13px]">
						<span class="shrink-0 text-[var(--faint)]">
							{#if b.destination === 's3'}<Cloud size={15} aria-hidden="true" />{:else}<HardDrive size={15} aria-hidden="true" />{/if}
						</span>
						<div class="min-w-0 flex-1">
							<div class="truncate font-medium text-[var(--text)]">{b.filename}</div>
							<div class="flex flex-wrap items-center gap-2 text-[12px] text-[var(--faint)]">
								<span class="data-mono">{fmtDate(b.createdAt)}</span>
								{#if b.status === 'ok'}<span class="data-mono">· {fmtSize(b.size)}</span>{/if}
								<Badge tone={b.kind === 'auto' ? 'neutral' : 'violet'}>{b.kind}</Badge>
								{#if b.status === 'failed'}<Badge tone="red">failed{b.error ? `: ${b.error}` : ''}</Badge>{/if}
							</div>
						</div>
						{#if b.status === 'ok'}
							<div class="flex shrink-0 items-center gap-1">
								<a href={`/admin/backups/${b.id}/download`} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" title="Download" aria-label="Download"><Download size={15} aria-hidden="true" /></a>
								<form method="POST" action="?/restore" use:enhance>
									<input type="hidden" name="id" value={b.id} />
									<button type="submit" onclick={(e) => askRestore(e, b.filename)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--amber)] transition-colors hover:bg-[color-mix(in_srgb,var(--amber)_12%,transparent)]" title="Restore" aria-label="Restore"><RotateCcw size={15} aria-hidden="true" /></button>
								</form>
								<form method="POST" action="?/deleteBackup" use:enhance>
									<input type="hidden" name="id" value={b.id} />
									<button type="submit" onclick={(e) => askDelete(e, b.filename)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]" title="Delete" aria-label="Delete"><Trash2 size={15} aria-hidden="true" /></button>
								</form>
							</div>
						{:else}
							<form method="POST" action="?/deleteBackup" use:enhance>
								<input type="hidden" name="id" value={b.id} />
								<button type="submit" onclick={(e) => askDelete(e, b.filename)} class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:text-[#f85149]" aria-label="Delete"><Trash2 size={15} aria-hidden="true" /></button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<Dialog
	bind:open={() => $schedulePending, (v) => { if (!v) scheduleDirty.stay(); }}
	title="Discard changes?"
	description="You have unsaved edits. Leaving now will discard them."
>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => scheduleDirty.stay()}>Keep editing</Button>
		<Button variant="danger" type="button" onclick={() => scheduleDirty.discard()}>Discard</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={confirmOpen}
	title={confirmKind === 'restore' ? `Restore from “${confirmFilename}”?` : `Delete “${confirmFilename}”?`}
	description={confirmKind === 'restore'
		? 'This replaces the current database with this snapshot and restarts the app. The current DB is copied aside first, but all changes since this backup will be lost.'
		: 'This permanently removes the backup file.'}
>
	{#if confirmKind === 'restore'}
		<p class="mb-2 text-[13px] text-[var(--dim)]">
			Type <span class="font-semibold text-[var(--text)]">{confirmFilename}</span> to confirm.
		</p>
		<Input bind:value={typedFilename} placeholder={confirmFilename} autocomplete="off" />
	{/if}
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" disabled={restoreDisabled} onclick={confirmDestructive}>
			{confirmKind === 'restore' ? 'Restore' : 'Delete'}
		</Button>
	{/snippet}
</Dialog>
