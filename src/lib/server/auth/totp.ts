import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const ISSUER = 'OpenTrack';

function totp(secretBase32: string, label: string): OTPAuth.TOTP {
	return new OTPAuth.TOTP({
		issuer: ISSUER,
		label,
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret: OTPAuth.Secret.fromBase32(secretBase32)
	});
}

/** A fresh base32 TOTP secret. */
export function generateTotpSecret(): string {
	return new OTPAuth.Secret({ size: 20 }).base32;
}

/** The `otpauth://` provisioning URI (for authenticator apps). */
export function totpUri(secretBase32: string, account: string): string {
	return totp(secretBase32, account).toString();
}

/** An inline SVG QR code for the provisioning URI. */
export function totpQrSvg(secretBase32: string, account: string): Promise<string> {
	return QRCode.toString(totpUri(secretBase32, account), { type: 'svg', margin: 1 });
}

/** Verify a 6-digit code against the secret (±1 step of clock drift). */
export function verifyTotp(secretBase32: string, code: string): boolean {
	const token = code.replace(/\s+/g, '');
	if (!/^\d{6}$/.test(token)) return false;
	return totp(secretBase32, 'x').validate({ token, window: 1 }) !== null;
}
