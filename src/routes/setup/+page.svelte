<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound, ArrowLeft, ArrowRight, Loader2, ShieldCheck } from '@lucide/svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	let step = $state(1);
	let username = $state('');
	let code = $state('');
	let password = $state('');
	let confirm = $state('');
	let submitting = $state(false);

	// Bounce back to the right step when the server rejects the claim.
	$effect(() => {
		if (f?.field === 'account') step = 1;
		else if (f?.field === 'password') step = 2;
	});

	function next() {
		if (username.trim().length >= 2 && code.trim().length > 0) step = 2;
	}
</script>

<svelte:head><title>Set up OpenTrack</title></svelte:head>

<main class="grid min-h-screen place-items-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
	<div class="card w-full max-w-md">
		<div class="mb-6 text-center">
			<div class="badge mx-auto mb-4"><ShieldCheck size={26} /></div>
			<h1 class="text-xl font-bold tracking-tight">Welcome to OpenTrack</h1>
			<p class="mt-1 text-sm text-neutral-500">Create the first admin account to get started.</p>
		</div>

		<!-- Step dots -->
		<div class="mb-5 flex items-center justify-center gap-2">
			{#each [1, 2] as s (s)}
				<span class="h-1.5 rounded-full transition-all duration-300 {step === s ? 'w-6 bg-brand-600' : 'w-1.5 bg-neutral-300 dark:bg-neutral-700'}"></span>
			{/each}
		</div>

		{#if f?.error}
			<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">{f.error}</p>
		{/if}

		<form
			method="POST"
			action="?/claim"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<!-- Step 1: identity + setup code -->
			<div class="panel" class:hidden={step !== 1}>
				<label class="field">
					<span>Username</span>
					<input name="username" bind:value={username} autocomplete="username" placeholder="e.g. jordan" autofocus />
				</label>
				<label class="field">
					<span>Setup code</span>
					<input name="code" bind:value={code} autocomplete="one-time-code" placeholder="XXXX-XXXX" spellcheck="false" class="font-mono tracking-widest" />
					<small class="flex items-center gap-1 text-neutral-400"><KeyRound size={12} /> Printed in your server logs on first start.</small>
				</label>
				<button type="button" class="btn-primary mt-1" onclick={next} disabled={username.trim().length < 2 || !code.trim()}>
					Continue <ArrowRight size={16} />
				</button>
			</div>

			<!-- Step 2: choose a password -->
			<div class="panel" class:hidden={step !== 2}>
				<label class="field">
					<span>Password</span>
					<input name="password" type="password" bind:value={password} autocomplete="new-password" placeholder="At least 8 characters" />
				</label>
				<label class="field">
					<span>Confirm password</span>
					<input name="confirm" type="password" bind:value={confirm} autocomplete="new-password" placeholder="Re-enter your password" />
				</label>
				<div class="mt-1 flex gap-2">
					<button type="button" class="btn-ghost" onclick={() => (step = 1)}><ArrowLeft size={16} /> Back</button>
					<button type="submit" class="btn-primary flex-1" disabled={submitting}>
						{#if submitting}<Loader2 size={16} class="animate-spin" /> Creating…{:else}Create admin account{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</main>

<style>
	.card {
		border-radius: 1rem;
		border: 1px solid var(--card-border, #e5e7eb);
		background: var(--card-bg, #fff);
		padding: 1.75rem;
		box-shadow: 0 12px 40px -12px rgb(0 0 0 / 0.18);
		animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}
	:global(.dark) .card,
	:global(:root[data-theme='dark']) .card { --card-bg: #0a0a0a; --card-border: #262626; }
	@media (prefers-color-scheme: dark) {
		.card { --card-bg: #0a0a0a; --card-border: #262626; }
	}
	.badge {
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 0.9rem;
		color: #fff;
		background: linear-gradient(135deg, var(--color-brand-500, #6366f1), var(--color-brand-700, #4338ca));
		box-shadow: 0 8px 24px -8px var(--color-brand-600, #4f46e5);
		animation: pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
	}
	.panel { display: flex; flex-direction: column; gap: 0.9rem; animation: fade 0.35s ease; }
	.panel.hidden { display: none; }
	.field { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; font-weight: 500; }
	.field span { color: var(--muted, #6b7280); }
	.field input {
		border-radius: 0.6rem;
		border: 1px solid #d4d4d8;
		background: transparent;
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		font-weight: 400;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	:global(.dark) .field input { border-color: #3f3f46; }
	.field input:focus { outline: none; border-color: var(--color-brand-500, #6366f1); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand-500, #6366f1) 25%, transparent); }
	.field small { font-size: 0.72rem; font-weight: 400; }
	.btn-primary {
		display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
		border-radius: 0.6rem; background: var(--color-brand-600, #4f46e5); color: #fff;
		padding: 0.6rem 1rem; font-size: 0.9rem; font-weight: 600; border: none; cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}
	.btn-primary:hover { background: var(--color-brand-700, #4338ca); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost {
		display: inline-flex; align-items: center; gap: 0.3rem;
		border-radius: 0.6rem; padding: 0.6rem 0.9rem; font-size: 0.9rem; font-weight: 500;
		color: var(--muted, #6b7280); background: transparent; border: 1px solid transparent; cursor: pointer;
	}
	.btn-ghost:hover { color: inherit; }
	@keyframes rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
	@keyframes pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: none; } }
	@keyframes fade { from { opacity: 0; transform: translateX(6px); } to { opacity: 1; transform: none; } }
</style>
