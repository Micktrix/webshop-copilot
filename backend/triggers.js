import pool from './db.js';
import { createWooClient, getOrders, getCustomers } from './woo.js';
import { beregnChurn } from './analytics.js';
import { genererMail, sendMails } from './mail.js';

const DEFAULT_TRIGGER = {
  aktiv: false, dage: 60, sidstKoert: null,
  review: false, reviewDage: 7, ugerapport: false,
  genaktiverEmne: '', genaktiverTekst: '',
  reviewEmne: '', reviewTekst: ''
};

export async function hentTrigger(shopEmail) {
  const result = await pool.query(
    `SELECT aktiv, dage, sidst_koert AS "sidstKoert",
            review, review_dage AS "reviewDage", ugerapport,
            genaktiver_emne AS "genaktiverEmne", genaktiver_tekst AS "genaktiverTekst",
            review_emne AS "reviewEmne", review_tekst AS "reviewTekst"
     FROM triggers WHERE shop_email = $1`,
    [shopEmail]
  );
  return result.rows[0] || DEFAULT_TRIGGER;
}

export async function gemTrigger(shopEmail, config) {
  const { aktiv, dage, review, reviewDage, ugerapport, genaktiverEmne, genaktiverTekst, reviewEmne, reviewTekst } = config;
  await pool.query(
    `INSERT INTO triggers (shop_email, aktiv, dage, review, review_dage, ugerapport, genaktiver_emne, genaktiver_tekst, review_emne, review_tekst)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (shop_email) DO UPDATE SET
       aktiv              = EXCLUDED.aktiv,
       dage               = EXCLUDED.dage,
       review             = EXCLUDED.review,
       review_dage        = EXCLUDED.review_dage,
       ugerapport         = EXCLUDED.ugerapport,
       genaktiver_emne    = COALESCE(EXCLUDED.genaktiver_emne, triggers.genaktiver_emne),
       genaktiver_tekst   = COALESCE(EXCLUDED.genaktiver_tekst, triggers.genaktiver_tekst),
       review_emne        = COALESCE(EXCLUDED.review_emne, triggers.review_emne),
       review_tekst       = COALESCE(EXCLUDED.review_tekst, triggers.review_tekst)`,
    [shopEmail, aktiv ?? false, dage ?? 60, review ?? false, reviewDage ?? 7, ugerapport ?? false,
     genaktiverEmne || null, genaktiverTekst || null, reviewEmne || null, reviewTekst || null]
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
        let emne, tekst;
        if (trigger.genaktiverEmne && trigger.genaktiverTekst) {
          emne = trigger.genaktiverEmne;
          tekst = trigger.genaktiverTekst;
        } else {
          const mail = await genererMail('genaktiver', churn.ifare, shop.wooUrl, null);
          emne = mail.emne; tekst = mail.tekst;
        }
        await sendMails(churn.ifare, emne, tekst);
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
          let emne, tekst;
          if (trigger.reviewEmne && trigger.reviewTekst) {
            emne = trigger.reviewEmne;
            tekst = trigger.reviewTekst;
          } else {
            const reviewMail = await genererMail('review', reviewKunder, shop.wooUrl, null);
            emne = reviewMail.emne; tekst = reviewMail.tekst;
          }
          await sendMails(reviewKunder, emne, tekst);
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
