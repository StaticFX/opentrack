<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Users, ShieldCheck, Plug, Palette } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	const tabs = [
		{ href: '/admin/users', label: 'Users', icon: Users },
		{ href: '/admin/appearance', label: 'Appearance', icon: Palette },
		{ href: '/admin/privacy', label: 'Privacy', icon: ShieldCheck },
		{ href: '/admin/integrations', label: 'Integrations', icon: Plug }
	];
</script>

<aside
	class="flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40"
>
	<div class="p-2">
		<a
			href="/dashboard"
			class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
		>
			<ArrowLeft size={15} /> Back to app
		</a>
	</div>

	<div class="px-4 pt-3 pb-1">
		<h1 class="text-sm font-semibold tracking-tight">Admin</h1>
		<p class="text-xs text-neutral-500">Instance administration</p>
	</div>

	<nav class="flex-1 overflow-y-auto px-2 py-2">
		{#each tabs as tab (tab.href)}
			{@const active = page.url.pathname.startsWith(tab.href)}
			<a
				href={tab.href}
				class={cn(
					'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
					active
						? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
						: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
				)}
			>
				<tab.icon size={15} class="text-neutral-400" />
				{tab.label}
			</a>
		{/each}
	</nav>
</aside>
