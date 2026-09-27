import 'server-only';
import crypto from 'node:crypto';
import { db, stmt } from './db';
import type { CartItem, ChatMessage } from './types';

export const newId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');

// ─────────────── Attestations ───────────────

export function recordAttestation(visitorId: string, ua: string | null) {
  stmt(`INSERT INTO attestations (visitor_id, age_confirmed, researcher_confirmed, user_agent) VALUES (?, 1, 1, ?)`).run(
    visitorId,
    ua?.slice(0, 300) ?? null,
  );
}

// ─────────────── Chat sessions ───────────────

export function createSession(visitorId: string) {
  const id = newId(12);
  stmt(`INSERT INTO chat_sessions (id, visitor_id) VALUES (?, ?)`).run(id, visitorId);
  return id;
}

export function getSession(id: string) {
  return stmt(`SELECT id, visitor_id, status, started_at FROM chat_sessions WHERE id=?`).get(id) as
    | { id: string; visitor_id: string; status: 'open' | 'closed'; started_at: number }
    | undefined;
}

export function closeSession(id: string, transcript: ChatMessage[], language: string | null) {
  const turns = transcript.filter((m) => m.role === 'user').length;
  stmt(
    `UPDATE chat_sessions SET status='closed', ended_at=(strftime('%s','now')*1000), transcript=?, turn_count=?, language=COALESCE(?, language)
     WHERE id=?`,
  ).run(JSON.stringify(transcript.map(({ role, text, at }) => ({ role, text, at }))), turns, language, id);
}

export function saveSummary(id: string, summary: unknown, language: string | null) {
  stmt(`UPDATE chat_sessions SET summary=?, language=COALESCE(?, language) WHERE id=?`).run(JSON.stringify(summary), language, id);
}

// ─────────────── Research context ───────────────

export interface ResearchContext {
  institution_type?: string;
  research_area?: string;
  quantity_scale?: string;
  compounds?: string[];
  coa_required?: boolean;
}

export function upsertResearchContext(sessionId: string, c: ResearchContext) {
  stmt(
    `INSERT INTO research_context (session_id, institution_type, research_area, quantity_scale, compounds, coa_required)
     VALUES (@sid, @inst, @area, @scale, @compounds, @coa)
     ON CONFLICT(session_id) DO UPDATE SET
       institution_type = COALESCE(excluded.institution_type, institution_type),
       research_area    = COALESCE(excluded.research_area, research_area),
       quantity_scale   = COALESCE(excluded.quantity_scale, quantity_scale),
       compounds        = CASE WHEN excluded.compounds = '[]' THEN compounds ELSE excluded.compounds END,
       coa_required     = COALESCE(excluded.coa_required, coa_required),
       updated_at       = strftime('%s','now')*1000`,
  ).run({
    sid: sessionId,
    inst: c.institution_type ?? null,
    area: c.research_area?.slice(0, 200) ?? null,
    scale: c.quantity_scale ?? null,
    compounds: JSON.stringify((c.compounds ?? []).slice(0, 20)),
    coa: c.coa_required === undefined ? null : c.coa_required ? 1 : 0,
  });
}

// ─────────────── Compliance ───────────────

export const COMPLIANCE_CATEGORIES = ['dosing', 'human_use', 'medical_claim', 'possible_minor', 'veterinary', 'other'] as const;
export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export function logCompliance(sessionId: string | null, category: ComplianceCategory, excerpt: string | null) {
  stmt(`INSERT INTO compliance_events (session_id, category, excerpt) VALUES (?, ?, ?)`).run(
    sessionId,
    category,
    excerpt?.slice(0, 300) ?? null,
  );
}

// ─────────────── Leads / quotes / orders ───────────────

export interface LeadInput {
  sessionId?: string | null;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  institution?: string | null;
  message?: string | null;
  source: 'voice' | 'contact' | 'bulk_quote' | 'checkout';
  consentWhatsapp: boolean;
}

export function createLead(l: LeadInput) {
  const r = stmt(
    `INSERT INTO leads (session_id, name, whatsapp, email, institution, message, source, consent_whatsapp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    l.sessionId ?? null,
    l.name.slice(0, 120),
    // Only keep the WhatsApp number if the person opted in to be contacted there.
    l.consentWhatsapp ? l.whatsapp?.replace(/[^\d+]/g, '').slice(0, 20) || null : null,
    l.email?.slice(0, 200) ?? null,
    l.institution?.slice(0, 200) ?? null,
    l.message?.slice(0, 2000) ?? null,
    l.source,
    l.consentWhatsapp ? 1 : 0,
  );
  return Number(r.lastInsertRowid);
}

export function createQuote(items: CartItem[], sessionId: string | null, leadId: number | null, channel: 'wa_link' | 'wa_cloud') {
  const id = newId(6);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  stmt(`INSERT INTO quotes (id, session_id, lead_id, items, subtotal, channel) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    sessionId,
    leadId,
    JSON.stringify(items),
    subtotal,
    channel,
  );
  return { id, subtotal };
}

export function getQuote(id: string) {
  const r = stmt(`SELECT q.id, q.items, q.subtotal, q.created_at, l.name AS lead_name
    FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id WHERE q.id=?`).get(id) as
    | { id: string; items: string; subtotal: number; created_at: number; lead_name: string | null }
    | undefined;
  return r ? { ...r, items: JSON.parse(r.items) as CartItem[] } : null;
}

export interface OrderInput {
  sessionId: string | null;
  leadId: number;
  items: CartItem[];
  subtotal: number;
  discountCode: string | null;
  discount: number;
  total: number;
  institution: string;
  shipAddress: string;
}

export function createOrder(o: OrderInput) {
  const r = stmt(
    `INSERT INTO orders (session_id, lead_id, items, subtotal, discount_code, discount, total, institution, ship_address, attested)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(o.sessionId, o.leadId, JSON.stringify(o.items), o.subtotal, o.discountCode, o.discount, o.total, o.institution, o.shipAddress);
  return Number(r.lastInsertRowid);
}

export function subscribe(email: string) {
  stmt(`INSERT OR IGNORE INTO newsletter (email) VALUES (?)`).run(email.slice(0, 200));
}

// ─────────────── Rate limiting (in-memory, per process) ───────────────

const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export { db };
