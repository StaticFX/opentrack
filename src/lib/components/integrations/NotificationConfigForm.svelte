<script lang="ts">
	import { Check, Send } from '@lucide/svelte';
	import { NOTIFICATION_EVENTS } from '$lib/integrations/events';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	type State = { installed: boolean; enabled: boolean; hasWebhook: boolean; events: string[] };

	let {
		projectId,
		providerKey,
		providerName,
		placeholder,
		setupHint,
		initial
	}: {
		projectId: string;
		providerKey: string;
		providerName: string;
		placeholder: string;
		setupHint: string;
		initial: State;
	} = $props();

	let local = $state<State>({ ...initial, events: [...initial.events] });
	let webhookUrl = $state('');
	let busy = $state(false);
	let msg = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

	const base = $derived(`/api/projects/${projectId}/integrations/${providerKey}`);

	function toggleEvent(key: string, on: boolean) {
		local.events = on ? [...new Set([...local.events, key])] : local.events.filter((e) => e !== key);
	}

	async function save() {
		busy = true;
		msg = null;
		try {
			const res = await fetch(base, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					enabled: local.enabled,
					events: local.events,
					...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {})
				})
			});
			if (!res.ok) {
				msg = { kind: 'err', text: (await res.json().catch(() => ({})))?.message ?? 'Could not save.' };
				return;
			}
			const s = ((await res.json()).state ?? local) as State;
			local = { ...s, events: [...s.events] };
			webhookUrl = '';
			msg = { kind: 'ok', text: 'Saved.' };
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		msg = null;
		try {
			const res = await fetch(`${base}/test`, { method: 'POST' });
			msg = res.ok
				? { kind: 'ok', text: 'Test message sent — check your channel.' }
				: { kind: 'err', text: (await res.json().catch(() => ({})))?.message ?? 'Test failed.' };
		} finally {
			busy = false;
		}
	}

	async function remove() {
		busy = true;
		msg = null;
		try {
			await fetch(base, { method: 'DELETE' });
			local = { installed: false, enabled: false, hasWebhook: false, events: local.events };
			webhookUrl = '';
			msg = { kind: 'ok', text: 'Removed.' };
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<p class="text-sm text-neutral-500">{setupHint}</p>

	{#if msg}
		<p
			class={`rounded-lg p-2.5 text-sm ${msg.kind === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300'}`}
		>
			{msg.text}
		</p>
	{/if}

	<Field label="Webhook URL">
		<Input
			type="password"
			bind:value={webhookUrl}
			{placeholder}
		/>
	</Field>
	{#if local.hasWebhook}
		<p class="-mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
			<Check size={13} /> A webhook is configured. Leave blank to keep it.
		</p>
	{/if}

	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" bind:checked={local.enabled} class="size-4 accent-brand-600" />
		Enabled
	</label>

	<div>
		<span class="mb-2 block text-sm font-medium">Announce these events</span>
		<div class="flex flex-col gap-2">
			{#each NOTIFICATION_EVENTS as ev (ev.key)}
				<label class="flex items-start gap-2.5 text-sm">
					<input
						type="checkbox"
						checked={local.events.includes(ev.key)}
						onchange={(e) => toggleEvent(ev.key, (e.currentTarget as HTMLInputElement).checked)}
						class="mt-0.5 size-4 rounded border-neutral-300 accent-brand-600 dark:border-neutral-600"
					/>
					<span>
						<span class="font-medium">{ev.label}</span>
						<span class="block text-xs text-neutral-500">{ev.desc}</span>
					</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button variant="primary" onclick={save} disabled={busy}>Save</Button>
		{#if local.hasWebhook}
			<Button variant="default" onclick={test} disabled={busy}><Send size={14} /> Send test</Button>
			<Button variant="ghost" onclick={remove} disabled={busy}>Remove</Button>
		{/if}
	</div>
	<p class="text-xs text-neutral-400">{providerName} announcements are delivered in the background.</p>
</div>
