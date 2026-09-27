// Emergency admin reset from the server — no email needed.
// Usage:
//   npm run reset-admin -- <username> <new-password> [email]
// Updates that admin's password (and email if given), or creates the admin if it doesn't exist.
// Signs out every existing admin login.
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [username, password, email] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: npm run reset-admin -- <username> <new-password> [email]');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ridgeline.db');
if (!fs.existsSync(file)) {
  console.error(`Database not found at ${file}. Start the app once (npm run dev) so it is created, then run this again.`);
  process.exit(1);
}

const db = new Database(file);
db.exec(`CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  password_hash TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000))`);

const salt = crypto.randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);

if (existing) {
  db.prepare(
    `UPDATE admin_users SET password_hash=?, email=COALESCE(?, email), session_version=session_version+1, updated_at=strftime('%s','now')*1000 WHERE id=?`,
  ).run(hash, email ? email.toLowerCase() : null, existing.id);
  console.log(`Password reset for "${username}". All existing admin logins were signed out.`);
} else {
  db.prepare('INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)').run(username, (email ?? '').toLowerCase(), hash);
  console.log(`Created admin "${username}".`);
}
const all = db.prepare('SELECT username, email FROM admin_users ORDER BY id').all();
console.log('Admin accounts:', all.map((a) => `${a.username}${a.email ? ` <${a.email}>` : ''}`).join(', '));
db.close();
