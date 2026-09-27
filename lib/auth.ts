import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requestIsHttps } from './http';
import { adminCount, ensureAdminSeeded, getAdminById, safeEqual } from './admin-users';

/**
 * Username + password admin login. Accounts live in the admin_users table
 * (seeded once from .env), so passwords can be changed and reset from the app.
 *
 * .env.local:
 *   AUTH_SECRET=long-random-string   (signs the login cookie)
 *   ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL   (only used to create the first admin)
 */

export const ADMIN_COOKIE = 'rf_admin';
const SESSION_HOURS = 12;

export interface AdminSession {
  user: { id: number; name: string };
  exp: number;
}

interface TokenPayload {
  uid: number;
  v: number;
  exp: number;
}

function secret() {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 16) throw new Error('AUTH_SECRET must be set in .env.local (at least 16 characters).');
  return s;
}

/** Names of required settings that are missing (values are never exposed). */
export async function missingAuthConfig(): Promise<string[]> {
  const missing: string[] = [];
  if ((process.env.AUTH_SECRET?.trim().length ?? 0) < 16) missing.push('AUTH_SECRET (16+ characters)');
  if (!(await ensureAdminSeeded()) && (await adminCount()) === 0) {
    if (!process.env.ADMIN_USERNAME?.trim()) missing.push('ADMIN_USERNAME');
    if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) missing.push('ADMIN_PASSWORD');
  }
  return missing;
}

const sign = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function createSessionToken(uid: number, sessionVersion: number) {
  const payload: TokenPayload = { uid, v: sessionVersion, exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

async function readToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  try {
    if (!safeEqual(sig, sign(data))) return null;
    const p = JSON.parse(Buffer.from(data, 'base64url').toString()) as TokenPayload;
    if (!p.exp || p.exp < Date.now()) return null;
    const user = await getAdminById(p.uid);
    // A password change bumps session_version, which signs out every older login.
    if (!user || user.session_version !== p.v) return null;
    return { user: { id: Number(user.id), name: user.username }, exp: p.exp };
  } catch {
    return null;
  }
}

export async function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: await requestIsHttps(),
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return readToken(jar.get(ADMIN_COOKIE)?.value);
}

/** For server components / actions: redirect to login when not signed in. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/** For route handlers: true when the caller is signed in as admin. */
export async function isAdminRequest() {
  return !!(await getAdminSession());
}
