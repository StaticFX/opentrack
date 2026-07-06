// Client-safe custom-field definitions shared by UI + server.
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'checkbox', 'date'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
	text: 'Text',
	number: 'Number',
	select: 'Select',
	checkbox: 'Checkbox',
	date: 'Date'
};

export interface CustomFieldDef {
	id: string;
	name: string;
	type: CustomFieldType;
	options: string[] | null;
}

export interface CustomFieldValue extends CustomFieldDef {
	value: string | null;
}
