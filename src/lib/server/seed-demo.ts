import { count } from 'drizzle-orm';
import type { Priority } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import type { SessionUser } from '$lib/server/auth/session';
import { getBoardColumns, listBoards } from '$lib/server/services/boards';
import { createLabel } from '$lib/server/services/labels';
import { createProject } from '$lib/server/services/projects';
import { addLink, createRelease } from '$lib/server/services/releases';
import { createSuggestion } from '$lib/server/services/suggestions';
import { createTicket, setLabel } from '$lib/server/services/tickets';
import { createWorkspace } from '$lib/server/services/workspaces';

/** Create a demo workspace/project with sample data — only when none exist. */
export async function seedDemo(owner: SessionUser): Promise<void> {
	const [{ c }] = await db.select({ c: count() }).from(schema.workspaces);
	if (Number(c) > 0) {
		console.log('[seed] workspaces already exist — skipping demo data.');
		return;
	}

	const ws = await createWorkspace(owner, { name: 'Demo', visibility: 'public' });
	const project = await createProject(owner, { ...ws }, {
		name: 'Sample App',
		description: 'A demo project to explore OpenTrack.',
		color: '#6366f1',
		visibility: 'inherit'
	});

	const [board] = await listBoards(project.id);
	const cols = await getBoardColumns(board.id);
	const byCat = (cat: string) => cols.find((c) => c.category === cat) ?? cols[0];
	const bug = await createLabel(project.id, { name: 'bug', color: '#ef4444' });
	const feature = await createLabel(project.id, { name: 'feature', color: '#22c55e' });

	const seeds: Array<{ cat: string; title: string; priority: Priority; label?: string }> = [
		{ cat: 'todo', title: 'Add dark mode toggle', priority: 'medium', label: feature.id },
		{ cat: 'in_progress', title: 'Fix login redirect loop', priority: 'high', label: bug.id },
		{ cat: 'backlog', title: 'Write onboarding docs', priority: 'low' },
		{ cat: 'done', title: 'Set up CI pipeline', priority: 'none', label: feature.id },
		{ cat: 'todo', title: 'Improve mobile layout', priority: 'medium' }
	];
	for (const s of seeds) {
		const t = await createTicket(owner, {
			projectId: project.id,
			boardId: board.id,
			columnId: byCat(s.cat).id,
			title: s.title,
			priority: s.priority
		});
		if (s.label) await setLabel(t.id, s.label, true);
	}

	await createSuggestion(owner, project.id, {
		title: 'Support Discord notifications',
		body: 'It would be great to get pinged in Discord when things change.'
	});
	await createSuggestion(owner, project.id, {
		title: 'Keyboard shortcuts',
		body: 'Power users would love shortcuts for navigating the board.'
	});

	const rel = await createRelease(project.id, {
		version: 'v1.0.0',
		name: 'First release',
		notes: '### Highlights\n- Initial public launch\n- Kanban boards, suggestions, releases',
		status: 'published'
	});
	await addLink(rel, { label: 'Download', url: 'https://example.com/download', type: 'download' });

	console.log('[seed] demo workspace "Demo" created with sample data.');
}
