<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	let { data } = $props();
	const i = $derived(data.impressum);
</script>

<svelte:head><title>Impressum</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
	<p class="mono-display text-[11px] tracking-[0.2em] text-[var(--faint)]">RECHTLICHES</p>
	<h1 class="mono-display mt-1 text-3xl tracking-tight text-[var(--text)]">Impressum</h1>

	{#if data.configured}
		<p class="mt-6 text-[12px] tracking-tight text-[var(--faint)]">Angaben gemäß § 5 DDG</p>

		<div class="mt-6 space-y-6 text-[14px] leading-relaxed text-[var(--dim)]">
			<div>
				<p class="font-semibold text-[var(--text)]">{i.provider}</p>
				<p class="mt-1 whitespace-pre-line">{i.address}</p>
			</div>

			<div>
				<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">KONTAKT</p>
				<p class="mt-1">
					E-Mail: <a class="text-[var(--accent)] hover:underline" href={`mailto:${i.email}`}>{i.email}</a>
				</p>
				{#if i.phone}<p>Telefon: {i.phone}</p>{/if}
			</div>

			{#if i.represented}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">VERTRETEN DURCH</p>
					<p class="mt-1 whitespace-pre-line">{i.represented}</p>
				</div>
			{/if}

			{#if i.register}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">REGISTEREINTRAG</p>
					<p class="mt-1 whitespace-pre-line">{i.register}</p>
				</div>
			{/if}

			{#if i.vatId}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">
						UMSATZSTEUER-ID
					</p>
					<p class="mt-1">
						Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {i.vatId}
					</p>
				</div>
			{/if}

			{#if i.responsible}
				<div>
					<p class="mono-display text-[12px] tracking-tight text-[var(--faint)]">
						VERANTWORTLICH I.S.D. § 18 ABS. 2 MStV
					</p>
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
		<p class="mt-8 text-[14px] leading-relaxed text-[var(--dim)]">
			Für diese Seite wurde noch kein Impressum hinterlegt. Der Betreiber wird gebeten, die
			Angaben gemäß § 5 DDG im Admin-Bereich zu ergänzen.
		</p>
	{/if}
</main>
