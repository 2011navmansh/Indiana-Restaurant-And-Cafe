-- ============================================================
-- Indiana Restaurant & Cafe — Cloudflare D1 schema
-- Paste this in: Cloudflare Dashboard -> D1 -> your database -> Console -> Execute
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  date        TEXT NOT NULL,          -- YYYY-MM-DD
  time        TEXT NOT NULL,          -- e.g. "7:30 PM"
  guests      INTEGER NOT NULL DEFAULT 2,
  seating     TEXT,
  occasion    TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | seated | cancelled | no_show
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  phone       TEXT,
  items       TEXT,                    -- JSON string of [{name,qty,price}]
  total       INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'new',       -- new | preparing | served | paid | cancelled
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('door_open', '1');

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  createdAt  TEXT NOT NULL,
  expiresAt  TEXT NOT NULL
);
