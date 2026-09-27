import 'server-only';
import crypto from 'node:crypto';
import { hashPassword } from './admin-users';
import { one, q, tx, type Db } from './db';

/**
 * Demo data for showing the dashboard: ~90 days of voice sessions, research context, product activity,
 * leads, WhatsApp quotes, orders, customers, newsletter sign-ups and a few compliance redirects.
 *
 * Every demo row is tagged so it can be removed without touching real data:
 * sessions / quotes / events / attestations start with "demo", people use emails ending in @demo.example,
 * WhatsApp numbers use the fictional +1 555-01xx range. Products are never changed.
 */

type Row = Record<string, unknown>;
interface DemoProduct {
  id: number;
  slug: string;
  name: string;
  price_min: number;
  price_max: number;
  purity: string;
  variants: { label: string; price: number }[];
  is_best_seller: number;
}

export const DEMO_PASSWORD = 'demo-password-123';

const DAYS = 90;
const DAY = 86_400_000;

// ─────────── deterministic random, so every run produces the same shape ───────────
let seedState = 20260928;
const resetRandom = () => {
  seedState = 20260928;
};
function rnd() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
}
const id = (prefix: string, n = 10) => prefix + crypto.randomBytes(n).toString('base64url').slice(0, n);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─────────── fictional people and labs ───────────
const FIRST = ['Amara', 'Daniel', 'Sofia', 'Hamza', 'Elena', 'Omar', 'Priya', 'Lucas', 'Aisha', 'Mateo', 'Hannah', 'Bilal', 'Chloe', 'Yusuf', 'Mei', 'Arjun', 'Laura', 'Farah', 'Noah', 'Zara', 'Ibrahim', 'Grace', 'Tariq', 'Ines', 'Kenji', 'Maya', 'Ahmed', 'Clara', 'Rehan', 'Julia'];
const LAST = ['Khan', 'Morgan', 'Alvarez', 'Siddiqui', 'Novak', 'Haddad', 'Raman', 'Becker', 'Malik', 'Rossi', 'Fischer', 'Qureshi', 'Dubois', 'Ozturk', 'Chen', 'Mehta', 'Silva', 'Hussain', 'Wright', 'Farooq', 'Tanaka', 'Lopez', 'Iqbal', 'Moreau', 'Park', 'Ansari', 'Weber', 'Shah', 'Costa', 'Nakamura'];
const LABS = ['Northfield University — Cell Biology Lab', 'Crescent Bio Research', 'Lakeside Institute of Biochemistry', 'Meridian CRO Services', 'Harbor Peptide Analytics', 'Summit Independent Lab', 'Riverbend University Pharmacology Dept.', 'Atlas Biotech R&D', 'Greenway Molecular Lab', 'Eastgate Research Institute'];
const AREAS = [
  'receptor binding assays',
  'fibroblast scratch-wound assays in vitro',
  'mitochondrial respiration assays in cell lines',
  'peptide stability and degradation testing',
  'HPLC method development',
  'cell viability and proliferation assays',
  'collagen expression studies in cultured cells',
  'metabolic signalling in cell culture',
  'analytical reference standards',
  'protein-peptide interaction studies',
];
const INSTITUTIONS: [string, number][] = [['university', 40], ['biotech', 22], ['cro', 14], ['independent_lab', 18], ['other', 6]];
const SCALES: [string, number][] = [['single_vial', 35], ['small_batch', 45], ['bulk', 20]];
const LANGS: [string, number][] = [['en', 55], ['ur', 14], ['ar', 8], ['es', 6], ['hi', 5], ['fr', 4], ['de', 3], ['pt', 3], ['tr', 2]];
const OPENERS: Record<string, (p: string) => string> = {
  en: (p: string) => `Hi, do you have ${p} in stock with a COA?`,
  ur: (p: string) => `Assalam o alaikum, kya ${p} available hai? COA bhi chahiye.`,
  ar: (p: string) => `مرحبا، هل يتوفر ${p} مع شهادة تحليل؟`,
  es: (p: string) => `Hola, ¿tienen ${p} con certificado de análisis?`,
  hi: (p: string) => `Namaste, kya ${p} stock mein hai? COA ke saath?`,
  fr: (p: string) => `Bonjour, avez-vous du ${p} avec un certificat d'analyse ?`,
  de: (p: string) => `Hallo, haben Sie ${p} mit Analysezertifikat vorrätig?`,
  pt: (p: string) => `Olá, vocês têm ${p} com certificado de análise?`,
  tr: (p: string) => `Merhaba, ${p} analiz sertifikasıyla stokta var mı?`,
};
const COMPLIANCE: [string, number, string, string][] = [
  ['dosing', 50, 'How much should I take per day?', 'Asked for a dose — declined, research use only.'],
  ['human_use', 30, 'Is this safe to use on myself?', 'Asked about personal use — declined and ended the purchase help.'],
  ['medical_claim', 15, 'Will it help my injury heal faster?', 'Asked about a health benefit — declined, no medical claims.'],
  ['possible_minor', 5, "I'm buying it for my school project", 'Possible minor — sales conversation stopped.'],
];


