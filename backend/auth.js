import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

export async function registerShop({ email, password, wooUrl, wooKey, wooSecret, platform }) {
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO shops (email, password_hash, woo_url, woo_key, woo_secret, platform)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING email, plan, aktiv, demo, oprettet`,
    [email, passwordHash, wooUrl, wooKey, wooSecret || null, platform || 'woocommerce']
  );

  const shop = result.rows[0];
  return jwt.sign({ email: shop.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export async function loginShop({ email, password }) {
  const result = await pool.query(
    'SELECT * FROM shops WHERE email = $1',
    [email]
  );

  const shop = result.rows[0];
  if (!shop) throw new Error('Forkert email eller adgangskode');

  const match = await bcrypt.compare(password, shop.password_hash);
  if (!match) throw new Error('Forkert email eller adgangskode');

  await pool.query(
    'UPDATE shops SET sidst_aktiv = now() WHERE email = $1',
    [email]
  );

  return jwt.sign({ email: shop.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export async function anmodNulstilAdgangskode(email) {
  const result = await pool.query('SELECT email FROM shops WHERE email = $1', [email]);
  if (!result.rows[0]) return; // Giv ikke info om hvorvidt emailen findes

  const token = crypto.randomBytes(32).toString('hex');
  const udloeber = new Date(Date.now() + 60 * 60 * 1000); // 1 time

  await pool.query(
    'UPDATE shops SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
    [token, udloeber, email]
  );

  return token;
}

export async function nulstilAdgangskode(token, nyAdgangskode) {
  const result = await pool.query(
    'SELECT email FROM shops WHERE reset_token = $1 AND reset_token_expires > now()',
    [token]
  );
  if (!result.rows[0]) throw new Error('Linket er ugyldigt eller udløbet.');

  const passwordHash = await bcrypt.hash(nyAdgangskode, 12);
  await pool.query(
    'UPDATE shops SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2',
    [passwordHash, result.rows[0].email]
  );
}

export async function requireAuth(req, res, next) {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Ikke logget ind' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Ugyldig eller udløbet session — log ind igen' });
  }

  const result = await pool.query(
    'SELECT email, woo_url AS "wooUrl", woo_key AS "wooKey", woo_secret AS "wooSecret", platform, plan, aktiv, demo FROM shops WHERE email = $1',
    [payload.email]
  );

  const shop = result.rows[0];
  if (!shop) return res.status(401).json({ error: 'Shop ikke fundet' });

  req.shop = shop;
  next();
}
