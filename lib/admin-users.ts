import 'server-only';
import crypto from 'node:crypto';
import { exec, one, q } from './db';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  session_version: number;
}

const COLS = 'id, username, email, password_hash, session_version';
export const MIN_PASSWORD = 10;
const RESET_MINUTES = 30;

// ─────────────── Password hashing (scrypt, no extra packages) ───────────────

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPasswordHash(password: string, stored: string) {
  const [algo, salt, expected] = stored.split(':');
  if (algo !== 'scrypt' || !salt || !expected) return false;
  return safeEqual(crypto.scryptSync(password, salt, 64).toString('hex'), expected);
}

// A fixed dummy hash so failed lookups take as long as real ones (no username probing by timing).
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));

// ─────────────── Seeding from .env (first run only) ───────────────

const NOW = `(floor(extract(epoch from clock_timestamp()) * 1000))::bigint`;

export async function adminCount() {
  return Number((await one<{ n: number }>('SELECT COUNT(*) AS n FROM admin_users'))?.n ?? 0);
}

/** Creates the first admin from ADMIN_USERNAME + ADMIN_PASSWORD(_HASH) + ADMIN_EMAIL if none exists yet. */
export async function ensureAdminSeeded() {
  if ((await adminCount()) > 0) return true;
  const username = process.env.ADMIN_USERNAME?.trim();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim() || (process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : '');
  if (!username || !hash) return false;
  await exec(
    // "WHERE NOT EXISTS" + ON CONFLICT: two cold starts at once still create exactly one admin
    `INSERT INTO admin_users (username, email, password_hash)
     SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM admin_users) ON CONFLICT DO NOTHING`,
    [username, (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(), hash],
  );
  return true;
}

// ─────────────── Lookups ───────────────

export const getAdminById = (id: number) => one<AdminUser>(`SELECT ${COLS} FROM admin_users WHERE id=?`, [id]);
export const getAdminByUsername = (u: string) => one<AdminUser>(`SELECT ${COLS} FROM admin_users WHERE lower(username)=lower(?)`, [u.trim()]);
export const getAdminByEmail = async (e: string) =>
  e.trim() ? one<AdminUser>(`SELECT ${COLS} FROM admin_users WHERE lower(email)=lower(?) AND email <> '' ORDER BY id LIMIT 1`, [e.trim()]) : undefined;

/** Returns the admin when username + password match, else null. Constant-ish time either way. */
export async function verifyLogin(username: string, password: string): Promise<AdminUser | null> {
  await ensureAdminSeeded();
  // "User ID or email"
  const user = (await getAdminByUsername(username)) ?? (username.includes('@') ? await getAdminByEmail(username) : undefined);
  const ok = checkPasswordHash(password, user?.password_hash ?? DUMMY);
  return user && ok ? user : null;
}

// ─────────────── Changes ───────────────

export async function setPassword(id: number, password: string) {
  await exec(`UPDATE admin_users SET password_hash=?, session_version=session_version+1, updated_at=${NOW} WHERE id=?`, [hashPassword(password), id]);
  await exec('DELETE FROM admin_resets WHERE admin_id=?', [id]);
}

export async function setAccount(id: number, username: string, email: string) {
  await exec(`UPDATE admin_users SET username=?, email=?, updated_at=${NOW} WHERE id=?`, [username.trim(), email.trim().toLowerCase(), id]);
}

// ─────────────── Reset tokens ───────────────

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export async function createResetToken(adminId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await exec('DELETE FROM admin_resets WHERE admin_id=? OR expires_at < ?', [adminId, Date.now()]);
  await exec('INSERT INTO admin_resets (token_hash, admin_id, expires_at) VALUES (?, ?, ?)', [sha(token), adminId, Date.now() + RESET_MINUTES * 60000]);
  return { token, minutes: RESET_MINUTES };
}

/** The admin a valid, unused, unexpired token belongs to (does not use it up). */
export async function adminForResetToken(token: string): Promise<AdminUser | null> {
  if (!token) return null;
  const row = await one<{ admin_id: number }>('SELECT admin_id FROM admin_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > ?', [sha(token), Date.now()]);
  return row ? ((await getAdminById(Number(row.admin_id))) ?? null) : null;
}

/** Uses up the token and sets the new password. Returns false if the token is no longer valid. */
export async function resetPasswordWithToken(token: string, password: string) {
  if (!token) return false;
  // Claim the token atomically so it can only ever be used once.
  const row = await one<{ admin_id: number }>(
    'UPDATE admin_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at > ? RETURNING admin_id',
    [Date.now(), sha(token), Date.now()],
  );
  if (!row) return false;
  await setPassword(Number(row.admin_id), password);
  return true;
}

export function passwordProblem(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (pw !== confirm) return 'The two passwords do not match.';
  return null;
}

// ─────────────── New admins (Create account tab) ───────────────

export async function createAdmin(username: string, email: string, password: string) {
  const r = await one<AdminUser>(`INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?) RETURNING ${COLS}`, [
    username.trim(),
    email.trim().toLowerCase(),
    hashPassword(password),
  ]);
  return r!;
}

/** Usernames for the quick-pick chips on the login page (never passwords). */
export async function adminUsernames(limit = 8): Promise<string[]> {
  await ensureAdminSeeded();
  return (await q<{ username: string }>('SELECT username FROM admin_users ORDER BY id LIMIT ?', [limit])).map((r) => r.username);
}
