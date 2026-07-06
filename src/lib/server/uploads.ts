import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$lib/server/env';

/** Hard cap on a single uploaded file. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Keep a filename safe for the filesystem + URLs; never empty. */
export function sanitizeFilename(name: string): string {
	const cleaned = name
		.replace(/[/\\]/g, '_')
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/^\.+/, '')
		.slice(0, 120);
	return cleaned || 'file';
}

/**
 * Persist bytes under `<uploadsDir>/<uuid>/<safe-name>` and return the storage
 * key (`<uuid>/<safe-name>`). The uuid prefix prevents collisions + traversal.
 */
export async function saveUpload(filename: string, bytes: Buffer): Promise<string> {
	const id = randomUUID();
	const safe = sanitizeFilename(filename);
	const dir = join(env.uploadsDir, id);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, safe), bytes);
	return `${id}/${safe}`;
}

/** Absolute path for a stored key (keys are app-generated, not user input). */
export function uploadPath(storageKey: string): string {
	return join(env.uploadsDir, storageKey);
}

export async function readUpload(storageKey: string): Promise<Buffer> {
	return readFile(uploadPath(storageKey));
}

export async function deleteUpload(storageKey: string): Promise<void> {
	await unlink(uploadPath(storageKey)).catch(() => {});
}