function generate(products: DemoProduct[]) {
  resetRandom();
  const productWeights: [DemoProduct, number][] = products.map((p) => [p, p.is_best_seller ? 6 : 1]);
  const priceOf = (p: DemoProduct): { variant: string | null; price: number } => {
    if (p.variants.length) {
      const v = pick(p.variants);
      return { variant: v.label, price: Number(v.price) };
    }
    return { variant: null, price: p.price_min };
  };

  const now = Date.now();
  const start = now - DAYS * DAY;
  const rows: Record<'attest' | 'sessions' | 'research' | 'compliance' | 'events' | 'leads' | 'quotes' | 'orders' | 'customers' | 'newsletter', Row[]> = {
    attest: [], sessions: [], research: [], compliance: [], events: [], leads: [], quotes: [], orders: [], customers: [], newsletter: [],
  };
  let leadNo = 0;
  let personNo = 0;
  const person = () => {
    personNo++;
    const first = FIRST[(personNo * 7) % FIRST.length];
    const last = LAST[(personNo * 11) % LAST.length];
    return {
      name: `${first} ${last}`,
      email: `${first}.${last}.${personNo}`.toLowerCase() + '@demo.example',
      whatsapp: `+1555010${String(personNo % 10000).padStart(4, '0')}`,
    };
  };

  // Customers with accounts (password for all: DEMO_PASSWORD)
  const hash = hashPassword(DEMO_PASSWORD);
  const customers: { name: string; email: string; whatsapp: string; created: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const p = person();
    const created = start + rnd() * (DAYS - 5) * DAY;
    customers.push({ ...p, created });
    rows.customers.push({ email: p.email, password_hash: hash, name: p.name, whatsapp: p.whatsapp, created_at: Math.round(created), last_login_at: Math.round(created + rnd() * (now - created)) });
  }

  // Day by day: growing traffic, quieter weekends
  for (let d = 0; d <= DAYS; d++) {
    const dayStart = start + d * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const trend = 1 + (d / DAYS) * 3.2;
    const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const sessionsToday = Math.max(0, Math.round(trend * weekend + (rnd() - 0.4) * 2.2));

    // Visitors who confirmed the gate and browsed without talking to the assistant
    for (let v = 0, n = int(1, 3) + Math.round(trend); v < n; v++) {
      const at = Math.round(dayStart + rnd() * DAY);
      if (at > now) continue;
      rows.attest.push({ visitor_id: id('demo-v-', 8), age_confirmed: 1, researcher_confirmed: 1, user_agent: 'demo', created_at: at });
      for (let k = 0, m = int(1, 4); k < m; k++) {
        const p = weighted(productWeights);
        rows.events.push({ product_id: p.id, session_id: 'demo_web', type: 'view', created_at: at + k * 40_000 });
        if (chance(0.12)) rows.events.push({ product_id: p.id, session_id: 'demo_web', type: 'cart_add', created_at: at + k * 40_000 + 20_000 });
      }
    }

    for (let s = 0; s < sessionsToday; s++) {
      // mostly daytime (UTC+5 business hours ≈ 04:00–16:00 UTC)
      const at = Math.round(dayStart + (chance(0.75) ? (4 + rnd() * 12) : rnd() * 24) * 3_600_000);
      if (at > now - 60_000) continue;
      const sid = id('demo_', 12);
      const visitor = id('demo-v-', 8);
      const lang = weighted(LANGS);
      const interest = [weighted(productWeights)];
      if (chance(0.5)) interest.push(weighted(productWeights));
      if (chance(0.2)) interest.push(weighted(productWeights));
      const uniq = [...new Map(interest.map((p) => [p.id, p])).values()];
      const p1 = uniq[0];
      const scale = weighted(SCALES);
      const area = pick(AREAS);
      const institution = weighted(INSTITUTIONS);
      const coa = chance(0.7);
      const compliance = chance(0.08) ? weighted(COMPLIANCE.map((c) => [c, c[1]])) : null;

      // outcome funnel
      const outcome = compliance && compliance[0] !== 'dosing' ? 'none' : weighted([['none', 40], ['lead', 18], ['quote', 24], ['order', 18]]);

      let t = at;
      const msg = (role: string, text: string) => ({ id: '', role, text, at: (t += int(6, 40) * 1000) });
      const transcript = [
        msg('user', (OPENERS[lang] ?? OPENERS.en)(p1.name)),
        msg('ai', `Yes — ${p1.name} is in stock, lyophilized, ${p1.purity || '99%'} purity${coa ? ', and the Certificate of Analysis is on file' : ''}. It's supplied for laboratory research only. What will it be used for in your lab, and what quantity do you need?`),
        msg('user', `It's for ${area}. ${scale === 'bulk' ? 'We need a bulk quantity for several runs.' : scale === 'small_batch' ? 'A small batch, maybe five vials.' : 'Just one vial to start.'}`),
      ];
      if (uniq.length > 1) {
        transcript.push(msg('user', `Can you compare it with ${uniq[1].name}?`));
        transcript.push(msg('ai', `Here are the specs side by side: sizes, purity, price and COA availability for ${p1.name} and ${uniq[1].name}. I've opened the comparison card on your screen.`));
      }
      if (compliance) {
        transcript.push(msg('user', compliance[2]));
        transcript.push(msg('ai', "I can't help with dosing, personal use or health effects — these products are for laboratory research only and aren't for human or veterinary use. Please speak to a licensed professional for medical questions."));
      }
      if (outcome !== 'none') {
        transcript.push(msg('ai', 'I can prepare a quote brochure and send it to the store on WhatsApp. May I have your name and WhatsApp number?'));
        transcript.push(msg('user', 'Sure, I will fill it in the form.'));
      } else {
        transcript.push(msg('user', 'Thanks, I will check with my supervisor.'));
      }
      const turns = transcript.filter((m) => m.role === 'user').length;
      const ended = t + 20_000;
      const isOpen = now - at < 20 * 60_000;

      rows.attest.push({ visitor_id: visitor, age_confirmed: 1, researcher_confirmed: 1, user_agent: 'demo', created_at: at - 30_000 });
      rows.sessions.push({
        id: sid,
        visitor_id: visitor,
        language: lang,
        status: isOpen ? 'open' : 'closed',
        turn_count: turns,
        transcript: JSON.stringify(transcript),
        summary: isOpen
          ? null
          : JSON.stringify({
              intent: `${outcome === 'order' ? 'Ordered' : outcome === 'quote' ? 'Requested a quote for' : 'Enquired about'} ${uniq.map((p) => p.name).join(' and ')} (${scale.replace('_', ' ')}).`,
              products: uniq.map((p) => p.name),
              research_context: `${institution.replace('_', ' ')} lab working on ${area}.`,
              next_steps: outcome === 'none' ? ['Follow up if they return'] : ['Confirm stock and send invoice on WhatsApp', coa ? 'Attach COA' : 'Share purity data'],
              compliance_notes: compliance ? compliance[3] : '',
              language: lang,
            }),
        started_at: at,
        ended_at: isOpen ? null : ended,
      });
      if (chance(0.75)) {
        rows.research.push({
          session_id: sid,
          institution_type: institution,
          research_area: area,
          quantity_scale: scale,
          compounds: JSON.stringify(uniq.map((p) => p.slug)),
          coa_required: coa ? 1 : 0,
          updated_at: at + 60_000,
        });
      }
      if (compliance) rows.compliance.push({ session_id: sid, category: compliance[0], excerpt: compliance[3], created_at: at + 90_000 });

      for (const p of uniq) {
        rows.events.push({ product_id: p.id, session_id: sid, type: 'ai_recommend', created_at: at + 30_000 });
        for (let v = 0, n = int(1, 3); v < n; v++) rows.events.push({ product_id: p.id, session_id: sid, type: 'view', created_at: at + 45_000 + v * 15_000 });
      }
      if (outcome === 'none') continue;

      // lead
      const eligible = customers.filter((c) => c.created <= at);
      const cust = outcome === 'order' && eligible.length && chance(0.45) ? pick(eligible) : null;
      const who = cust ?? person();
      leadNo++;
      const source = outcome === 'order' ? 'checkout' : outcome === 'quote' ? (chance(0.6) ? 'bulk_quote' : 'voice') : 'voice';
      const leadAt = ended - 10_000;
      const leadEmail = cust ? `lead${leadNo}.${cust.email}` : who.email;
      rows.leads.push({
        session_id: sid,
        name: who.name,
        whatsapp: who.whatsapp,
        email: leadEmail,
        institution: chance(0.7) ? pick(LABS) : null,
        message: `Interested in ${uniq.map((p) => p.name).join(', ')} for ${area}.`,
        source,
        consent_whatsapp: 1,
        created_at: leadAt,
      });
      if (outcome === 'lead') continue;

      const items = uniq.map((p) => {
        const { variant, price } = priceOf(p);
        const qty = scale === 'bulk' ? int(10, 40) : scale === 'small_batch' ? int(3, 8) : int(1, 2);
        return { slug: p.slug, name: p.name, variant, price, qty, image_url: null };
      });
      for (const i of items) {
        const p = uniq.find((x) => x.slug === i.slug)!;
        rows.events.push({ product_id: p.id, session_id: sid, type: 'cart_add', created_at: leadAt - 5_000 });
        rows.events.push({ product_id: p.id, session_id: sid, type: outcome === 'order' ? 'order' : 'quote', created_at: leadAt });
      }
      const subtotal = round2(items.reduce((a, i) => a + i.price * i.qty, 0));
      rows.quotes.push({ id: id('demo', 6), session_id: sid, leadEmail, items: JSON.stringify(items), subtotal, channel: 'wa_link', created_at: leadAt + 1_000 });

      if (outcome === 'order') {
        const code = chance(0.3) ? 'NEW20' : null;
        const discount = code ? round2(subtotal * 0.2) : 0;
        const age = (now - at) / DAY;
        const status = chance(0.05) ? 'rejected' : age > 12 ? weighted([['shipped', 80], ['paid', 20]]) : age > 4 ? weighted([['paid', 50], ['invoiced', 35], ['shipped', 15]]) : weighted([['pending_review', 70], ['invoiced', 30]]);
        rows.orders.push({
          session_id: sid,
          leadEmail,
          customerEmail: cust?.email ?? null,
          items: JSON.stringify(items),
          subtotal,
          discount_code: code,
          discount,
          total: round2(subtotal - discount),
          institution: '',
          ship_address: chance(0.4) ? 'Please ship with cold packs.' : '',
          attested: 1,
          status,
          created_at: leadAt + 2_000,
        });
      }
    }
  }

  // Contact-form leads without a voice session
  for (let i = 0; i < 16; i++) {
    const who = person();
    rows.leads.push({
      session_id: null,
      name: who.name,
      whatsapp: who.whatsapp,
      email: who.email,
      institution: pick(LABS),
      message: `Please send your price list for ${pick(products).name} and COA copies.`,
      source: 'contact',
      consent_whatsapp: chance(0.8) ? 1 : 0,
      created_at: Math.round(start + rnd() * DAYS * DAY),
    });
  }
  for (let i = 0; i < 38; i++) rows.newsletter.push({ email: `subscriber${i + 1}@demo.example`, created_at: Math.round(start + rnd() * DAYS * DAY) });

  return rows;
}

