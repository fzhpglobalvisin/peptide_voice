/**
 * Raw SQLite schema. No ORM. Every hot path is covered by an index.
 * Timestamps are INTEGER unix milliseconds so range filters stay index-friendly.
 */
export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  category       TEXT    NOT NULL DEFAULT 'peptide' CHECK (category IN ('peptide','blend','supply')),
  price_min      REAL    NOT NULL,
  price_max      REAL    NOT NULL,
  variants       TEXT    NOT NULL DEFAULT '[]',          -- JSON [{ "label": "5mg", "price": 40.0 }]
  purity         TEXT    NOT NULL DEFAULT '99%',
  description    TEXT    NOT NULL DEFAULT '',
  image_url      TEXT,
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_products_status_name ON products(status, name);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(status, category, name);
CREATE INDEX IF NOT EXISTS idx_products_best        ON products(sort_order) WHERE is_best_seller = 1 AND status = 'active';

-- Full-text catalog search (powers the assistant's catalog RAG and the shop search box)
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, description, category,
  content='products', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, description, category) VALUES (new.id, new.name, new.description, new.category);
END;
CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, category) VALUES ('delete', old.id, old.name, old.description, old.category);
END;
CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, category) VALUES ('delete', old.id, old.name, old.description, old.category);
  INSERT INTO products_fts(rowid, name, description, category) VALUES (new.id, new.name, new.description, new.category);
END;

CREATE TABLE IF NOT EXISTS coas (
  id           INTEGER PRIMARY KEY,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  label        TEXT    NOT NULL,               -- e.g. "Tirzepatide 10mg"
  batch        TEXT    NOT NULL DEFAULT 'N/A',
  test_date    TEXT    NOT NULL,               -- ISO yyyy-mm-dd
  file_size_mb REAL,
  file_url     TEXT,
  status       TEXT    NOT NULL DEFAULT 'current' CHECK (status IN ('current','archived'))
);
CREATE INDEX IF NOT EXISTS idx_coas_product ON coas(product_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_coas_label   ON coas(label COLLATE NOCASE);

-- Researcher gate attestations (compliance record: who confirmed what, when)
CREATE TABLE IF NOT EXISTS attestations (
  id                   INTEGER PRIMARY KEY,
  visitor_id           TEXT    NOT NULL,
  age_confirmed        INTEGER NOT NULL,
  researcher_confirmed INTEGER NOT NULL,
  user_agent           TEXT,
  created_at           INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_attest_visitor ON attestations(visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT    PRIMARY KEY,
  visitor_id  TEXT    NOT NULL,
  language    TEXT,
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  turn_count  INTEGER NOT NULL DEFAULT 0,
  transcript  TEXT    NOT NULL DEFAULT '[]',   -- JSON [{ role, text, at }]
  summary     TEXT,                            -- JSON { intent, products, next_steps, compliance_notes, language }
  started_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  ended_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON chat_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_lang    ON chat_sessions(language);

-- Research context (replaces personal demographics: no age, gender or health data is collected)
CREATE TABLE IF NOT EXISTS research_context (
  session_id       TEXT PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  institution_type TEXT,     -- university | biotech | cro | independent_lab | other
  research_area    TEXT,
  quantity_scale   TEXT,     -- single_vial | small_batch | bulk
  compounds        TEXT NOT NULL DEFAULT '[]',
  coa_required     INTEGER,
  updated_at       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_rc_inst  ON research_context(institution_type);
CREATE INDEX IF NOT EXISTS idx_rc_scale ON research_context(quantity_scale);

CREATE TABLE IF NOT EXISTS leads (
  id               INTEGER PRIMARY KEY,
  session_id       TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  whatsapp         TEXT,
  email            TEXT,
  institution      TEXT,
  message          TEXT,
  source           TEXT NOT NULL CHECK (source IN ('voice','contact','bulk_quote','checkout')),
  consent_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source  ON leads(source, created_at DESC);

CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,               -- short public id used in /quote/[id]
  session_id  TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  items       TEXT NOT NULL,                  -- JSON cart snapshot
  subtotal    REAL NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'wa_link' CHECK (channel IN ('wa_link','wa_cloud')),
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);

-- Order requests (no card data is ever stored; the team invoices after review)
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  session_id    TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
  lead_id       INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  items         TEXT NOT NULL,
  subtotal      REAL NOT NULL,
  discount_code TEXT,
  discount      REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL,
  institution   TEXT NOT NULL,
  ship_address  TEXT NOT NULL,
  attested      INTEGER NOT NULL CHECK (attested = 1),
  status        TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','invoiced','paid','shipped','rejected')),
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS product_events (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_id  TEXT,
  type        TEXT NOT NULL CHECK (type IN ('view','ai_recommend','cart_add','quote','order')),
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_events_product_type ON product_events(product_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_created      ON product_events(created_at);

-- Every time the assistant declines a dosing / human-use / medical question
CREATE TABLE IF NOT EXISTS compliance_events (
  id          INTEGER PRIMARY KEY,
  session_id  TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('dosing','human_use','medical_claim','possible_minor','veterinary','other')),
  excerpt     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_compliance_created ON compliance_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_cat     ON compliance_events(category);

CREATE TABLE IF NOT EXISTS newsletter (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- Admin accounts. Seeded once from ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL, then managed in /admin/account.
CREATE TABLE IF NOT EXISTS admin_users (
  id              INTEGER PRIMARY KEY,
  username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT    NOT NULL DEFAULT '' COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,                 -- scrypt:<salt>:<hash>
  session_version INTEGER NOT NULL DEFAULT 1,       -- bumped on password change → signs out old sessions
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);

-- One-time password reset links (only a SHA-256 of the token is stored)
CREATE TABLE IF NOT EXISTS admin_resets (
  token_hash TEXT    PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

-- Customer accounts (My Account). Login by email + password; orders link to the account.
CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  name            TEXT    NOT NULL DEFAULT '',
  whatsapp        TEXT    NOT NULL DEFAULT '',
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  last_login_at   INTEGER
);
`;
