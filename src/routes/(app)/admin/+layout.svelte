<script lang="ts">
	import { page } from '$app/state';
	import { Users, Palette, Bell, ShieldCheck, Plug, KeyRound, DatabaseBackup } from '@lucide/svelte';
	import SettingsShell from '$lib/components/app/SettingsShell.svelte';

	let { children } = $props();

	const items = [
		{ label: 'Users', icon: Users, href: '/admin/users' },
		{ label: 'Landing page', icon: Palette, href: '/admin/appearance' },
		{ label: 'Notifications', icon: Bell, href: '/admin/notifications' },
		{ label: 'Sign-in & OAuth', icon: ShieldCheck, href: '/admin/privacy' },
		{ label: 'Integrations', icon: Plug, href: '/admin/integrations' },
		{ label: 'API tokens', icon: KeyRound, href: '/admin/api-tokens' },
		{ label: 'Backups', icon: DatabaseBackup, href: '/admin/backups' }
	];
</script>

<SettingsShell
	scope="instance"
	{items}
	active={page.url.pathname}
	backHref="/dashboard"
	backLabel="Back to app"
	title="Admin"
>
	{@render children()}
</SettingsShell>
