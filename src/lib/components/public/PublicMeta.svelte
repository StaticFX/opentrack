<script lang="ts">
	import { page } from '$app/state';

	// Per-page <title> + text-only OG/Twitter tags (no og:image — SVG isn't
	// supported by the big unfurlers and raster generation is out of scope).
	type Props = { title: string; description: string; type?: string };
	let { title, description, type = 'website' }: Props = $props();

	const url = $derived(page.url.origin + page.url.pathname);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />
	<meta name="twitter:card" content="summary" />
</svelte:head>
