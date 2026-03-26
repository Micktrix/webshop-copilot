import pool from './db.js';
import * as woo from './woo.js';
import * as shopify from './shopify.js';
import { beregnChurn } from './analytics.js';
import { genererMail, sendMails } from './mail.js';

const DEFAULT_TRIGGER = {
  aktiv: false, dage: 60, sidstKoert: null,
  review: false, reviewDage: 7, ugerapport: false,
  genaktiverEmne: '', genaktiverTekst: '',
  reviewEmne: '', reviewTekst: '',
  genaktiverRabatProcent: null, genaktiverRabatDage: 14,
  reviewRabatProcent: null, reviewRabatDage: 14
};

export async function hentTrigger(shopEmail) {
  const result = await pool.query(
    `SELECT aktiv, dage, sidst_koert AS "sidstKoert",
            review, review_dage AS "reviewDage", ugerapport,
            genaktiver_emne AS "genaktiverEmne", genaktiver_tekst AS "genaktiverTekst",
            review_emne AS "reviewEmne", review_tekst AS "reviewTekst",
            genaktiver_rabat_procent AS "genaktiverRabatProcent", genaktiver_rabat_dage AS "genaktiverRabatDage",
            review_rabat_procent AS "reviewRabatProcent", review_rabat_dage AS "reviewRabatDage"
     FROM triggers WHERE shop_email = $1`,
    [shopEmail]
  );
  return result.rows[0] || DEFAULT_TRIGGER;
}

export async function gemTrigger(shopEmail, config) {
  const {
    aktiv, dage, review, reviewDage, ugerapport,
    genaktiverEmne, genaktiverTekst, reviewEmne, reviewTekst,
    genaktiverRabatProcent, genaktiverRabatDage,
    reviewRabatProcent, reviewRabatDage
  } = config;
  await pool.query(
    `INSERT INTO triggers (shop_email, aktiv, dage, review, review_dage, ugerapport,
       genaktiver_emne, genaktiver_tekst, review_emne, review_tekst,
       genaktiver_rabat_procent, genaktiver_rabat_dage, review_rabat_procent, review_rabat_dage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (shop_email) DO UPDATE SET
       aktiv                   = EXCLUDED.aktiv,
       dage                    = EXCLUDED.dage,
       review                  = EXCLUDED.review,
       review_dage             = EXCLUDED.review_dage,
       ugerapport              = EXCLUDED.ugerapport,
       genaktiver_emne         = COALESCE(EXCLUDED.genaktiver_emne, triggers.genaktiver_emne),
       genaktiver_tekst        = COALESCE(EXCLUDED.genaktiver_tekst, triggers.genaktiver_tekst),
       review_emne             = COALESCE(EXCLUDED.review_emne, triggers.review_emne),
       review_tekst            = COALESCE(EXCLUDED.review_tekst, triggers.review_tekst),
       genaktiver_rabat_procent = EXCLUDED.genaktiver_rabat_procent,
       genaktiver_rabat_dage   = EXCLUDED.genaktiver_rabat_dage,
       review_rabat_procent    = EXCLUDED.review_rabat_procent,
       review_rabat_dage       = EXCLUDED.review_rabat_dage`,
    [shopEmail, aktiv ?? false, dage ?? 60, review ?? false, reviewDage ?? 7, ugerapport ?? false,
     genaktiverEmne || null, genaktiverTekst || null, reviewEmne || null, reviewTekst || null,
     genaktiverRabatProcent || null, genaktiverRabatDage || 14,
     reviewRabatProcent || null, reviewRabatDage || 14]
  );
}

async function opretKupon(shop, procent, dage, antal) {
  const code = 'AUTO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const udloeb = new Date();
  udloeb.setDate(udloeb.getDate() + dage);
  if (shop.platform === 'shopify') {
    const client = shopify.createShopifyClient(shop.wooUrl, shop.wooKey);
    await shopify.createDiscountCode(client, { code, procent, udloebDage: dage, antalBrugere: antal });
  } else {
    const client = woo.createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret);
    await client.post('/coupons', {
      code,
      discount_type: 'percent',
      amount: String(procent),
      date_expires: udloeb.toISOString().split('T')[0],
      usage_limit: antal
    });
  }
  return code;
}

export async function koerTriggers(shops) {
  const iDag = new Date().toISOString().split('T')[0];

  for (const shop of shops) {
    const trigger = await hentTrigger(shop.email);
    if (!trigger.aktiv) continue;
    if (trigger.sidstKoert === iDag) continue;

    try {
      const adapter = shop.platform === 'shopify'
        ? { getOrders: () => shopify.getOrders(shopify.createShopifyClient(shop.wooUrl, shop.wooKey)),
            getCustomers: () => shopify.getCustomers(shopify.createShopifyClient(shop.wooUrl, shop.wooKey)) }
        : { getOrders: () => woo.getOrders(woo.createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret)),
            getCustomers: () => woo.getCustomers(woo.createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret)) };

      const [orders, customers] = await Promise.all([adapter.getOrders(), adapter.getCustomers()]);

      const shopOpts = { shopEmail: shop.email, fromName: shop.wooUrl || 'Din butik' };

      // Genaktiveringsmail
      const churn = beregnChurn(orders, customers, trigger.dage);
      if (churn.ifare.length > 0) {
        let rabatKode = null;
        if (trigger.genaktiverRabatProcent) {
          try { rabatKode = await opretKupon(shop, trigger.genaktiverRabatProcent, trigger.genaktiverRabatDage || 14, churn.ifare.length); } catch {}
        }
        let emne, tekst;
        if (trigger.genaktiverEmne && trigger.genaktiverTekst) {
          emne = trigger.genaktiverEmne;
          tekst = trigger.genaktiverTekst + (rabatKode ? `\n\nBrug koden ${rabatKode} og få ${trigger.genaktiverRabatProcent}% rabat.` : '');
        } else {
          const mail = await genererMail('genaktiver', churn.ifare, shop.wooUrl, rabatKode);
          emne = mail.emne; tekst = mail.tekst;
        }
        await sendMails(churn.ifare, emne, tekst, shopOpts);
        console.log(`Auto-trigger genaktiver: ${churn.ifare.length} kunder for ${shop.email}`);
      }

      // Review-anmodning X dage efter køb
      if (trigger.review) {
        const reviewDage = trigger.reviewDage || 7;
        const fra = new Date(); fra.setDate(fra.getDate() - reviewDage - 1);
        const til = new Date(); til.setDate(til.getDate() - reviewDage);
        const reviewKunder = orders
          .filter(o => { const d = new Date(o.date_created); return d >= fra && d <= til && o.billing?.email; })
          .map(o => ({ id: o.customer_id, navn: `${o.billing.first_name} ${o.billing.last_name}`.trim(), email: o.billing.email }));
        if (reviewKunder.length > 0) {
          let rabatKode = null;
          if (trigger.reviewRabatProcent) {
            try { rabatKode = await opretKupon(shop, trigger.reviewRabatProcent, trigger.reviewRabatDage || 14, reviewKunder.length); } catch {}
          }
          let emne, tekst;
          if (trigger.reviewEmne && trigger.reviewTekst) {
            emne = trigger.reviewEmne;
            tekst = trigger.reviewTekst + (rabatKode ? `\n\nBrug koden ${rabatKode} og få ${trigger.reviewRabatProcent}% rabat.` : '');
          } else {
            const reviewMail = await genererMail('review', reviewKunder, shop.wooUrl, rabatKode);
            emne = reviewMail.emne; tekst = reviewMail.tekst;
          }
          await sendMails(reviewKunder, emne, tekst, shopOpts);
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
