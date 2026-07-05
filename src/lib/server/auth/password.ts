import { hash, verify } from '@node-rs/argon2';

// Argon2id parameters — sensible defaults for interactive logins.
const OPTIONS = {
	memoryCost: 19_456, // 19 MiB
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

export function hashPassword(password: string): Promise<string> {
	return hash(password, OPTIONS);
}

export async function verifyPassword(digest: string, password: string): Promise<boolean> {
	try {
		return await verify(digest, password, OPTIONS);
	} catch {
		return false;
	}
}
