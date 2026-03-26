import pool from './db.js';

export async function hentMarginer(shopEmail) {
  const result = await pool.query(
    'SELECT data FROM marginer WHERE shop_email = $1',
    [shopEmail]
  );
  return result.rows[0]?.data || {};
}

export async function gemMarginer(shopEmail, marginer) {
  await pool.query(
    `INSERT INTO marginer (shop_email, data)
     VALUES ($1, $2)
     ON CONFLICT (shop_email) DO UPDATE SET data = EXCLUDED.data`,
    [shopEmail, marginer]
  );
}

export function beregnMarginer(topProdukter, marginer) {
  return topProdukter.map(p => {
    const kostpris = marginer[p.navn] != null ? parseFloat(marginer[p.navn]) : null;
    const salgspris = p.antalSolgt > 0 ? p.omsaetning / p.antalSolgt : 0;
    const marginPct = kostpris && salgspris > 0 ? Math.round(((salgspris - kostpris) / salgspris) * 100) : null;
    const profit = kostpris ? Math.round(p.omsaetning - kostpris * p.antalSolgt) : null;
    return { ...p, kostpris, salgspris: Math.round(salgspris), marginPct, profit };
  });
}
