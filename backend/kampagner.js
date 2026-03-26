import pool from './db.js';

export async function gemKampagne(shopEmail, kampagne) {
  const { emne, type, antalModtagere, rabatKode } = kampagne;
  await pool.query(
    `INSERT INTO kampagner (shop_email, emne, type, antal_modtagere, rabat_kode)
     VALUES ($1, $2, $3, $4, $5)`,
    [shopEmail, emne || null, type || null, antalModtagere || 0, rabatKode || null]
  );
}

export async function hentKampagner(shopEmail) {
  const result = await pool.query(
    `SELECT id, dato, emne, type,
            antal_modtagere AS "antalModtagere",
            rabat_kode      AS "rabatKode"
     FROM kampagner
     WHERE shop_email = $1
     ORDER BY id DESC`,
    [shopEmail]
  );
  return result.rows;
}
