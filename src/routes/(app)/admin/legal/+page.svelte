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

	// Init snapshot, used only to seed the $state fields below (seeding happens
	// once, so the init-time value is correct). discard() must NOT use this — it
	// reads the live loader data instead (see below).
	const imp = data.legal.impressum;

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

	// Privacy policy — blank means "render the generated template publicly".
	let datenschutz = $state(data.legal.datenschutz);

	// Cookie notice.
	let cookieEnabled = $state(data.legal.cookie.enabled);
	let cookieText = $state(data.legal.cookie.text);

	const shownCookieText = $derived(cookieText.trim() || data.cookieDefault);

	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let saving = $state(false);

	function loadTemplate() {
		datenschutz = data.datenschutzTemplate;
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
		datenschutz = data.legal.datenschutz;
		cookieEnabled = data.legal.cookie.enabled;
		cookieText = data.legal.cookie.text;
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
		Impressum (§ 5 DDG), Datenschutzerklärung (Art. 13 DSGVO) und Cookie-Hinweis — für einen
		abmahnsicheren öffentlichen Auftritt.
	</p>
</header>

{#if !data.legal.impressumConfigured}
	<div
		class="mb-6 flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-[13px] text-amber-200"
	>
		<span aria-hidden="true">⚠</span>
		<span>
			Impressum unvollständig. Für ein gültiges Impressum sind mindestens <strong>Anbieter</strong>,
			<strong>Anschrift</strong> und <strong>E-Mail</strong> erforderlich. Bis dahin zeigt die
			öffentliche Seite einen Platzhalter.
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
	<!-- ── Impressum ─────────────────────────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center justify-between border-b border-[var(--rule)] pb-3">
			<div class="flex items-center gap-2">
				<FileText size={15} class="text-[var(--dim)]" aria-hidden="true" />
				<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Impressum</h3>
			</div>
			<a
				href="/impressum"
				target="_blank"
				rel="noreferrer"
				class="mono-focus flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
				><ExternalLink size={12} aria-hidden="true" /> Ansehen</a
			>
		</div>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			Angaben gemäß § 5 DDG. Nicht benötigte Felder leer lassen — sie werden dann ausgeblendet.
		</p>

		<div class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Anbieter / Name" hint="Person oder Firma (Pflicht).">
					<Input name="provider" bind:value={provider} placeholder="Max Mustermann" />
				</Field>
				<Field label="E-Mail" hint="Direkter Kontakt (Pflicht).">
					<Input name="email" type="email" bind:value={email} placeholder="kontakt@example.com" />
				</Field>
			</div>
			<Field label="Anschrift" hint="Straße, PLZ + Ort, Land — je Zeile (Pflicht).">
				<Textarea name="address" bind:value={address} rows={3} placeholder={'Musterstraße 1\n12345 Musterstadt\nDeutschland'} />
			</Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Telefon" hint="Optional.">
					<Input name="phone" bind:value={phone} placeholder="+49 …" />
				</Field>
				<Field label="Vertreten durch" hint="Bei Firmen: Geschäftsführer / Vertretungsberechtigte.">
					<Input name="represented" bind:value={represented} placeholder="Geschäftsführer: …" />
				</Field>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Registereintrag" hint="z. B. Amtsgericht Musterstadt, HRB 12345.">
					<Input name="register" bind:value={register} placeholder="Amtsgericht …, HRB …" />
				</Field>
				<Field label="Umsatzsteuer-ID" hint="USt-IdNr. nach § 27 a UStG (optional).">
					<Input name="vatId" bind:value={vatId} placeholder="DE123456789" />
				</Field>
			</div>
			<Field
				label="Inhaltlich verantwortlich (§ 18 Abs. 2 MStV)"
				hint="Name + Anschrift der verantwortlichen Person, falls redaktionelle Inhalte."
			>
				<Input name="responsible" bind:value={responsible} placeholder="Max Mustermann, Anschrift wie oben" />
			</Field>
			<Field
				label="Zusatz (Markdown)"
				hint="Optional — z. B. Haftungsausschluss, Streitschlichtungs-Hinweis, EU-OS-Plattform-Link."
			>
				<Textarea name="extra" bind:value={extra} rows={4} placeholder={'## Haftung für Inhalte\n…'} />
			</Field>
		</div>
	</section>

	<!-- ── Datenschutz ───────────────────────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center justify-between border-b border-[var(--rule)] pb-3">
			<div class="flex items-center gap-2">
				<ScrollText size={15} class="text-[var(--dim)]" aria-hidden="true" />
				<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Datenschutzerklärung</h3>
			</div>
			<a
				href="/datenschutz"
				target="_blank"
				rel="noreferrer"
				class="mono-focus flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
				><ExternalLink size={12} aria-hidden="true" /> Ansehen</a
			>
		</div>
		<p class="mb-3 text-[13px] text-[var(--dim)]">
			Leer lassen = die automatisch generierte, auf OpenTrack zugeschnittene DSGVO-Vorlage wird
			öffentlich angezeigt. Zum Anpassen die Vorlage einfügen und editieren. <strong>Bitte vor
			Veröffentlichung prüfen</strong> — dies ist keine Rechtsberatung.
		</p>
		<div class="mb-3">
			<Button type="button" variant="ghost" size="sm" onclick={loadTemplate}>
				<RotateCcw size={13} aria-hidden="true" /> Vorlage einfügen
			</Button>
		</div>
		<Textarea
			name="datenschutz"
			bind:value={datenschutz}
			rows={14}
			class="font-mono text-[12px]"
			placeholder="Leer = generierte Vorlage wird angezeigt. Hier eigenen Text (Markdown) einfügen …"
		/>
	</section>

	<!-- ── Cookie-Hinweis ────────────────────────────────────────────────── -->
	<section>
		<div class="mb-4 flex items-center gap-2 border-b border-[var(--rule)] pb-3">
			<Cookie size={15} class="text-[var(--dim)]" aria-hidden="true" />
			<h3 class="mono-display text-[15px] tracking-tight text-[var(--text)]">Cookie-Hinweis</h3>
		</div>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			OpenTrack setzt nur technisch notwendige Cookies — ein informativer Hinweis genügt
			(§ 25 Abs. 2 TTDSG), keine Einwilligung nötig.
		</p>

		<Field label="Hinweis anzeigen">
			<Switch
				name="cookieEnabled"
				bind:checked={cookieEnabled}
				onchange={() => dirtyGuard.markDirty()}
				label="Banner beim ersten Besuch einblenden"
			/>
		</Field>

		<div class="mt-4">
			<Field label="Hinweistext" hint="Leer = Standardtext.">
				<Textarea name="cookieText" bind:value={cookieText} rows={3} placeholder={data.cookieDefault} />
			</Field>
		</div>

		<!-- Preview -->
		<div class="mt-4">
			<p class="mb-2 text-[11px] tracking-tight text-[var(--faint)]">Vorschau</p>
			<div class="border border-[var(--rule)] bg-[var(--raised)] p-3">
				{#if cookieEnabled}
					<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
						<p class="min-w-0 flex-1 text-[12px] text-[var(--dim)]">{shownCookieText}</p>
						<div class="flex shrink-0 items-center gap-2 text-[12px]">
							<span class="text-[var(--accent)] underline">Datenschutz</span>
							<span class="border border-[var(--accent)] px-2.5 py-1 text-[var(--accent)]">Verstanden</span>
						</div>
					</div>
				{:else}
					<p class="text-[12px] text-[var(--faint)]">Hinweis deaktiviert — kein Banner.</p>
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
