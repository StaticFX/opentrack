/** Client-safe workflow-rule catalog (shared by the settings UI + engine). */

export interface WorkflowTriggerDef {
	type: string;
	label: string;
	/** Config field the UI must collect, if any. */
	config?: 'column' | 'label' | 'days';
}
export interface WorkflowActionDef {
	type: string;
	label: string;
	config?: 'label' | 'user' | 'priority' | 'column' | 'text';
}
export interface WorkflowConditionDef {
	type: string;
	label: string;
	value: 'priority' | 'label';
}

export const WORKFLOW_TRIGGERS: WorkflowTriggerDef[] = [
	{ type: 'ticket.created', label: 'Ticket is created' },
	{ type: 'ticket.moved', label: 'Ticket moves to column', config: 'column' },
	{ type: 'ticket.labeled', label: 'Label is added', config: 'label' },
	{ type: 'ticket.assigned', label: 'Assignee is added' },
	{ type: 'ticket.stale', label: 'No activity for N days', config: 'days' },
	{ type: 'ticket.due', label: 'Due date has passed' }
];

export const WORKFLOW_ACTIONS: WorkflowActionDef[] = [
	{ type: 'add_label', label: 'Add label', config: 'label' },
	{ type: 'assign', label: 'Assign user', config: 'user' },
	{ type: 'set_priority', label: 'Set priority', config: 'priority' },
	{ type: 'move_to_column', label: 'Move to column', config: 'column' },
	{ type: 'post_comment', label: 'Post comment', config: 'text' },
	{ type: 'notify_watchers', label: 'Notify watchers' },
	{ type: 'close', label: 'Close ticket' }
];

export const WORKFLOW_CONDITIONS: WorkflowConditionDef[] = [
	{ type: 'priority', label: 'Priority is', value: 'priority' },
	{ type: 'has_label', label: 'Has label', value: 'label' }
];

export interface WorkflowRule {
	id: string;
	name: string;
	enabled: boolean;
	trigger: { type: string; config: Record<string, unknown> };
	conditions: Array<{ type: string; value: string }>;
	actions: Array<{ type: string; config: Record<string, unknown> }>;
}

export const isTimeTrigger = (type: string): boolean => type === 'ticket.stale' || type === 'ticket.due';
