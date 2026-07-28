import { channels, publish } from './index';

/**
 * Publish a project-scoped realtime event (suggestion created/voted, …).
 * Consumed by the public overview's SSE stream; best-effort like boardEvent.
 */
export function projectEvent(
	projectId: string,
	type: string,
	data: Record<string, unknown> = {},
	origin?: string
): Promise<void> {
	return publish(channels.project(projectId), { type, data, origin });
}
