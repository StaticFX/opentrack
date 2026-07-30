<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, FileText, Cookie, ScrollText, RotateCcw } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	// Init snapshots, used only to seed the $state fields below (seeding happens
	// once). discard() reads the live loader data instead (see below). Seeding
	// from a plain const rather than `data.*` avoids the state_referenced_locally lint.
	const imp = data.legal.impressum;
	const ds = data.legal.datenschutz;
	const ck = data.legal.cookie;

	// Impressum — one $state per field so each binds independently.
	let provider = $state(imp.provider);
	let address = $state(imp.address);
	let email = $state(imp.email);
	let phone = $state(imp.phone);
	let represented = $state(imp.represented);
	let register = $state(imp.register);
	let vatId = $state(imp.vatId);
	let responsible = $state(imp.responsible);
	let extra = $state(imp.extra);

	// Privacy policy — blank means "render the generated template" (per language).
	let datenschutz = $state(ds.de);
	let datenschutzEn = $state(ds.en);

	// Cookie notice.
	let cookieEnabled = $state(ck.enabled);
	let cookieText = $state(ck.text);
	let cookieTextEn = $state(ck.textEn);

	const shownCookieText = $derived(cookieTextEn.trim() || data.cookieDefaultEn);

	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let saving = $state(false);

	function loadTemplateDe() {
		datenschutz = data.datenschutzTemplateDe;
		dirtyGuard.markDirty();
	}
	function loadTemplateEn() {
		datenschutzEn = data.datenschutzTemplateEn;
		dirtyGuard.markDirty();
	}

	function discard() {
		// Read the CURRENT loader data (reactive), not the init snapshot `imp` —
		// after a save the loader re-runs and holds the freshly-saved values.
		const i = data.legal.impressum;
		provider = i.provider;
		address = i.address;
		email = i.email;
		phone = i.phone;
		represented = i.represented;
		register = i.register;
		vatId = i.vatId;
		responsible = i.responsible;
		extra = i.extra;
		datenschutz = data.legal.datenschutz.de;
		datenschutzEn = data.legal.datenschutz.en;
		cookieEnabled = data.legal.cookie.enabled;
		cookieText = data.legal.cookie.text;
		cookieTextEn = data.legal.cookie.textEn;
		dirtyGuard.markClean();
	}

	$effect(() => {
		if (f?.saved) {
			dirtyGuard.markClean();
			toast('Legal settings saved.', { tone: 'success' });
		}
	});
</script>

<svelte:head><title>Legal · Admin · OpenTrack</title></svelte:head>

<header class="mb-6">
	<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Legal &amp; Compliance</h2>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">
		Legal notice (Impressum, § 5 DDG), privacy policy (Art. 13 GDPR) and cookie notice — shown
		bilingually (English default, German one click away) on the public site.
	</p>
</header>

