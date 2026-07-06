import { eq } from 'drizzle-orm';
import type { OAuthProvider } from '$lib/constants';
import { db, schema } from '$lib/server/db';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';
import { env } from '$lib/server/env';

export interface OAuthCred {
	clientId: string;
	clientSecret: string;
}
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
export interface RuntimeConfig {
	oauth: Record<OAuthProvider, OAuthCred | null>;
	githubApp: GithubAppConfig;
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

	const provider = (p: OAuthProvider, envCred: OAuthCred | null): OAuthCred | null => {
		const clientId = get(`oauth.${p}.clientId`) ?? envCred?.clientId;
		const clientSecret = get(`oauth.${p}.clientSecret`) ?? envCred?.clientSecret;
		return clientId && clientSecret ? { clientId, clientSecret } : null;
	};

	cache = {
		oauth: {
			github: provider('github', env.oauth.github),
			discord: provider('discord', env.oauth.discord),
			modrinth: provider('modrinth', env.oauth.modrinth)
		},
		githubApp: {
			appId: get('github.appId') ?? env.githubApp.appId,
			slug: get('github.slug') ?? env.githubApp.slug,
			privateKey: get('github.privateKey') ?? env.githubApp.privateKey,
			webhookSecret: get('github.webhookSecret') ?? env.githubApp.webhookSecret,
			clientId: get('github.clientId') ?? env.githubApp.clientId,
			clientSecret: get('github.clientSecret') ?? env.githubApp.clientSecret
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
		oauth: (['github', 'discord', 'modrinth'] as OAuthProvider[]).map((p) => ({
			provider: p,
			clientId: val(`oauth.${p}.clientId`),
			hasSecret: has(`oauth.${p}.clientSecret`),
			active: cfg.oauth[p] !== null
		})),
		github: {
			appId: val('github.appId'),
			slug: val('github.slug'),
			clientId: val('github.clientId'),
			hasPrivateKey: has('github.privateKey'),
			hasWebhookSecret: has('github.webhookSecret'),
			hasClientSecret: has('github.clientSecret'),
			active: !!(cfg.githubApp.appId && cfg.githubApp.privateKey && cfg.githubApp.webhookSecret)
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
