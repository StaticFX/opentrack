import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';
import { env } from '$lib/server/env';

export interface GithubAppConfig {
	appId?: string;
	slug?: string;
	privateKey?: string;
	webhookSecret?: string;
	clientId?: string;
	clientSecret?: string;
}
export interface SiteConfig {
	name: string;
	headline: string;
	tagline: string;
}
export interface PushConfig {
	/** VAPID public key — safe to expose to browsers. */
	publicKey?: string;
	/** VAPID private key — AES-256-GCM encrypted at rest. */
	privateKey?: string;
	/** `mailto:` contact required by the Web Push spec. */
	subject: string;
}
export interface S3Config {
	/** Custom endpoint for R2/MinIO; empty = AWS S3. */
	endpoint?: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	/** AES-256-GCM encrypted at rest. */
	secretAccessKey: string;
	/** MinIO (and some setups) need path-style URLs. */
	forcePathStyle: boolean;
}
export interface StorageConfig {
	/** Active driver for NEW uploads. Existing files are served by their own driver. */
	driver: 'local' | 's3';
	/** S3 client config — present whenever credentials exist (even if driver=local), so already-stored S3 objects stay servable. */
	s3?: S3Config;
}
export interface RuntimeConfig {
	githubApp: GithubAppConfig;
	storage: StorageConfig;
	site: SiteConfig;
	push: PushConfig;
}

/** Defaults for the instance landing page (`/`), overridable from Admin. */
export const SITE_DEFAULTS: SiteConfig = {
	name: 'OpenTrack',
	headline: 'Build in the open.',
	tagline: "Follow what's being worked on, upvote what matters to you, and suggest what comes next."
};

// ── Raw settings access ─────────────────────────────────────────────────────
function safeDecrypt(v: string): string | null {
	try {
		return decryptSecret(v);
	} catch {
		return null;
	}
}

export async function setSetting(key: string, value: string | null, encrypt = false): Promise<void> {
	if (value === null || value === '') {
		await db.delete(schema.settings).where(eq(schema.settings.key, key));
	} else {
		const stored = encrypt ? encryptSecret(value) : value;
		await db
			.insert(schema.settings)
			.values({ key, value: stored, encrypted: encrypt })
			.onConflictDoUpdate({
				target: schema.settings.key,
				set: { value: stored, encrypted: encrypt, updatedAt: new Date() }
			});
	}
	invalidateConfig();
}

// ── Resolved config (DB settings override env), cached ──────────────────────
const globalForCfg = globalThis as unknown as { __otCfg?: RuntimeConfig | null };
let cache: RuntimeConfig | null = globalForCfg.__otCfg ?? null;

export function invalidateConfig(): void {
	cache = null;
	globalForCfg.__otCfg = null;
}

export async function getConfig(): Promise<RuntimeConfig> {
	if (cache) return cache;

	const rows = await db.select().from(schema.settings);
	const map = new Map<string, { value: string; encrypted: boolean }>();
	for (const r of rows) if (r.value != null) map.set(r.key, { value: r.value, encrypted: r.encrypted });
	const get = (k: string): string | undefined => {
		const e = map.get(k);
		if (!e) return undefined;
		return e.encrypted ? (safeDecrypt(e.value) ?? undefined) : e.value;
	};

	const s3Bucket = get('storage.s3.bucket');
		const s3AccessKeyId = get('storage.s3.accessKeyId');
		const s3SecretKey = get('storage.s3.secretAccessKey');
		const s3: S3Config | undefined =
			s3Bucket && s3AccessKeyId && s3SecretKey
				? {
						endpoint: get('storage.s3.endpoint') || undefined,
						region: get('storage.s3.region') || 'auto',
						bucket: s3Bucket,
						accessKeyId: s3AccessKeyId,
						secretAccessKey: s3SecretKey,
						forcePathStyle: get('storage.s3.forcePathStyle') === '1'
					}
				: undefined;

		cache = {
			githubApp: {
				appId: get('github.appId'),
				slug: get('github.slug'),
				privateKey: get('github.privateKey'),
				webhookSecret: get('github.webhookSecret'),
				clientId: get('github.clientId'),
				clientSecret: get('github.clientSecret')
			},
			storage: {
				// New uploads use S3 only when it's configured AND enabled; existing
				// files are always served by the driver recorded on their row.
				driver: get('storage.s3.enabled') === '1' && s3 ? 's3' : 'local',
				s3
			},
			site: {
			name: get('site.name') ?? SITE_DEFAULTS.name,
			headline: get('site.headline') ?? SITE_DEFAULTS.headline,
			tagline: get('site.tagline') ?? SITE_DEFAULTS.tagline
		},
		push: {
			publicKey: get('push.publicKey') ?? undefined,
			privateKey: get('push.privateKey') ?? undefined,
			subject: get('push.subject') ?? `mailto:admin@${new URL(env.origin).hostname}`
		}
	};
	globalForCfg.__otCfg = cache;
	return cache;
}

// ── Admin form helpers ──────────────────────────────────────────────────────
/** Non-secret values + "is set" flags for rendering the admin config forms. */
export async function getConfigView() {
	const rows = await db.select().from(schema.settings);
	const has = (k: string) => rows.some((r) => r.key === k && r.value);
	const val = (k: string) => {
		const r = rows.find((x) => x.key === k);
		if (!r || r.value == null) return '';
		return r.encrypted ? '' : r.value; // never surface decrypted secrets
	};
	const cfg = await getConfig();

	return {
		github: {
			appId: val('github.appId'),
			slug: val('github.slug'),
			clientId: val('github.clientId'),
			hasPrivateKey: has('github.privateKey'),
			hasWebhookSecret: has('github.webhookSecret'),
			hasClientSecret: has('github.clientSecret'),
			active: !!(cfg.githubApp.appId && cfg.githubApp.privateKey && cfg.githubApp.webhookSecret)
		},
		storage: {
			s3Enabled: val('storage.s3.enabled') === '1',
			endpoint: val('storage.s3.endpoint'),
			region: val('storage.s3.region'),
			bucket: val('storage.s3.bucket'),
			accessKeyId: val('storage.s3.accessKeyId'),
			hasSecret: has('storage.s3.secretAccessKey'),
			forcePathStyle: val('storage.s3.forcePathStyle') === '1',
			// True when S3 is the active driver for new uploads.
			active: cfg.storage.driver === 's3',
			// True when credentials are present (S3 objects are servable).
			configured: !!cfg.storage.s3
		},
		// Raw stored values (blank when unset → the form shows the defaults as placeholders).
		site: {
			name: val('site.name'),
			headline: val('site.headline'),
			tagline: val('site.tagline')
		},
		push: {
			publicKey: val('push.publicKey'),
			subject: val('push.subject'),
			hasPrivateKey: has('push.privateKey'),
			active: !!(cfg.push.publicKey && cfg.push.privateKey)
		}
	};
}

/** True when Web Push is fully configured (both VAPID keys present). */
export async function pushConfigured(): Promise<boolean> {
	const cfg = await getConfig();
	return !!(cfg.push.publicKey && cfg.push.privateKey);
}
