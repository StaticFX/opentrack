<script lang="ts">
	import { Check, Send, Trash2 } from '@lucide/svelte';
	import { NOTIFICATION_EVENTS } from '$lib/integrations/events';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ConfirmPopover from '$lib/components/ui/ConfirmPopover.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { toast } from '$lib/toast';

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

	const base = $derived(`/api/projects/${projectId}/integrations/${providerKey}`);

	function toggleEvent(key: string, on: boolean) {
		local.events = on ? [...new Set([...local.events, key])] : local.events.filter((e) => e !== key);
	}

	async function save() {
		busy = true;
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
				toast((await res.json().catch(() => ({})))?.message ?? 'Could not save.', { tone: 'error' });
				return;
			}
			const s = ((await res.json()).state ?? local) as State;
			local = { ...s, events: [...s.events] };
			webhookUrl = '';
			toast(`${providerName} settings saved.`, { tone: 'success' });
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		try {
			const res = await fetch(`${base}/test`, { method: 'POST' });
			if (res.ok) toast('Test message sent — check your channel.', { tone: 'success' });
			else toast((await res.json().catch(() => ({})))?.message ?? 'Test failed.', { tone: 'error' });
		} finally {
			busy = false;
		}
	}

	// Destruction Tier 1: scoped, frequently-redone config — anchored one-click
	// confirm rather than a modal.
	async function remove() {
		busy = true;
		try {
			await fetch(base, { method: 'DELETE' });
			local = { installed: false, enabled: false, hasWebhook: false, events: local.events };
			webhookUrl = '';
			toast(`${providerName} webhook removed.`, { tone: 'success' });
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<p class="text-[13px] text-[var(--dim)]">{setupHint}</p>

	<Field label="Webhook URL">
		<Input type="password" bind:value={webhookUrl} {placeholder} />
	</Field>
	{#if local.hasWebhook}
		<p class="-mt-2 flex items-center gap-1.5 text-xs text-[var(--green)]">
			<Check size={13} /> A webhook is configured. Leave blank to keep it.
		</p>
	{/if}

	<label class="flex items-center gap-2 text-sm text-[var(--text)]">
		<Checkbox bind:checked={local.enabled} />
		Enabled
	</label>

	<div>
		<span class="mb-2 block text-sm font-medium text-[var(--text)]">Announce these events</span>
		<div class="flex flex-col gap-2">
			{#each NOTIFICATION_EVENTS as ev (ev.key)}
				<label class="flex items-start gap-2.5 text-sm text-[var(--text)]">
					<Checkbox
						checked={local.events.includes(ev.key)}
						onchange={(e) => toggleEvent(ev.key, (e.currentTarget as HTMLInputElement).checked)}
						class="mt-0.5"
					/>
					<span>
						<span class="font-medium">{ev.label}</span>
						<span class="block text-xs text-[var(--faint)]">{ev.desc}</span>
					</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button variant="accent" onclick={save} disabled={busy}>Save</Button>
		{#if local.hasWebhook}
			<Button variant="default" onclick={test} disabled={busy}><Send size={14} /> Send test</Button>
			<ConfirmPopover
				message={`Remove the ${providerName} webhook? Announcements to this channel stop immediately.`}
				onconfirm={remove}
			>
				{#snippet trigger(props)}
					<Button variant="ghost" type="button" {...props} disabled={busy}>
						<Trash2 size={14} /> Remove
					</Button>
				{/snippet}
			</ConfirmPopover>
		{/if}
	</div>
	<p class="text-xs text-[var(--faint)]">{providerName} announcements are delivered in the background.</p>
</div>
