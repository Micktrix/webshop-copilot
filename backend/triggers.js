import pool from './db.js';
import { createWooClient, getOrders, getCustomers } from './woo.js';
import { beregnChurn } from './analytics.js';
import { genererMail, sendMails } from './mail.js';

const DEFAULT_TRIGGER = { aktiv: false, dage: 60, sidstKoert: null, review: false, reviewDage: 7, ugerapport: false };

export async function hentTrigger(shopEmail) {
  const result = await pool.query(
    `SELECT aktiv, dage, sidst_koert AS "sidstKoert",
            review, review_dage AS "reviewDage", ugerapport
     FROM triggers WHERE shop_email = $1`,
    [shopEmail]
  );
  return result.rows[0] || DEFAULT_TRIGGER;
}

export async function gemTrigger(shopEmail, config) {
  const { aktiv, dage, review, reviewDage, ugerapport } = config;
  await pool.query(
    `INSERT INTO triggers (shop_email, aktiv, dage, review, review_dage, ugerapport)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (shop_email) DO UPDATE SET
       aktiv       = EXCLUDED.aktiv,
       dage        = EXCLUDED.dage,
       review      = EXCLUDED.review,
       review_dage = EXCLUDED.review_dage,
       ugerapport  = EXCLUDED.ugerapport`,
    [shopEmail, aktiv ?? false, dage ?? 60, review ?? false, reviewDage ?? 7, ugerapport ?? false]
  );
}

export async function koerTriggers(shops) {
  const iDag = new Date().toISOString().split('T')[0];

  for (const shop of shops) {
    const trigger = await hentTrigger(shop.email);
    if (!trigger.aktiv) continue;
    if (trigger.sidstKoert === iDag) continue;

    try {
      const client = createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret);
      const [orders, customers] = await Promise.all([getOrders(client), getCustomers(client)]);

      // Genaktiveringsmail
      const churn = beregnChurn(orders, customers, trigger.dage);
      if (churn.ifare.length > 0) {
        const mail = await genererMail('genaktiver', churn.ifare, shop.wooUrl, null);
        await sendMails(churn.ifare, mail.emne, mail.tekst);
        console.log(`Auto-trigger genaktiver: ${churn.ifare.length} kunder for ${shop.email}`);
      }

      // Review-anmodning X dage efter køb
      if (trigger.review) {
        const dage = trigger.reviewDage || 7;
        const fra = new Date(); fra.setDate(fra.getDate() - dage - 1);
        const til = new Date(); til.setDate(til.getDate() - dage);
        const reviewKunder = orders
          .filter(o => { const d = new Date(o.date_created); return d >= fra && d <= til && o.billing?.email; })
          .map(o => ({ id: o.customer_id, navn: `${o.billing.first_name} ${o.billing.last_name}`.trim(), email: o.billing.email }));
        if (reviewKunder.length > 0) {
          const reviewMail = await genererMail('review', reviewKunder, shop.wooUrl, null);
          await sendMails(reviewKunder, reviewMail.emne, reviewMail.tekst);
          console.log(`Auto-trigger review: ${reviewKunder.length} kunder for ${shop.email}`);
        }
      }

      await pool.query(
        `UPDATE triggers SET sidst_koert = $1 WHERE shop_email = $2`,
        [iDag, shop.email]
      );
    } catch (err) {
      console.warn(`Trigger fejl for ${shop.email}:`, err.message);
    }
  }
}
