import 'server-only';
import crypto from 'node:crypto';
import { stmt } from './db';

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

export function adminCount() {
  return (stmt('SELECT COUNT(*) AS n FROM admin_users').get() as { n: number }).n;
}

/** Creates the first admin from ADMIN_USERNAME + ADMIN_PASSWORD(_HASH) + ADMIN_EMAIL if none exists yet. */
export function ensureAdminSeeded() {
  if (adminCount() > 0) return true;
  const username = process.env.ADMIN_USERNAME?.trim();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim() || (process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : '');
  if (!username || !hash) return false;
  stmt('INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)').run(
    username,
    (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
    hash,
  );
  return true;
}

// ─────────────── Lookups ───────────────

export const getAdminById = (id: number) => stmt(`SELECT ${COLS} FROM admin_users WHERE id=?`).get(id) as AdminUser | undefined;
export const getAdminByUsername = (u: string) => stmt(`SELECT ${COLS} FROM admin_users WHERE username=?`).get(u.trim()) as AdminUser | undefined;
export const getAdminByEmail = (e: string) =>
  e.trim() ? (stmt(`SELECT ${COLS} FROM admin_users WHERE email=? AND email != ''`).get(e.trim().toLowerCase()) as AdminUser | undefined) : undefined;

/** Returns the admin when username + password match, else null. Constant-ish time either way. */
export function verifyLogin(username: string, password: string): AdminUser | null {
  ensureAdminSeeded();
  const user = getAdminByUsername(username);
  const ok = checkPasswordHash(password, user?.password_hash ?? DUMMY);
  return user && ok ? user : null;
}

// ─────────────── Changes ───────────────

export function setPassword(id: number, password: string) {
  stmt(
    `UPDATE admin_users SET password_hash=?, session_version=session_version+1, updated_at=strftime('%s','now')*1000 WHERE id=?`,
  ).run(hashPassword(password), id);
  stmt('DELETE FROM admin_resets WHERE admin_id=?').run(id);
}

export function setAccount(id: number, username: string, email: string) {
  stmt(`UPDATE admin_users SET username=?, email=?, updated_at=strftime('%s','now')*1000 WHERE id=?`).run(
    username.trim(),
    email.trim().toLowerCase(),
    id,
  );
}

// ─────────────── Reset tokens ───────────────

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function createResetToken(adminId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  stmt('DELETE FROM admin_resets WHERE admin_id=? OR expires_at < ?').run(adminId, Date.now());
  stmt('INSERT INTO admin_resets (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(sha(token), adminId, Date.now() + RESET_MINUTES * 60000);
  return { token, minutes: RESET_MINUTES };
}

/** The admin a valid, unused, unexpired token belongs to (does not use it up). */
export function adminForResetToken(token: string): AdminUser | null {
  if (!token) return null;
  const row = stmt('SELECT admin_id FROM admin_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > ?').get(sha(token), Date.now()) as
    | { admin_id: number }
    | undefined;
  return row ? getAdminById(row.admin_id) ?? null : null;
}

/** Uses up the token and sets the new password. Returns false if the token is no longer valid. */
export function resetPasswordWithToken(token: string, password: string) {
  const admin = adminForResetToken(token);
  if (!admin) return false;
  stmt('UPDATE admin_resets SET used_at=? WHERE token_hash=?').run(Date.now(), sha(token));
  setPassword(admin.id, password);
  return true;
}

export function passwordProblem(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (pw !== confirm) return 'The two passwords do not match.';
  return null;
}
