import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	DeleteObjectCommand,
	GetBucketAclCommand,
	GetBucketPolicyStatusCommand,
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getConfig, type S3Config } from '$lib/server/config';
import { env } from '$lib/server/env';

/** Storage backend an object lives in. Recorded per attachment so switching the
 * active backend never orphans previously stored files. */
export type StorageDriver = 'local' | 's3';

/** Hard cap on a single uploaded file. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Keep a filename safe for the filesystem, URLs, and object keys; never empty. */
export function sanitizeFilename(name: string): string {
	const cleaned = name
		.replace(/[/\\]/g, '_')
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/^\.+/, '')
		.slice(0, 120);
	return cleaned || 'file';
}

// ── S3 client (cached while the resolved config is unchanged) ──────────────
let s3Cache: { sig: string; client: S3Client } | null = null;
function s3Client(cfg: S3Config): S3Client {
	const sig = `${cfg.endpoint ?? ''}|${cfg.region}|${cfg.accessKeyId}|${cfg.forcePathStyle}`;
	if (s3Cache?.sig === sig) return s3Cache.client;
	const client = new S3Client({
		region: cfg.region || 'auto',
		endpoint: cfg.endpoint || undefined,
		forcePathStyle: cfg.forcePathStyle,
		credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
	});
	s3Cache = { sig, client };
	return client;
}

/** The S3 config, or throw if a stored S3 object is referenced without creds. */
async function requireS3(): Promise<S3Config> {
	const { s3 } = (await getConfig()).storage;
	if (!s3) throw new Error('S3 storage is referenced but not configured');
	return s3;
}

function localPath(storageKey: string): string {
	return join(env.uploadsDir, storageKey);
}

/**
 * Persist bytes under an opaque key `<uuid>/<safe-name>` using the currently
 * active storage driver. Returns the key + the driver it was written to (store
 * both on the row so reads/deletes dispatch correctly later).
 */
export async function saveUpload(
	filename: string,
	bytes: Buffer,
	contentType?: string
): Promise<{ storageKey: string; driver: StorageDriver }> {
	const id = randomUUID();
	const safe = sanitizeFilename(filename);
	const storageKey = `${id}/${safe}`;
	const { driver, s3 } = (await getConfig()).storage;

	if (driver === 's3' && s3) {
		await s3Client(s3).send(
			new PutObjectCommand({
				Bucket: s3.bucket,
				Key: storageKey,
				Body: bytes,
				ContentType: contentType || 'application/octet-stream'
			})
		);
		return { storageKey, driver: 's3' };
	}

	const dir = join(env.uploadsDir, id);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, safe), bytes);
	return { storageKey, driver: 'local' };
}

/** Read an object's full bytes (used for local serving + backups). */
export async function readUpload(driver: StorageDriver, storageKey: string): Promise<Buffer> {
	if (driver === 's3') {
		const s3 = await requireS3();
		const res = await s3Client(s3).send(
			new GetObjectCommand({ Bucket: s3.bucket, Key: storageKey })
		);
		const arr = await res.Body!.transformToByteArray();
		return Buffer.from(arr);
	}
	return readFile(localPath(storageKey));
}

/** A presigned GET URL for an S3 object (to redirect the browser to), else null. */
export async function serveUrl(
	driver: StorageDriver,
	storageKey: string,
	opts: { mime: string; filename: string; inline: boolean }
): Promise<string | null> {
	if (driver !== 's3') return null;
	const s3 = await requireS3();
	const disposition = `${opts.inline ? 'inline' : 'attachment'}; filename="${opts.filename.replace(/"/g, '')}"`;
	return getSignedUrl(
		s3Client(s3),
		new GetObjectCommand({
			Bucket: s3.bucket,
			Key: storageKey,
			ResponseContentType: opts.mime,
			ResponseContentDisposition: disposition
		}),
		{ expiresIn: 300 }
	);
}

export async function deleteUpload(driver: StorageDriver, storageKey: string): Promise<void> {
	if (driver === 's3') {
		const s3 = await requireS3();
		await s3Client(s3)
			.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: storageKey }))
			.catch(() => {});
		return;
	}
	await unlink(localPath(storageKey)).catch(() => {});
}

// ── Low-level S3 object ops (used by the backup system for a chosen key) ───
export async function s3PutObject(key: string, bytes: Buffer, contentType?: string): Promise<void> {
	const s3 = await requireS3();
	await s3Client(s3).send(
		new PutObjectCommand({
			Bucket: s3.bucket,
			Key: key,
			Body: bytes,
			ContentType: contentType || 'application/octet-stream'
		})
	);
}
export async function s3GetObject(key: string): Promise<Buffer> {
	const s3 = await requireS3();
	const res = await s3Client(s3).send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
	return Buffer.from(await res.Body!.transformToByteArray());
}
export async function s3DeleteObject(key: string): Promise<void> {
	const s3 = await requireS3();
	await s3Client(s3).send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
}

/**
 * Best-effort check of whether the configured bucket is publicly readable —
 * backups must never live in a public bucket. Uses the bucket policy status +
 * ACL (AWS); R2/MinIO often don't implement these, so we return 'unknown'
 * rather than a false all-clear.
 */
export async function checkBucketPublic(): Promise<'public' | 'private' | 'unknown'> {
	const { s3 } = (await getConfig()).storage;
	if (!s3) return 'unknown';
	const client = s3Client(s3);
	try {
		const ps = await client.send(new GetBucketPolicyStatusCommand({ Bucket: s3.bucket }));
		if (ps.PolicyStatus?.IsPublic) return 'public';
	} catch {
		// policy status not supported / denied — fall through to ACL
	}
	try {
		const acl = await client.send(new GetBucketAclCommand({ Bucket: s3.bucket }));
		const anon = acl.Grants?.some((g) => g.Grantee?.URI?.includes('AllUsers'));
		return anon ? 'public' : 'private';
	} catch {
		return 'unknown';
	}
}

/** Verify S3 credentials + bucket reachability (for the admin "Test" button). */
export async function testS3(cfg: S3Config): Promise<{ ok: boolean; error?: string }> {
	try {
		await s3Client(cfg).send(new HeadBucketCommand({ Bucket: cfg.bucket }));
		return { ok: true };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' };
	}
}
