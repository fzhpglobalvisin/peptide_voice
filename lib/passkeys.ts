import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { exec, one, q } from './db';
import { getAdminById, safeEqual, type AdminUser } from './admin-users';
import { requestIsHttps } from './http';

/**
 * Passkeys for the Super admin (WebAuthn): Face ID, Touch ID, fingerprint, Windows Hello or a security key.
 * Works on https:// sites and on http://localhost. The site address must stay the same after a passkey is
 * created (a passkey made on localhost won't work on the live domain) — override with WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN.
 */

const RP_NAME = 'Ridgeline Fit Admin';
const CHALLENGE_COOKIE = 'rf_wa';
const CHALLENGE_MINUTES = 5;

interface PasskeyRow {
  id: string;
  admin_id: number;
  public_key: Uint8Array;
  counter: number;
  transports: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
}

/** Relying party = the site's own domain, taken from the request (or env override). */
export async function relyingParty() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') || h.get('host') || 'localhost').split(',')[0].trim();
  const proto = (await requestIsHttps()) ? 'https' : 'http';
  const origin = process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`;
  const rpID = process.env.WEBAUTHN_RP_ID || host.replace(/:\d+$/, '');
  return { rpID, origin };
}

// ─────────────── One-time challenge, kept in a signed short-lived cookie ───────────────

function secret() {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 16) throw new Error('AUTH_SECRET must be set (at least 16 characters).');
  return s;
}
const sign = (v: string) => crypto.createHmac('sha256', secret()).update('webauthn:' + v).digest('base64url');

async function saveChallenge(kind: 'register' | 'login', challenge: string) {
  const exp = Date.now() + CHALLENGE_MINUTES * 60000;
  const value = `${kind}.${challenge}.${exp}`;
  (await cookies()).set(CHALLENGE_COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: await requestIsHttps(),
    path: '/',
    maxAge: CHALLENGE_MINUTES * 60,
  });
}

/** Returns and clears the pending challenge (single use). */
async function takeChallenge(kind: 'register' | 'login'): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [k, challenge, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${k}.${challenge}.${exp}`))) return null;
  if (k !== kind || Number(exp) < Date.now()) return null;
  return challenge;
}

// ─────────────── Storage ───────────────

export async function listPasskeys(adminId: number) {
  return q<Pick<PasskeyRow, 'id' | 'name' | 'created_at' | 'last_used_at'>>(
    `SELECT id, name, created_at, last_used_at FROM admin_passkeys WHERE admin_id=? ORDER BY created_at`,
    [adminId],
  );
}

export async function passkeyCount() {
  return Number((await one<{ n: number }>(`SELECT COUNT(*) AS n FROM admin_passkeys`))?.n ?? 0);
}

export async function deletePasskey(adminId: number, id: string) {
  await exec(`DELETE FROM admin_passkeys WHERE admin_id=? AND id=?`, [adminId, id]);
}

// ─────────────── Registration (signed-in admin adds a passkey) ───────────────

export async function registrationOptions(admin: AdminUser) {
  const { rpID } = await relyingParty();
  const existing = await q<{ id: string; transports: string }>(`SELECT id, transports FROM admin_passkeys WHERE admin_id=?`, [admin.id]);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: admin.username,
    userDisplayName: `${admin.username} (Super admin)`,
    userID: new TextEncoder().encode(`rf-admin-${admin.id}`),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: JSON.parse(c.transports) })),
    // Discoverable credential so the login page can offer "Sign in with passkey" without typing a user ID.
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await saveChallenge('register', options.challenge);
  return options;
}

export async function verifyRegistration(admin: AdminUser, response: RegistrationResponseJSON, name: string) {
  const expectedChallenge = await takeChallenge('register');
  if (!expectedChallenge) throw new Error('The request expired. Please try again.');
  const { rpID, origin } = await relyingParty();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!result.verified || !result.registrationInfo) throw new Error('Passkey could not be verified.');
  const { credential } = result.registrationInfo;
  await exec(
    `INSERT INTO admin_passkeys (id, admin_id, public_key, counter, transports, name) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET admin_id = excluded.admin_id, public_key = excluded.public_key, counter = excluded.counter,
       transports = excluded.transports, name = excluded.name`,
    [
      credential.id,
      admin.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      (name || 'Passkey').slice(0, 60),
    ],
  );
}

// ─────────────── Sign in with passkey ───────────────

export async function authenticationOptions() {
  const { rpID } = await relyingParty();
  // No allowCredentials: the device shows its saved passkeys for this site.
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
  await saveChallenge('login', options.challenge);
  return options;
}

/** Verifies the passkey and returns the admin it belongs to. */
export async function verifyAuthentication(response: AuthenticationResponseJSON): Promise<AdminUser> {
  const expectedChallenge = await takeChallenge('login');
  if (!expectedChallenge) throw new Error('The request expired. Please try again.');
  const row = await one<PasskeyRow>(`SELECT * FROM admin_passkeys WHERE id=?`, [response.id]);
  if (!row) throw new Error('This passkey is not registered for this site.');
  const { rpID, origin } = await relyingParty();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: row.id, publicKey: new Uint8Array(row.public_key), counter: Number(row.counter), transports: JSON.parse(row.transports) },
    requireUserVerification: false,
  });
  if (!result.verified) throw new Error('Passkey could not be verified.');
  await exec(`UPDATE admin_passkeys SET counter=?, last_used_at=? WHERE id=?`, [result.authenticationInfo.newCounter, Date.now(), row.id]);
  const admin = await getAdminById(Number(row.admin_id));
  if (!admin) throw new Error('Account not found.');
  return admin;
}
