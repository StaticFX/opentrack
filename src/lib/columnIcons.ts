import {
	Ban,
	Bug,
	Circle,
	CircleCheck,
	CircleCheckBig,
	CircleDashed,
	CircleDot,
	Clock,
	Flag,
	GitPullRequest,
	Inbox,
	Lightbulb,
	Package,
	Play,
	Rocket,
	Star,
	Timer,
	TriangleAlert
} from '@lucide/svelte';
import type { Component } from 'svelte';

type IconProps = { size?: number | string; class?: string; color?: string };

/** Curated set of column icons (lucide), keyed by the value stored on the column. */
export const COLUMN_ICONS: Record<string, Component<IconProps>> = {
	inbox: Inbox,
	circle: Circle,
	'circle-dot': CircleDot,
	'circle-dashed': CircleDashed,
	'circle-check': CircleCheck,
	'circle-check-big': CircleCheckBig,
	timer: Timer,
	clock: Clock,
	play: Play,
	ban: Ban,
	flag: Flag,
	star: Star,
	'triangle-alert': TriangleAlert,
	'git-pull-request': GitPullRequest,
	rocket: Rocket,
	package: Package,
	bug: Bug,
	lightbulb: Lightbulb
};

export const COLUMN_ICON_KEYS = Object.keys(COLUMN_ICONS);
