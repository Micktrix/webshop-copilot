import crypto from 'crypto';
import pool from './db.js';

function anonymiserShop(email) {
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 12);
}

export async function logEvent(type, shopEmail, data = {}) {
  await pool.query(
    `INSERT INTO events (type, shop_id, data) VALUES ($1, $2, $3)`,
    [type, anonymiserShop(shopEmail), data]
  );
}

export async function hentAggregeredeStats() {
  const [totals, mailSum, seneste] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(DISTINCT shop_id)                                        AS "unikeShops",
        COUNT(*)                                                       AS "totalEvents",
        COUNT(*) FILTER (WHERE type = 'dashboard_load')               AS "dashboardKald",
        COUNT(*) FILTER (WHERE type = 'trigger_fired')                AS "triggersKoert",
        AVG((data->>'churnRate')::numeric)
          FILTER (WHERE type = 'dashboard_load' AND data ? 'churnRate') AS "avgChurnRate",
        AVG((data->>'omsaetning')::numeric)
          FILTER (WHERE type = 'dashboard_load' AND data ? 'omsaetning') AS "avgOmsaetning",
        AVG((data->>'nyeKunder')::numeric)
          FILTER (WHERE type = 'dashboard_load' AND data ? 'nyeKunder') AS "avgNyeKunder"
      FROM events
    `),
    pool.query(`
      SELECT COALESCE(SUM((data->>'antal')::int), 0) AS sum
      FROM events WHERE type = 'mail_sent'
    `),
    pool.query(`
      SELECT type, ts, shop_id AS "shopId", data
      FROM events
      ORDER BY ts DESC
      LIMIT 20
    `)
  ]);

  const t = totals.rows[0];
  const round2 = v => v != null ? Math.round(parseFloat(v) * 100) / 100 : null;

  return {
    unikeShops:    parseInt(t.unikeShops),
    totalEvents:   parseInt(t.totalEvents),
    dashboardKald: parseInt(t.dashboardKald),
    mailsSendt:    parseInt(mailSum.rows[0].sum),
    triggersKoert: parseInt(t.triggersKoert),
    gennemsnit: {
      churnRate:  round2(t.avgChurnRate),
      omsaetning: round2(t.avgOmsaetning),
      nyeKunder:  round2(t.avgNyeKunder)
    },
    seneste: seneste.rows
  };
}