// ─────────── database ───────────

async function removeIn(db: Db) {
  const orders = await db.exec(`DELETE FROM orders WHERE lead_id IN (SELECT id FROM leads WHERE email LIKE '%@demo.example')
    OR customer_id IN (SELECT id FROM customers WHERE email LIKE '%@demo.example')`);
  const quotes = await db.exec(`DELETE FROM quotes WHERE id LIKE 'demo%'`);
  const leads = await db.exec(`DELETE FROM leads WHERE email LIKE '%@demo.example'`);
  const customers = await db.exec(`DELETE FROM customers WHERE email LIKE '%@demo.example'`);
  const events = await db.exec(`DELETE FROM product_events WHERE session_id LIKE 'demo%'`);
  const sessions = await db.exec(`DELETE FROM chat_sessions WHERE id LIKE 'demo%'`); // also removes their research context + compliance rows
  const attestations = await db.exec(`DELETE FROM attestations WHERE visitor_id LIKE 'demo%'`);
  const newsletter = await db.exec(`DELETE FROM newsletter WHERE email LIKE '%@demo.example'`);
  return { sessions, leads, quotes, orders, customers, events, attestations, newsletter };
}

/** Multi-row INSERT in chunks (one round trip per 400 rows). */
async function insertMany(db: Db, table: string, list: Row[], cols: string[]) {
  for (let i = 0; i < list.length; i += 400) {
    const chunk = list.slice(i, i + 400);
    if (!chunk.length) continue;
    const values = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
    await db.exec(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values}`, chunk.flatMap((r) => cols.map((c) => r[c] ?? null)));
  }
}

/** How much demo data is in the database right now. */
export async function demoCounts() {
  const r = await one<{ sessions: number; leads: number; orders: number; customers: number }>(
    `SELECT
       (SELECT COUNT(*) FROM chat_sessions WHERE id LIKE 'demo%') AS sessions,
       (SELECT COUNT(*) FROM leads WHERE email LIKE '%@demo.example') AS leads,
       (SELECT COUNT(*) FROM orders o JOIN leads l ON l.id = o.lead_id WHERE l.email LIKE '%@demo.example') AS orders,
       (SELECT COUNT(*) FROM customers WHERE email LIKE '%@demo.example') AS customers`,
  );
  const c = { sessions: Number(r?.sessions ?? 0), leads: Number(r?.leads ?? 0), orders: Number(r?.orders ?? 0), customers: Number(r?.customers ?? 0) };
  return { ...c, present: c.sessions + c.leads + c.orders + c.customers > 0 };
}

/** Deletes every demo row. Real data and products are never touched. */
export async function removeDemoData() {
  return tx((db) => removeIn(db));
}

/** Adds (or replaces) the demo data in one transaction. */
export async function loadDemoData() {
  const products = (
    await q<{ id: number; slug: string; name: string; price_min: number; price_max: number; purity: string; variants: string; is_best_seller: number }>(
      `SELECT id, slug, name, price_min, price_max, purity, variants, is_best_seller FROM products WHERE status = 'active'`,
    )
  ).map((p) => {
    let variants: DemoProduct['variants'] = [];
    try {
      variants = JSON.parse(p.variants);
    } catch {}
    return { ...p, id: Number(p.id), price_min: Number(p.price_min), price_max: Number(p.price_max), variants };
  });
  if (!products.length) throw new Error('Add at least one active product first.');
  const rows = generate(products);

  await tx(async (db) => {
    await removeIn(db);
    await insertMany(db, 'customers', rows.customers, ['email', 'password_hash', 'name', 'whatsapp', 'created_at', 'last_login_at']);
    await insertMany(db, 'attestations', rows.attest, ['visitor_id', 'age_confirmed', 'researcher_confirmed', 'user_agent', 'created_at']);
    await insertMany(db, 'chat_sessions', rows.sessions, ['id', 'visitor_id', 'language', 'status', 'turn_count', 'transcript', 'summary', 'started_at', 'ended_at']);
    await insertMany(db, 'research_context', rows.research, ['session_id', 'institution_type', 'research_area', 'quantity_scale', 'compounds', 'coa_required', 'updated_at']);
    await insertMany(db, 'compliance_events', rows.compliance, ['session_id', 'category', 'excerpt', 'created_at']);
    await insertMany(db, 'product_events', rows.events, ['product_id', 'session_id', 'type', 'created_at']);
    await insertMany(db, 'leads', rows.leads, ['session_id', 'name', 'whatsapp', 'email', 'institution', 'message', 'source', 'consent_whatsapp', 'created_at']);
    await insertMany(db, 'newsletter', rows.newsletter, ['email', 'created_at']);
    // map emails to the ids Postgres gave the new leads/customers
    const leadIds = new Map((await db.q<{ id: number; email: string }>(`SELECT id, email FROM leads WHERE email LIKE '%@demo.example'`)).map((r) => [r.email, Number(r.id)]));
    const custIds = new Map((await db.q<{ id: number; email: string }>(`SELECT id, email FROM customers WHERE email LIKE '%@demo.example'`)).map((r) => [r.email, Number(r.id)]));
    await insertMany(
      db,
      'quotes',
      rows.quotes.map(({ leadEmail, ...r }) => ({ ...r, lead_id: leadIds.get(String(leadEmail)) ?? null })),
      ['id', 'session_id', 'lead_id', 'items', 'subtotal', 'channel', 'created_at'],
    );
    await insertMany(
      db,
      'orders',
      rows.orders.map(({ leadEmail, customerEmail, ...r }) => ({
        ...r,
        lead_id: leadIds.get(String(leadEmail)) ?? null,
        customer_id: customerEmail ? (custIds.get(String(customerEmail)) ?? null) : null,
      })),
      ['session_id', 'lead_id', 'customer_id', 'items', 'subtotal', 'discount_code', 'discount', 'total', 'institution', 'ship_address', 'attested', 'status', 'created_at'],
    );
  });
  return { sessions: rows.sessions.length, leads: rows.leads.length, quotes: rows.quotes.length, orders: rows.orders.length, customers: rows.customers.length };
}
