/**
 * Engangsmigration: JSON-filer → PostgreSQL
 * Kør: node migrate-json-to-db.js
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function læs(fil) {
  const p = path.join(__dirname, fil);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function kørSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema oprettet');
}

async function migrerShops() {
  const shops = læs('shops.json');
  if (!shops) return console.log('Ingen shops.json fundet — springer over');

  for (const s of Object.values(shops)) {
    // Hash password hvis det ikke allerede er hashet
    const erHashet = s.password?.startsWith('$2');
    const passwordHash = erHashet ? s.password : await bcrypt.hash(s.password || 'skift-mig', 12);

    await pool.query(
      `INSERT INTO shops (email, password_hash, woo_url, woo_key, woo_secret, plan, aktiv, demo, branche, oprettet, sidst_aktiv)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (email) DO NOTHING`,
      [
        s.email,
        passwordHash,
        s.wooUrl || null,
        s.wooKey || null,
        s.wooSecret || null,
        s.plan || 'gratis',
        s.aktiv !== false,
        s.demo || false,
        s.branche || null,
        s.oprettet ? new Date(s.oprettet) : new Date(),
        s.sidstAktiv ? new Date(s.sidstAktiv) : null
      ]
    );
    console.log(`Shop migreret: ${s.email}`);
  }
}

async function migrerKampagner() {
  const data = læs('kampagner.json');
  if (!data) return console.log('Ingen kampagner.json fundet — springer over');

  for (const [shopEmail, kampagner] of Object.entries(data)) {
    for (const k of kampagner) {
      await pool.query(
        `INSERT INTO kampagner (shop_email, dato, emne, type, antal_modtagere, rabat_kode)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [shopEmail, k.dato || new Date().toISOString().split('T')[0], k.emne || null, k.type || null, k.antalModtagere || 0, k.rabatKode || null]
      ).catch(() => {}); // Spring over hvis shop ikke findes
    }
    console.log(`Kampagner migreret for: ${shopEmail}`);
  }
}

async function migrerEvents() {
  const events = læs('events.json');
  if (!events || !Array.isArray(events)) return console.log('Ingen events.json fundet — springer over');

  for (const e of events) {
    await pool.query(
      `INSERT INTO events (id, type, ts, shop_id, data)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [e.id, e.type, new Date(e.ts), e.shopId, e.data || {}]
    );
  }
  console.log(`${events.length} events migreret`);
}

async function main() {
  try {
    await kørSchema();
    await migrerShops();
    await migrerKampagner();
    await migrerEvents();
    console.log('\nMigration færdig!');
  } catch (err) {
    console.error('Migration fejl:', err.message);
  } finally {
    await pool.end();
  }
}

main();
