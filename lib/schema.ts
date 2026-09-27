/**
 * PostgreSQL schema (Neon, Supabase, Vercel Postgres or any Postgres 13+).
 * Idempotent: safe to run on every cold start. Timestamps are BIGINT unix milliseconds.
 */
const NOW_MS = `(floor(extract(epoch from clock_timestamp()) * 1000))::bigint`;

export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS products (
  id             BIGSERIAL PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  category       TEXT    NOT NULL DEFAULT 'peptide' CHECK (category IN ('peptide','blend','supply')),
  price_min      DOUBLE PRECISION NOT NULL,
  price_max      DOUBLE PRECISION NOT NULL,
  variants       TEXT    NOT NULL DEFAULT '[]',
  purity         TEXT    NOT NULL DEFAULT '99%',
  description    TEXT    NOT NULL DEFAULT '',
  image_url      TEXT,
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at     BIGINT  NOT NULL DEFAULT ${NOW_MS},
  updated_at     BIGINT  NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_products_status_name ON products(status, name);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(status, category, name);
CREATE INDEX IF NOT EXISTS idx_products_best        ON products(sort_order) WHERE is_best_seller = 1 AND status = 'active';

CREATE TABLE IF NOT EXISTS coas (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  label        TEXT    NOT NULL,
  batch        TEXT    NOT NULL DEFAULT 'N/A',
  test_date    TEXT    NOT NULL,
  file_size_mb DOUBLE PRECISION,
  file_url     TEXT,
  status       TEXT    NOT NULL DEFAULT 'current' CHECK (status IN ('current','archived'))
);
CREATE INDEX IF NOT EXISTS idx_coas_product ON coas(product_id, test_date DESC);

CREATE TABLE IF NOT EXISTS attestations (
  id                   BIGSERIAL PRIMARY KEY,
  visitor_id           TEXT    NOT NULL,
  age_confirmed        INTEGER NOT NULL,
  researcher_confirmed INTEGER NOT NULL,
  user_agent           TEXT,
  created_at           BIGINT  NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_attest_visitor ON attestations(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attest_created ON attestations(created_at);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT    PRIMARY KEY,
  visitor_id  TEXT    NOT NULL,
  language    TEXT,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  turn_count  INTEGER NOT NULL DEFAULT 0,
  transcript  TEXT    NOT NULL DEFAULT '[]',
  summary     TEXT,
  started_at  BIGINT  NOT NULL DEFAULT ${NOW_MS},
  ended_at    BIGINT
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON chat_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_lang    ON chat_sessions(language);

CREATE TABLE IF NOT EXISTS research_context (
  session_id       TEXT PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  institution_type TEXT,
  research_area    TEXT,
  quantity_scale   TEXT,
  compounds        TEXT NOT NULL DEFAULT '[]',
  coa_required     INTEGER,
  updated_at       BIGINT NOT NULL DEFAULT ${NOW_MS}
);

CREATE TABLE IF NOT EXISTS customers (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT    NOT NULL,
  password_hash   TEXT    NOT NULL,
  name            TEXT    NOT NULL DEFAULT '',
  whatsapp        TEXT    NOT NULL DEFAULT '',
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at      BIGINT  NOT NULL DEFAULT ${NOW_MS},
  last_login_at   BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(lower(email));

CREATE TABLE IF NOT EXISTS leads (
  id               BIGSERIAL PRIMARY KEY,
  session_id       TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  whatsapp         TEXT,
  email            TEXT,
  institution      TEXT,
  message          TEXT,
  source           TEXT NOT NULL CHECK (source IN ('voice','contact','bulk_quote','checkout')),
  consent_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at       BIGINT NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source  ON leads(source, created_at DESC);

CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  session_id  TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  lead_id     BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  items       TEXT NOT NULL,
  subtotal    DOUBLE PRECISION NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'wa_link' CHECK (channel IN ('wa_link','wa_cloud')),
  created_at  BIGINT NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id            BIGSERIAL PRIMARY KEY,
  session_id    TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  lead_id       BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id   BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  items         TEXT NOT NULL,
  subtotal      DOUBLE PRECISION NOT NULL,
  discount_code TEXT,
  discount      DOUBLE PRECISION NOT NULL DEFAULT 0,
  total         DOUBLE PRECISION NOT NULL,
  institution   TEXT NOT NULL DEFAULT '',
  ship_address  TEXT NOT NULL DEFAULT '',
  attested      INTEGER NOT NULL CHECK (attested = 1),
  status        TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','invoiced','paid','shipped','rejected')),
  created_at    BIGINT NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_events (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_id  TEXT,
  type        TEXT NOT NULL CHECK (type IN ('view','ai_recommend','cart_add','quote','order')),
  created_at  BIGINT NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_events_product_type ON product_events(product_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_created      ON product_events(created_at);

CREATE TABLE IF NOT EXISTS compliance_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('dosing','human_use','medical_claim','possible_minor','veterinary','other')),
  excerpt     TEXT,
  created_at  BIGINT NOT NULL DEFAULT ${NOW_MS}
);
CREATE INDEX IF NOT EXISTS idx_compliance_created ON compliance_events(created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter (
  email      TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL DEFAULT ${NOW_MS}
);

CREATE TABLE IF NOT EXISTS admin_users (
  id              BIGSERIAL PRIMARY KEY,
  username        TEXT    NOT NULL,
  email           TEXT    NOT NULL DEFAULT '',
  password_hash   TEXT    NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  updated_at      BIGINT  NOT NULL DEFAULT ${NOW_MS}
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_username ON admin_users(lower(username));
CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(lower(email));

CREATE TABLE IF NOT EXISTS admin_resets (
  token_hash TEXT   PRIMARY KEY,
  admin_id   BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  used_at    BIGINT
);

CREATE TABLE IF NOT EXISTS admin_passkeys (
  id           TEXT    PRIMARY KEY,
  admin_id     BIGINT  NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  public_key   BYTEA   NOT NULL,
  counter      BIGINT  NOT NULL DEFAULT 0,
  transports   TEXT    NOT NULL DEFAULT '[]',
  name         TEXT    NOT NULL DEFAULT 'Passkey',
  created_at   BIGINT  NOT NULL DEFAULT ${NOW_MS},
  last_used_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_passkeys_admin ON admin_passkeys(admin_id);
`;
