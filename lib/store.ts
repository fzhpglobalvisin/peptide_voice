import 'server-only';
import crypto from 'node:crypto';
import { exec, one } from './db';
import type { CartItem, ChatMessage } from './types';

export const newId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');
const NOW = `(floor(extract(epoch from clock_timestamp()) * 1000))::bigint`;

// ─────────────── Attestations ───────────────

export async function recordAttestation(visitorId: string, ua: string | null) {
  await exec(`INSERT INTO attestations (visitor_id, age_confirmed, researcher_confirmed, user_agent) VALUES (?, 1, 1, ?)`, [visitorId, ua?.slice(0, 300) ?? null]);
}

// ─────────────── Chat sessions ───────────────

export async function createSession(visitorId: string) {
  const id = newId(12);
  await exec(`INSERT INTO chat_sessions (id, visitor_id) VALUES (?, ?)`, [id, visitorId]);
  return id;
}

export async function getSession(id: string) {
  return one<{ id: string; visitor_id: string; status: 'open' | 'closed'; started_at: number }>(
    `SELECT id, visitor_id, status, started_at FROM chat_sessions WHERE id=?`,
    [id],
  );
}

export async function closeSession(id: string, transcript: ChatMessage[], language: string | null) {
  const turns = transcript.filter((m) => m.role === 'user').length;
  await exec(
    `UPDATE chat_sessions SET status='closed', ended_at=${NOW}, transcript=?, turn_count=?, language=COALESCE(?, language) WHERE id=?`,
    [JSON.stringify(transcript.map(({ role, text, at }) => ({ role, text, at }))), turns, language, id],
  );
}

export async function saveSummary(id: string, summary: unknown, language: string | null) {
  await exec(`UPDATE chat_sessions SET summary=?, language=COALESCE(?, language) WHERE id=?`, [JSON.stringify(summary), language, id]);
}

// ─────────────── Research context ───────────────

export interface ResearchContext {
  institution_type?: string;
  research_area?: string;
  quantity_scale?: string;
  compounds?: string[];
  coa_required?: boolean;
}

export async function upsertResearchContext(sessionId: string, c: ResearchContext) {
  await exec(
    `INSERT INTO research_context AS r (session_id, institution_type, research_area, quantity_scale, compounds, coa_required)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET
       institution_type = COALESCE(excluded.institution_type, r.institution_type),
       research_area    = COALESCE(excluded.research_area, r.research_area),
       quantity_scale   = COALESCE(excluded.quantity_scale, r.quantity_scale),
       compounds        = CASE WHEN excluded.compounds = '[]' THEN r.compounds ELSE excluded.compounds END,
       coa_required     = COALESCE(excluded.coa_required, r.coa_required),
       updated_at       = ${NOW}`,
    [
      sessionId,
      c.institution_type ?? null,
      c.research_area?.slice(0, 200) ?? null,
      c.quantity_scale ?? null,
      JSON.stringify((c.compounds ?? []).slice(0, 20)),
      c.coa_required === undefined ? null : c.coa_required ? 1 : 0,
    ],
  );
}

// ─────────────── Compliance ───────────────

export const COMPLIANCE_CATEGORIES = ['dosing', 'human_use', 'medical_claim', 'possible_minor', 'veterinary', 'other'] as const;
export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export async function logCompliance(sessionId: string | null, category: ComplianceCategory, excerpt: string | null) {
  await exec(`INSERT INTO compliance_events (session_id, category, excerpt) VALUES (?, ?, ?)`, [sessionId, category, excerpt?.slice(0, 300) ?? null]);
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

export async function createLead(l: LeadInput): Promise<number> {
  const r = await one<{ id: number }>(
    `INSERT INTO leads (session_id, name, whatsapp, email, institution, message, source, consent_whatsapp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      l.sessionId ?? null,
      l.name.slice(0, 120),
      // Only keep the WhatsApp number if the person opted in to be contacted there.
      l.consentWhatsapp ? l.whatsapp?.replace(/[^\d+]/g, '').slice(0, 20) || null : null,
      l.email?.slice(0, 200) ?? null,
      l.institution?.slice(0, 200) ?? null,
      l.message?.slice(0, 2000) ?? null,
      l.source,
      l.consentWhatsapp ? 1 : 0,
    ],
  );
  return Number(r!.id);
}

export async function createQuote(items: CartItem[], sessionId: string | null, leadId: number | null, channel: 'wa_link' | 'wa_cloud') {
  const id = newId(6);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  await exec(`INSERT INTO quotes (id, session_id, lead_id, items, subtotal, channel) VALUES (?, ?, ?, ?, ?, ?)`, [
    id,
    sessionId,
    leadId,
    JSON.stringify(items),
    subtotal,
    channel,
  ]);
  return { id, subtotal };
}

export async function getQuote(id: string) {
  const r = await one<{ id: string; items: string; subtotal: number; created_at: number; lead_name: string | null }>(
    `SELECT q.id, q.items, q.subtotal, q.created_at, l.name AS lead_name FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id WHERE q.id=?`,
    [id],
  );
  return r ? { ...r, items: JSON.parse(r.items) as CartItem[] } : null;
}

export async function getLeadForQuote(id: number) {
  return one<{ id: number; name: string; whatsapp: string | null; consent_whatsapp: number }>(`SELECT id, name, whatsapp, consent_whatsapp FROM leads WHERE id=?`, [id]);
}

export interface OrderInput {
  sessionId: string | null;
  leadId: number;
  customerId?: number | null;
  items: CartItem[];
  subtotal: number;
  discountCode: string | null;
  discount: number;
  total: number;
  institution: string;
  shipAddress: string;
}

export async function createOrder(o: OrderInput): Promise<number> {
  const r = await one<{ id: number }>(
    `INSERT INTO orders (session_id, lead_id, customer_id, items, subtotal, discount_code, discount, total, institution, ship_address, attested)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    [o.sessionId, o.leadId, o.customerId ?? null, JSON.stringify(o.items), o.subtotal, o.discountCode, o.discount, o.total, o.institution, o.shipAddress],
  );
  return Number(r!.id);
}

export async function subscribe(email: string) {
  await exec(`INSERT INTO newsletter (email) VALUES (?) ON CONFLICT (email) DO NOTHING`, [email.trim().toLowerCase().slice(0, 200)]);
}

// ─────────────── Rate limiting (in-memory, per server instance) ───────────────

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