{#if !data.legal.impressumConfigured}
	<div
		class="mb-6 flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[13px] text-amber-200"
	>
		<span aria-hidden="true">⚠</span>
		<span>
			Legal notice incomplete. A valid Impressum needs at least <strong>provider</strong>,
			<strong>address</strong> and <strong>email</strong>. Until then the public page shows a
			placeholder.
		</span>
	</div>
{/if}

<form
	method="POST"
	action="?/save"
	use:enhance={() => async ({ update }) => {
		saving = true;
		await update({ reset: false });
		saving = false;
	}}
	oninput={() => dirtyGuard.markDirty()}
	class="flex flex-col gap-10"
>
	<!-- ── Legal notice (Impressum) ──────────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center justify-between border-b border-[var(--rule)] pb-3">
			<div class="flex items-center gap-2">
				<FileText size={15} class="text-[var(--dim)]" aria-hidden="true" />
				<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Legal notice (Impressum)</h3>
			</div>
			<a
				href="/impressum"
				target="_blank"
				rel="noreferrer"
				class="mono-focus flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
				><ExternalLink size={12} aria-hidden="true" /> View</a
			>
		</div>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			Information pursuant to § 5 DDG. Leave fields you don't need blank — they are hidden. These
			values are language-neutral and shown on both the English and German page.
		</p>

		<div class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Provider / name" hint="Person or company (required).">
					<Input name="provider" bind:value={provider} placeholder="Max Mustermann" />
				</Field>
				<Field label="Email" hint="Direct contact (required).">
					<Input name="email" type="email" bind:value={email} placeholder="contact@example.com" />
				</Field>
			</div>
			<Field label="Address" hint="Street, ZIP + city, country — one per line (required).">
				<Textarea name="address" bind:value={address} rows={3} placeholder={'Musterstraße 1\n12345 Musterstadt\nGermany'} />
			</Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Phone" hint="Optional.">
					<Input name="phone" bind:value={phone} placeholder="+49 …" />
				</Field>
				<Field label="Represented by" hint="For companies: managing director(s) / authorised reps.">
					<Input name="represented" bind:value={represented} placeholder="Managing director: …" />
				</Field>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Register entry" hint="e.g. Amtsgericht Musterstadt, HRB 12345.">
					<Input name="register" bind:value={register} placeholder="Amtsgericht …, HRB …" />
				</Field>
				<Field label="VAT ID" hint="USt-IdNr. per § 27a UStG (optional).">
					<Input name="vatId" bind:value={vatId} placeholder="DE123456789" />
				</Field>
			</div>
			<Field
				label="Responsible for content (§ 18(2) MStV)"
				hint="Name + address of the responsible person, if editorial content."
			>
				<Input name="responsible" bind:value={responsible} placeholder="Max Mustermann, address as above" />
			</Field>
			<Field
				label="Extra (Markdown)"
				hint="Optional — e.g. liability disclaimer, dispute-resolution note, EU-ODR link."
			>
				<Textarea name="extra" bind:value={extra} rows={4} placeholder={'## Liability\n…'} />
			</Field>
		</div>
	</section>

	<!-- ── Privacy policy (Datenschutz) ──────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center justify-between border-b border-[var(--rule)] pb-3">
			<div class="flex items-center gap-2">
				<ScrollText size={15} class="text-[var(--dim)]" aria-hidden="true" />
				<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Privacy policy</h3>
			</div>
			<div class="flex items-center gap-3 text-[12px]">
				<a href="/datenschutz?lang=en" target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[var(--accent)] hover:underline"><ExternalLink size={12} aria-hidden="true" /> EN</a>
				<a href="/datenschutz?lang=de" target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[var(--accent)] hover:underline"><ExternalLink size={12} aria-hidden="true" /> DE</a>
			</div>
		</div>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			Leave a field blank to publish the auto-generated template for that language (tailored to
			OpenTrack's actual processing). <strong>Please review before publishing</strong> — this is
			not legal advice.
		</p>

		<div class="grid gap-6 lg:grid-cols-2">
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-[12px] font-medium text-[var(--text)]">English</span>
					<Button type="button" variant="ghost" size="sm" onclick={loadTemplateEn}>
						<RotateCcw size={13} aria-hidden="true" /> Insert template
					</Button>
				</div>
				<Textarea
					name="datenschutzEn"
					bind:value={datenschutzEn}
					rows={12}
					class="font-mono text-[12px]"
					placeholder="Blank = generated English template is shown. Paste your own Markdown here …"
				/>
			</div>
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-[12px] font-medium text-[var(--text)]">German (Deutsch)</span>
					<Button type="button" variant="ghost" size="sm" onclick={loadTemplateDe}>
						<RotateCcw size={13} aria-hidden="true" /> Vorlage einfügen
					</Button>
				</div>
				<Textarea
					name="datenschutz"
					bind:value={datenschutz}
					rows={12}
					class="font-mono text-[12px]"
					placeholder="Leer = generierte deutsche Vorlage wird angezeigt. Eigenes Markdown hier einfügen …"
				/>
			</div>
		</div>
	</section>

	<!-- ── Cookie notice ─────────────────────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center gap-2 border-b border-[var(--rule)] pb-3">
			<Cookie size={15} class="text-[var(--dim)]" aria-hidden="true" />
			<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Cookie notice</h3>
		</div>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			OpenTrack sets only strictly-necessary cookies — an informational notice is enough
			(§ 25(2) TTDSG), no consent required. The banner shows in the visitor's chosen language.
		</p>

		<Field label="Show notice">
			<Switch
				name="cookieEnabled"
				bind:checked={cookieEnabled}
				onchange={() => dirtyGuard.markDirty()}
				label="Show the banner on first visit"
			/>
		</Field>

		<div class="mt-4 grid gap-4 lg:grid-cols-2">
			<Field label="Notice text (English)" hint="Blank = default text.">
				<Textarea name="cookieTextEn" bind:value={cookieTextEn} rows={3} placeholder={data.cookieDefaultEn} />
			</Field>
			<Field label="Notice text (German)" hint="Blank = default text.">
				<Textarea name="cookieText" bind:value={cookieText} rows={3} placeholder={data.cookieDefault} />
			</Field>
		</div>

		<!-- Preview (English, the default language) -->
		<div class="mt-4">
			<p class="mb-2 text-[11px] tracking-tight text-[var(--faint)]">Preview (English)</p>
			<div class="border border-[var(--rule)] bg-[var(--raised)] p-3">
				{#if cookieEnabled}
					<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
						<p class="min-w-0 flex-1 text-[12px] text-[var(--dim)]">{shownCookieText}</p>
						<div class="flex shrink-0 items-center gap-2 text-[12px]">
							<span class="text-[var(--accent)] underline">privacy policy</span>
							<span class="border border-[var(--accent)] px-2.5 py-1 text-[var(--accent)]">Got it</span>
						</div>
					</div>
				{:else}
					<p class="text-[12px] text-[var(--faint)]">Notice disabled — no banner.</p>
				{/if}
			</div>
		</div>
	</section>

	<div><Button variant="primary" type="submit">Save</Button></div>
	<SaveBar dirty={$dirty} {saving} onDiscard={discard} />
</form>

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
