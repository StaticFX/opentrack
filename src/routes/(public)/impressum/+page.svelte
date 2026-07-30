<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import LangToggle from '$lib/components/public/LangToggle.svelte';

	let { data } = $props();
	const i = $derived(data.impressum);

	// Labels per language — the Impressum *data* is language-neutral; only the
	// headings/fixed phrases differ.
	const t = $derived(
		data.lang === 'de'
			? {
					eyebrow: 'RECHTLICHES',
					title: 'Impressum',
					pursuant: 'Angaben gemäß § 5 DDG',
					contact: 'KONTAKT',
					emailLabel: 'E-Mail',
					phoneLabel: 'Telefon',
					represented: 'VERTRETEN DURCH',
					register: 'REGISTEREINTRAG',
					vat: 'UMSATZSTEUER-ID',
					vatLine: (v: string) => `Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: ${v}`,
					responsible: 'VERANTWORTLICH I.S.D. § 18 ABS. 2 MStV',
					empty:
						'Für diese Seite wurde noch kein Impressum hinterlegt. Der Betreiber wird gebeten, die Angaben gemäß § 5 DDG im Admin-Bereich zu ergänzen.'
				}
			: {
					eyebrow: 'LEGAL',
					title: 'Legal Notice',
					pursuant: 'Information pursuant to § 5 DDG (German Digital Services Act)',
					contact: 'CONTACT',
					emailLabel: 'Email',
					phoneLabel: 'Phone',
					represented: 'REPRESENTED BY',
					register: 'REGISTER ENTRY',
					vat: 'VAT ID',
					vatLine: (v: string) => `VAT identification number pursuant to § 27a UStG: ${v}`,
					responsible: 'RESPONSIBLE FOR CONTENT (§ 18(2) MStV)',
					empty:
						'No legal notice has been provided for this site yet. The operator is asked to add the details required under § 5 DDG in the admin area.'
				}
	);
</script>

<svelte:head><title>{t.title}</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="mono-display text-[11px] tracking-[0.2em] text-[var(--faint)]">{t.eyebrow}</p>
			<h1 class="mono-display mt-1 text-3xl tracking-tight text-[var(--text)]">{t.title}</h1>
		</div>
		<div class="pt-1"><LangToggle lang={data.lang} /></div>
	</div>

	{#if data.configured}
		<p class="mt-6 text-[12px] tracking-tight text-[var(--faint)]">{t.pursuant}</p>

		<div class="mt-6 space-y-6 text-[14px] leading-relaxed text-[var(--dim)]">
			<div>
				<p class="font-semibold text-[var(--text)]">{i.provider}</p>
				<p class="mt-1 whitespace-pre-line">{i.address}</p>
			</div>

			<div>
				<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">{t.contact}</p>
				<p class="mt-1">
					{t.emailLabel}:
					<a class="text-[var(--accent)] hover:underline" href={`mailto:${i.email}`}>{i.email}</a>
				</p>
				{#if i.phone}<p>{t.phoneLabel}: {i.phone}</p>{/if}
			</div>

			{#if i.represented}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">{t.represented}</p>
					<p class="mt-1 whitespace-pre-line">{i.represented}</p>
				</div>
			{/if}

			{#if i.register}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">{t.register}</p>
					<p class="mt-1 whitespace-pre-line">{i.register}</p>
				</div>
			{/if}

			{#if i.vatId}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">{t.vat}</p>
					<p class="mt-1">{t.vatLine(i.vatId)}</p>
				</div>
			{/if}

			{#if i.responsible}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">{t.responsible}</p>
					<p class="mt-1 whitespace-pre-line">{i.responsible}</p>
				</div>
			{/if}
		</div>

		{#if i.extra}
			<div class="prose prose-sm prose-invert mt-10 max-w-none border-t border-[var(--rule)] pt-8">
				{@html renderMarkdown(i.extra)}
			</div>
		{/if}
	{:else}
		<p class="mt-8 text-[14px] leading-relaxed text-[var(--dim)]">{t.empty}</p>
	{/if}
</main>
