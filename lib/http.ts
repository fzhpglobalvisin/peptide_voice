import 'server-only';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { VERIFIED_COOKIE, VISITOR_COOKIE } from './constants';

export { VERIFIED_COOKIE, VISITOR_COOKIE };

/** Mark cookies Secure only when the request really came over HTTPS (so http://localhost and LAN testing keep them). */
export async function requestIsHttps(req?: Request) {
  const h = await headers();
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim();
  if (proto) return proto === 'https';
  if (req) return new URL(req.url).protocol === 'https:';
  return false;
}

export const VERIFIED_DAYS = 30;

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** The researcher gate sets an httpOnly cookie; API routes that cost money or store data require it. */
export async function verifiedVisitor(): Promise<string | null> {
  const c = await cookies();
  if (c.get(VERIFIED_COOKIE)?.value !== '1') return null;
  return c.get(VISITOR_COOKIE)?.value ?? null;
}

export async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
