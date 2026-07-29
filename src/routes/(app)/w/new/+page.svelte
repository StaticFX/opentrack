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
	<h1 class="mono-display text-xl tracking-tight text-[var(--text)]">Create a workspace</h1>
	<p class="mt-0.5 text-[13px] text-[var(--dim)]">
		A workspace groups related projects. You'll be its owner.
	</p>

	<form method="POST" use:enhance class="mt-8 flex flex-col gap-5 border-t border-[var(--rule)] pt-6">
		<Field label="Name" error={form?.error}>
			<Input name="name" placeholder="Acme Mods" value={form?.name ?? ''} required autofocus />
		</Field>

		<Field label="Visibility">
			<input type="hidden" name="visibility" value={visibility} />
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (visibility = 'public')}
					class={`focus-ring flex flex-col items-start gap-1 rounded-[3px] border p-3 text-left transition-colors ${visibility === 'public' ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]' : 'border-[var(--rule)]'}`}
				>
					<Globe size={16} class="text-[var(--faint)]" />
					<span class="text-[13px] font-medium text-[var(--text)]">Public</span>
					<span class="text-[11px] text-[var(--faint)]">Anyone can browse it</span>
				</button>
				<button
					type="button"
					onclick={() => (visibility = 'private')}
					class={`focus-ring flex flex-col items-start gap-1 rounded-[3px] border p-3 text-left transition-colors ${visibility === 'private' ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]' : 'border-[var(--rule)]'}`}
				>
					<Lock size={16} class="text-[var(--faint)]" />
					<span class="text-[13px] font-medium text-[var(--text)]">Private</span>
					<span class="text-[11px] text-[var(--faint)]">Only members can see it</span>
				</button>
			</div>
		</Field>

		<div class="flex gap-2">
			<Button variant="primary" type="submit">Create workspace</Button>
			<Button variant="ghost" href="/dashboard">Cancel</Button>
		</div>
	</form>
</div>
