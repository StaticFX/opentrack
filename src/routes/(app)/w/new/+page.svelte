<script lang="ts">
	import { enhance } from '$app/forms';
	import { Globe, Lock } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { form } = $props();
	let visibility = $state<'public' | 'private'>('public');
</script>

<svelte:head><title>New workspace · OpenTrack</title></svelte:head>

<div class="mx-auto max-w-lg px-4 py-8 sm:px-8 sm:py-12">
	<h1 class="text-xl font-semibold tracking-tight">Create a workspace</h1>
	<p class="mt-0.5 text-sm text-neutral-500">
		A workspace groups related projects. You'll be its owner.
	</p>

	<form method="POST" use:enhance class="mt-8 flex flex-col gap-5">
		<Field label="Name" error={form?.error}>
			<Input name="name" placeholder="Acme Mods" value={form?.name ?? ''} required autofocus />
		</Field>

		<Field label="Visibility">
			<input type="hidden" name="visibility" value={visibility} />
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (visibility = 'public')}
					class={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${visibility === 'public' ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}
				>
					<Globe size={16} class="text-neutral-500" />
					<span class="text-sm font-medium">Public</span>
					<span class="text-xs text-neutral-500">Anyone can browse it</span>
				</button>
				<button
					type="button"
					onclick={() => (visibility = 'private')}
					class={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${visibility === 'private' ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}
				>
					<Lock size={16} class="text-neutral-500" />
					<span class="text-sm font-medium">Private</span>
					<span class="text-xs text-neutral-500">Only members can see it</span>
				</button>
			</div>
		</Field>

		<div class="flex gap-2">
			<Button variant="primary" type="submit">Create workspace</Button>
			<Button variant="ghost" href="/dashboard">Cancel</Button>
		</div>
	</form>
</div>
