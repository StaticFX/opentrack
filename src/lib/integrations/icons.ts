// Maps the catalog's semantic icon names to Lucide components, so the
// client-safe catalog stays UI-framework-agnostic.
import { Bell, GitBranch, GitMerge, HardDrive, Hash, KeyRound, MessageSquare, Plug } from '@lucide/svelte';
import type { Component } from 'svelte';

const ICONS: Record<string, Component> = {
	'git-branch': GitBranch,
	'git-merge': GitMerge,
	'message-square': MessageSquare,
	hash: Hash,
	bell: Bell,
	'key-round': KeyRound,
	'hard-drive': HardDrive,
	plug: Plug
};

export function iconFor(name: string): Component {
	return ICONS[name] ?? Plug;
}
