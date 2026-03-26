-- Webshop Co-pilot database schema

CREATE TABLE IF NOT EXISTS shops (
  email        TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  woo_url      TEXT,
  woo_key      TEXT,
  woo_secret   TEXT,
  platform     TEXT NOT NULL DEFAULT 'woocommerce',
  plan         TEXT NOT NULL DEFAULT 'gratis',
  aktiv        BOOLEAN NOT NULL DEFAULT true,
  demo         BOOLEAN NOT NULL DEFAULT false,
  branche      TEXT,
  oprettet     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sidst_aktiv  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type    TEXT NOT NULL,
  ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
  shop_id TEXT NOT NULL,
  data    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);

CREATE TABLE IF NOT EXISTS afmeldinger (
  shop_email   TEXT NOT NULL,
  kunde_email  TEXT NOT NULL,
  afmeldt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_email, kunde_email)
);

CREATE TABLE IF NOT EXISTS kampagner (
  id               BIGSERIAL PRIMARY KEY,
  shop_email       TEXT NOT NULL REFERENCES shops(email) ON DELETE CASCADE,
  dato             DATE NOT NULL DEFAULT CURRENT_DATE,
  emne             TEXT,
  type             TEXT,
  antal_modtagere  INT,
  rabat_kode       TEXT
);

CREATE TABLE IF NOT EXISTS marginer (
  shop_email  TEXT PRIMARY KEY REFERENCES shops(email) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS triggers (
  shop_email   TEXT PRIMARY KEY REFERENCES shops(email) ON DELETE CASCADE,
  aktiv        BOOLEAN NOT NULL DEFAULT false,
  dage         INT NOT NULL DEFAULT 60,
  sidst_koert  DATE,
  review                   BOOLEAN NOT NULL DEFAULT false,
  review_dage              INT NOT NULL DEFAULT 7,
  ugerapport               BOOLEAN NOT NULL DEFAULT false,
  genaktiver_emne          TEXT,
  genaktiver_tekst         TEXT,
  review_emne              TEXT,
  review_tekst             TEXT,
  genaktiver_rabat_procent INT,
  genaktiver_rabat_dage    INT NOT NULL DEFAULT 14,
  review_rabat_procent     INT,
  review_rabat_dage        INT NOT NULL DEFAULT 14
);
