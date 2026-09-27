import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { stmt } from './db';
import { checkPasswordHash, hashPassword, safeEqual } from './admin-users';
import { requestIsHttps } from './http';

/** Customer accounts for the storefront "My Account" page. */

export const CUSTOMER_COOKIE = 'rf_customer';
export const MIN_CUSTOMER_PASSWORD = 8;

export interface Customer {
  id: number;
  email: string;
  name: string;
  whatsapp: string;
  password_hash: string;
  session_version: number;
  created_at: number;
}

const COLS = 'id, email, name, whatsapp, password_hash, session_version, created_at';
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const getCustomer = (id: number) => stmt(`SELECT ${COLS} FROM customers WHERE id=?`).get(id) as Customer | undefined;
export const getCustomerByEmail = (email: string) => stmt(`SELECT ${COLS} FROM customers WHERE email=?`).get(email.trim().toLowerCase()) as Customer | undefined;

export function createCustomer(email: string, password: string) {
  const r = stmt(`INSERT INTO customers (email, password_hash) VALUES (?, ?)`).run(email.trim().toLowerCase(), hashPassword(password));
  return getCustomer(Number(r.lastInsertRowid))!;
}

/** Email + password check with constant-ish timing whether or not the account exists. */
export function verifyCustomer(email: string, password: string): Customer | null {
  const c = getCustomerByEmail(email);
  const ok = checkPasswordHash(password, c?.password_hash ?? DUMMY);
  if (!c || !ok) return null;
  stmt(`UPDATE customers SET last_login_at=? WHERE id=?`).run(Date.now(), c.id);
  return c;
}

export function updateCustomerDetails(id: number, name: string, whatsapp: string) {
  stmt(`UPDATE customers SET name=?, whatsapp=? WHERE id=?`).run(name.trim().slice(0, 120), whatsapp.trim().slice(0, 30), id);
}

export function setCustomerPassword(id: number, password: string) {
  stmt(`UPDATE customers SET password_hash=?, session_version=session_version+1 WHERE id=?`).run(hashPassword(password), id);
}

export function customerOrders(id: number) {
  return stmt(
    `SELECT o.id, o.items, o.total, o.discount_code, o.status, o.created_at FROM orders o WHERE o.customer_id=? ORDER BY o.created_at DESC LIMIT 100`,
  ).all(id) as { id: number; items: string; total: number; discount_code: string | null; status: string; created_at: number }[];
}

export function listCustomers(limit = 500) {
  return stmt(
    `SELECT c.id, c.email, c.name, c.whatsapp, c.created_at, c.last_login_at,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders,
       (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id = c.id AND o.status != 'rejected') AS spent
     FROM customers c ORDER BY c.created_at DESC LIMIT ?`,
  ).all(limit) as { id: number; email: string; name: string; whatsapp: string; created_at: number; last_login_at: number | null; orders: number; spent: number }[];
}

// ─────────────── Session cookie (HMAC-signed, like the admin login) ───────────────

interface Token {
  cid: number;
  v: number;
  exp: number;
}

function secret() {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 16) throw new Error('AUTH_SECRET must be set in .env (at least 16 characters).');
  return s;
}
const sign = (data: string) => crypto.createHmac('sha256', secret()).update('customer:' + data).digest('base64url');

export async function startCustomerSession(c: Customer, remember: boolean) {
  const days = remember ? 30 : 1;
  const payload: Token = { cid: c.id, v: c.session_version, exp: Date.now() + days * 86400000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  (await cookies()).set(CUSTOMER_COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await requestIsHttps(),
    path: '/',
    // "Remember me" keeps you signed in for 30 days; otherwise until the browser closes.
    ...(remember ? { maxAge: days * 86400 } : {}),
  });
}

export async function endCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** The signed-in customer, or null. */
export async function currentCustomer(): Promise<Customer | null> {
  const raw = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!raw) return null;
  const [data, sig] = raw.split('.');
  if (!data || !sig) return null;
  try {
    if (!safeEqual(sig, sign(data))) return null;
    const t = JSON.parse(Buffer.from(data, 'base64url').toString()) as Token;
    if (!t.exp || t.exp < Date.now()) return null;
    const c = getCustomer(t.cid);
    return c && c.session_version === t.v ? c : null;
  } catch {
    return null;
  }
}
