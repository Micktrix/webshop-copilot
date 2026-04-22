import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import * as woo from './woo.js';
import * as shopify from './shopify.js';
const { createWooClient } = woo;
import { beregnNoeglettal, beregnChurn, beregnNyeKunder, beregnTopProdukter, beregnLTV, beregnPrognose, beregnSaesonSammenligning, beregnCrossSell, beregnRFM } from './analytics.js';
import { hentMarginer, gemMarginer, beregnMarginer } from './margin.js';
import { overvaagsKonkurrenter } from './markedsforing.js';
import { genererTip } from './ai.js';
import { registerShop, loginShop, requireAuth, anmodNulstilAdgangskode, nulstilAdgangskode } from './auth.js';
import pool from './db.js';
import { genererMail, sendMails, sendVelkomstMail, sendEnMail } from './mail.js';
import { gemKampagne, hentKampagner } from './kampagner.js';
import { hentTrigger, gemTrigger, koerTriggers } from './triggers.js';
import { beregnUgensData, sendUgerapport } from './rapport.js';
import { genererMarkedsforing, genererContentPakke } from './markedsforing.js';
import { analyserSEO, genererBlogIdeer, genererProduktBeskrivelse } from './seo.js';
import { logEvent } from './events.js';
import { registerAdminRoutes } from './admin.js';
import { demoOrders, demoCustomers, demoForladteKurve } from './demo-data.js';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vælger den rigtige platform-adapter baseret på shop.platform
function getAdapter(shop) {
  if (shop.platform === 'shopify') {
    const client = shopify.createShopifyClient(shop.wooUrl, shop.wooKey);
    return {
      getOrders:          () => shopify.getOrders(client),
      getCustomers:       () => shopify.getCustomers(client),
      getForladteKurve:   () => shopify.getForladteKurve(client),
      getKategorier:      () => shopify.getKategorier(client),
      getShopBeskrivelse: () => shopify.getShopBeskrivelse(shop.wooUrl),
      wooClient: null  // coupon-operationer kun WooCommerce
    };
  }
  const client = woo.createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret);
  return {
    getOrders:          () => woo.getOrders(client),
    getCustomers:       () => woo.getCustomers(client),
    getForladteKurve:   () => woo.getForladteKurve(shop.wooUrl),
    getKategorier:      () => woo.getKategorier(client),
    getShopBeskrivelse: () => woo.getShopBeskrivelse(shop.wooUrl),
    wooClient: client
  };
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://vixx.dk',
    'https://www.vixx.dk',
    'https://webshop-copilot.onrender.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ]
}));

// Stripe webhook — must come BEFORE express.json() to get raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook fejl:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const shopEmail = session.metadata?.shopEmail || session.customer_email;
    if (shopEmail) {
      await pool.query(`UPDATE shops SET plan = 'pro', stripe_customer_id = $2 WHERE email = $1`, [shopEmail, session.customer]);
      console.log(`Pro aktiveret for ${shopEmail}`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const result = await pool.query(`SELECT email FROM shops WHERE stripe_customer_id = $1`, [sub.customer]);
    if (result.rows[0]) {
      await pool.query(`UPDATE shops SET plan = 'gratis' WHERE email = $1`, [result.rows[0].email]);
      console.log(`Pro nedgraderet for ${result.rows[0].email}`);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'For mange forsøg — prøv igen om 15 minutter' }
});

registerAdminRoutes(app);

// Auth endpoints
app.post('/api/register', loginLimiter, async (req, res) => {
  try {
    const { wooUrl, wooKey, wooSecret, platform } = req.body;
    if (wooUrl && wooKey) {
      try {
        if (platform === 'shopify') {
          const client = shopify.createShopifyClient(wooUrl, wooKey);
          await client.get('/shop.json');
        } else {
          const client = createWooClient(wooUrl, wooKey, wooSecret);
          await client.get('/orders', { params: { per_page: 1 } });
        }
      } catch {
        return res.status(400).json({ error: platform === 'shopify'
          ? 'Kunne ikke forbinde til Shopify — tjek URL og Access Token.'
          : 'Kunne ikke forbinde til WooCommerce — tjek URL og API-nøgler.'
        });
      }
    }
    const token = await registerShop(req.body);
    res.json({ token });
    // Send velkomstmail + ejernotifikation asynkront
    sendVelkomstMail(req.body.email).catch(e => console.warn('Velkomstmail fejl:', e.message));
    sendEnMail({
      to: 'info@gard.dk',
      subject: `Ny Vixx-bruger: ${req.body.email}`,
      html: `<p>Ny bruger oprettet på Vixx:</p><ul><li><strong>Email:</strong> ${req.body.email}</li><li><strong>Platform:</strong> ${req.body.platform || 'woocommerce'}</li><li><strong>Butik:</strong> ${req.body.wooUrl || '—'}</li></ul>`,
      text: `Ny bruger: ${req.body.email} (${req.body.platform || 'woocommerce'}) — ${req.body.wooUrl || '—'}`
    }).catch(e => console.warn('Ejernotifikation fejl:', e.message));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/glemt-adgangskode', loginLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS reset_token TEXT, ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ');
  } catch {}
  const token = await anmodNulstilAdgangskode(email);
  if (token) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vixx.dk';
    const link = `${frontendUrl}/nulstil-adgangskode.html?token=${token}`;
    await sendEnMail({
      to: email,
      subject: 'Nulstil din adgangskode — Vixx',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="display:inline-block;background:#6366f1;border-radius:10px;width:44px;height:44px;line-height:44px;font-size:1.3rem;color:white;text-align:center">◈</div>
          <h1 style="font-size:1.2rem;font-weight:700;color:#0f172a;margin:12px 0 4px">Nulstil adgangskode</h1>
        </div>
        <p style="color:#475569;line-height:1.7">Vi har modtaget en anmodning om at nulstille adgangskoden til din Vixx-konto. Klik på knappen nedenfor — linket er gyldigt i 1 time.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:700;font-size:0.95rem">Nulstil adgangskode →</a>
        </div>
        <p style="color:#94a3b8;font-size:0.85rem">Hvis du ikke bad om dette, kan du roligt ignorere denne mail.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0">
        <p style="font-size:11px;color:#aaa;text-align:center">Vixx · www.vixx.dk</p>
      </div>`,
      text: `Nulstil din adgangskode her: ${link}\n\nLinket udløber om 1 time.`
    }).catch(e => console.warn('Reset-mail fejl:', e.message));
  }
  // Svar altid det samme — giv ikke info om hvem der er registreret
  res.json({ ok: true });
});

app.post('/api/nulstil-adgangskode', async (req, res) => {
  const { token, password } = req.body;
  try {
    await nulstilAdgangskode(token, password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const token = await loginShop(req.body);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Profil (plan-info)
app.get('/api/profil', requireAuth, (req, res) => {
  res.json({ email: req.shop.email, plan: req.shop.plan });
});

// Stripe checkout — opgrader til Pro
app.post('/api/stripe/checkout', requireAuth, async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vixx.dk';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.shop.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${frontendUrl}/dashboard.html?upgraded=1`,
      cancel_url: `${frontendUrl}/dashboard.html`,
      metadata: { shopEmail: req.shop.email },
      locale: 'da'
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe fejl:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stripe Customer Portal — administrer abonnement
app.post('/api/stripe/portal', requireAuth, async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vixx.dk';
    const result = await pool.query('SELECT stripe_customer_id FROM shops WHERE email = $1', [req.shop.email]);
    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'Ingen aktiv Stripe-kunde fundet.' });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/dashboard.html`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal fejl:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dashboard — kræver login
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    let orders, customers;

    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders;
      customers = demoCustomers;
    } else {
      const adapter = getAdapter(req.shop);
      [orders, customers] = await Promise.all([
        adapter.getOrders(),
        adapter.getCustomers()
      ]);
    }

    const noeglettal = beregnNoeglettal(orders);
    const churn = beregnChurn(orders, customers);
    const nyeKunder = beregnNyeKunder(customers);
    const topProdukter = beregnTopProdukter(orders);
    const ltv = beregnLTV(orders, customers);
    const prognose = beregnPrognose(orders);
    const saesonSammenligning = beregnSaesonSammenligning(orders);
    const crossSell = beregnCrossSell(orders);
    const rfm = beregnRFM(orders, customers);

    let tip = "Ingen data nok til en anbefaling endnu.";
    try {
      tip = await genererTip(noeglettal, churn);
    } catch (e) {
      console.warn("AI fejl:", e.message);
    }

    logEvent('dashboard_load', req.shop.email, {
      omsaetning: noeglettal.omsaetning30,
      ordrer: noeglettal.ordrer30,
      churnRate: churn.churnRate,
      nyeKunder: nyeKunder.nyeKunder30,
      rfmSegmenter: Object.fromEntries(Object.entries(rfm).map(([k, v]) => [k, v.length]))
    });

    res.json({ noeglettal, churn, nyeKunder, topProdukter, ltv, prognose, saesonSammenligning, crossSell, rfm, tip });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// Forladte kurve
app.get('/api/forladte-kurve', requireAuth, async (req, res) => {
  try {
    if (req.shop.demo || !req.shop.wooUrl) return res.json(demoForladteKurve);
    const kurve = await getAdapter(req.shop).getForladteKurve();
    res.json(kurve);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generer mail-udkast
app.post('/api/mail/udkast', requireAuth, async (req, res) => {
  try {
    const { type, kunder, rabat } = req.body;

    let rabatKode = null;
    if (rabat) {
      const { wooUrl, wooKey, wooSecret } = req.shop;
      const client = createWooClient(wooUrl, wooKey, wooSecret);
      const udloeb = new Date();
      udloeb.setDate(udloeb.getDate() + rabat.dage);
      rabatKode = (req.body.rabat?.kodenavn || '').trim().toUpperCase() || 'COPILOT-' + Math.random().toString(36).slice(2,8).toUpperCase();
      await client.post('/coupons', {
        code: rabatKode,
        discount_type: 'percent',
        amount: String(rabat.procent),
        date_expires: udloeb.toISOString().split('T')[0],
        usage_limit: kunder.length
      });
    }

    const mail = await genererMail(type, kunder, req.shop.wooUrl, rabatKode);
    res.json({ ...mail, rabatKode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Afmeld nyhedsmails (uautentificeret — link i mail)
app.get('/api/afmeld', async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    const kundeEmail = decoded.slice(0, colonIdx);
    const shopEmail = decoded.slice(colonIdx + 1);
    await pool.query(
      `INSERT INTO afmeldinger (shop_email, kunde_email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [shopEmail, kundeEmail]
    );
    res.send(`<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><title>Afmeldt</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:80px 20px;color:#333}
      h2{color:#6366f1}p{color:#666}</style></head>
      <body><h2>Du er afmeldt</h2><p>Du vil ikke modtage flere mails fra denne butik.</p></body></html>`);
  } catch {
    res.status(400).send('Ugyldigt afmeld-link.');
  }
});

async function filtrerAfmeldte(shopEmail, kunder) {
  if (!kunder.length) return kunder;
  const emails = kunder.map(k => k.email);
  const res = await pool.query(
    `SELECT kunde_email FROM afmeldinger WHERE shop_email = $1 AND kunde_email = ANY($2)`,
    [shopEmail, emails]
  );
  const afmeldte = new Set(res.rows.map(r => r.kunde_email));
  return kunder.filter(k => !afmeldte.has(k.email));
}

async function tjekMailKvote(shopEmail, plan, antal) {
  const iDag = new Date().toISOString().split('T')[0];
  const res = await pool.query(
    `SELECT COALESCE(SUM(antal_modtagere), 0) AS sendt FROM kampagner WHERE shop_email = $1 AND dato = $2`,
    [shopEmail, iDag]
  );
  const sendt = parseInt(res.rows[0].sendt);
  const graense = plan === 'pro' ? 2000 : 200;
  if (sendt + antal > graense) {
    throw new Error(`Daglig mailkvote overskredet (${graense} mails/dag på ${plan}-planen)`);
  }
}

// Send mails
app.post('/api/mail/send', requireAuth, async (req, res) => {
  try {
    const { kunder: alleKunder, emne, tekst, rabatKode } = req.body;
    const kunder = await filtrerAfmeldte(req.shop.email, alleKunder);
    await tjekMailKvote(req.shop.email, req.shop.plan, kunder.length);

    const shopOpts = { shopEmail: req.shop.email, fromName: req.shop.wooUrl || 'Din butik' };
    const resultater = await sendMails(kunder, emne, tekst, shopOpts);

    await gemKampagne(req.shop.email, {
      emne,
      type: req.body.type || 'kampagne',
      antalModtagere: kunder.length,
      rabatKode: rabatKode || null
    });

    logEvent('mail_sent', req.shop.email, { type: req.body.type || 'kampagne', antal: kunder.length });

    res.json({ sendt: resultater.length, resultater, rabatKode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kampagne statistik
app.get('/api/kampagner', requireAuth, async (req, res) => {
  try {
    const kampagner = await hentKampagner(req.shop.email);
    if (kampagner.length === 0) return res.json([]);

    const { wooUrl, wooKey, wooSecret } = req.shop;
    const client = createWooClient(wooUrl, wooKey, wooSecret);

    const medStats = await Promise.all(kampagner.map(async (k) => {
      if (!k.rabatKode) return { ...k, antalBrugt: 0, omsaetning: 0 };
      try {
        const couponRes = await client.get('/coupons', { params: { code: k.rabatKode } });
        const coupon = couponRes.data[0];
        if (!coupon) return { ...k, antalBrugt: 0, omsaetning: 0 };
        const ordreRes = await client.get('/orders', {
          params: { coupon: k.rabatKode, per_page: 100, status: 'completed' }
        });
        const omsaetning = ordreRes.data.reduce((sum, o) => sum + parseFloat(o.total), 0);
        return { ...k, antalBrugt: coupon.usage_count || 0, omsaetning: Math.round(omsaetning) };
      } catch {
        return { ...k, antalBrugt: 0, omsaetning: 0 };
      }
    }));

    res.json(medStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marginer
app.get('/api/marginer', requireAuth, (req, res) => {
  res.json(hentMarginer(req.shop.email));
});
app.post('/api/marginer', requireAuth, async (req, res) => {
  try {
    gemMarginer(req.shop.email, req.body);
    const orders = await getAdapter(req.shop).getOrders();
    const topProdukter = beregnTopProdukter(orders);
    res.json(beregnMarginer(topProdukter, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Konkurrentovervågning
app.get('/api/konkurrenter', requireAuth, async (req, res) => {
  try {
    let orders;
    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders;
    } else {
      orders = await getAdapter(req.shop).getOrders();
    }
    const topProdukter = beregnTopProdukter(orders);
    const data = await overvaagsKonkurrenter(topProdukter);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Markedsføring — AI + web-søgning
app.get('/api/markedsforing', requireAuth, async (req, res) => {
  try {
    let orders, kategorier, shopHtml, shopUrl;
    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders;
      kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør'];
      shopHtml = '';
      shopUrl = 'demo-shop.dk';
    } else {
      shopUrl = req.shop.wooUrl;
      const adapter = getAdapter(req.shop);
      [orders, kategorier, shopHtml] = await Promise.all([
        adapter.getOrders(),
        adapter.getKategorier(),
        adapter.getShopBeskrivelse()
      ]);
    }
    const topProdukter = beregnTopProdukter(orders);
    const data = await genererMarkedsforing({ topProdukter, kategorier, shopUrl, shopHtml });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Content pakke
app.post('/api/content-pakke', requireAuth, async (req, res) => {
  try {
    const { titel, beskrivelse, shopProfil } = req.body;
    let orders, kategorier, shopUrl;
    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders;
      kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør'];
      shopUrl = 'demo-shop.dk';
    } else {
      shopUrl = req.shop.wooUrl;
      const adapter = getAdapter(req.shop);
      [orders, kategorier] = await Promise.all([
        adapter.getOrders(),
        adapter.getKategorier()
      ]);
    }
    const topProdukter = beregnTopProdukter(orders);
    const pakke = await genererContentPakke({ titel, beskrivelse, shopProfil, topProdukter, kategorier, shopUrl });
    res.json(pakke);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SEO-analyse
app.get('/api/seo', requireAuth, async (req, res) => {
  try {
    let orders, kategorier, shopUrl;
    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders;
      kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør'];
      shopUrl = 'demo-shop.dk';
    } else {
      shopUrl = req.shop.wooUrl;
      const adapter = getAdapter(req.shop);
      [orders, kategorier] = await Promise.all([
        adapter.getOrders(),
        adapter.getKategorier()
      ]);
    }
    const topProdukter = beregnTopProdukter(orders);
    const data = await analyserSEO({ topProdukter, kategorier, shopUrl });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SEO — Blog-idéer
app.get('/api/seo/blog-ideer', requireAuth, async (req, res) => {
  try {
    let orders, kategorier, shopUrl;
    if (req.shop.demo || !req.shop.wooUrl) {
      orders = demoOrders; kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør']; shopUrl = 'demo-shop.dk';
    } else {
      shopUrl = req.shop.wooUrl;
      const adapter = getAdapter(req.shop);
      [orders, kategorier] = await Promise.all([adapter.getOrders(), adapter.getKategorier()]);
    }
    const topProdukter = beregnTopProdukter(orders);
    const data = await genererBlogIdeer({ topProdukter, kategorier, shopUrl });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SEO — Produkt-beskrivelse
app.post('/api/seo/produkt-beskrivelse', requireAuth, async (req, res) => {
  try {
    const { produktnavn, kategori } = req.body;
    if (!produktnavn) return res.status(400).json({ error: 'produktnavn er påkrævet' });
    const shopUrl = req.shop.demo || !req.shop.wooUrl ? 'demo-shop.dk' : req.shop.wooUrl;
    const data = await genererProduktBeskrivelse({ produktnavn, kategori: kategori || '', shopUrl });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auto-trigger + rapport indstillinger
app.get('/api/trigger', requireAuth, (req, res) => {
  res.json(hentTrigger(req.shop.email));
});

app.post('/api/trigger', requireAuth, (req, res) => {
  gemTrigger(req.shop.email, req.body);
  res.json({ ok: true });
});

// Generer AI-udkast til trigger-mail
app.post('/api/trigger/udkast', requireAuth, async (req, res) => {
  try {
    const { type } = req.body;
    const dummyKunder = [{ navn: 'Eksempel Kunde', email: 'kunde@example.dk' }];
    const shopUrl = req.shop.demo ? 'din-butik.dk' : req.shop.wooUrl;
    const mail = await genererMail(type, dummyKunder, shopUrl, null);
    res.json({ emne: mail.emne, tekst: mail.tekst });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send ugerapport manuelt (test)
app.post('/api/rapport/send', requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter(req.shop);
    const [orders, customers] = await Promise.all([adapter.getOrders(), adapter.getCustomers()]);
    const churn = beregnChurn(orders, customers);
    const topProdukter = beregnTopProdukter(orders);
    const ugensData = beregnUgensData(orders, customers, churn, topProdukter);
    let tip = '';
    try { const ai = await import('./ai.js'); tip = await ai.genererTip(beregnNoeglettal(orders), churn); } catch {}
    const info = await sendUgerapport(req.shop, ugensData, tip);
    const nodemailer = (await import('nodemailer')).default;
    res.json({ ok: true, previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── HQ Jobs API ──────────────────────────────────────────────
function requireHqKey(req, res, next) {
  if (!process.env.HQ_API_KEY || req.headers['x-api-key'] !== process.env.HQ_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/hq/jobs', requireHqKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hq_jobs ORDER BY fundet_dato DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hq/jobs', requireHqKey, async (req, res) => {
  try {
    const jobs = Array.isArray(req.body) ? req.body : [req.body];
    let inserted = 0;
    for (const { titel, virksomhed, url, beskrivelse, kilde } of jobs) {
      if (!titel) continue;
      const r = await pool.query(
        `INSERT INTO hq_jobs (titel, virksomhed, url, beskrivelse, kilde)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (url) DO NOTHING`,
        [titel, virksomhed || '', url || '', beskrivelse || '', kilde || '']
      );
      inserted += r.rowCount;
    }
    res.json({ ok: true, inserted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/hq/jobs/:id', requireHqKey, async (req, res) => {
  try {
    await pool.query('DELETE FROM hq_jobs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Hent alle shops fra databasen
async function alleShops() {
  const result = await pool.query(
    `SELECT email, woo_url AS "wooUrl", woo_key AS "wooKey", woo_secret AS "wooSecret", platform, plan, aktiv, demo FROM shops WHERE aktiv = true`
  );
  return result.rows;
}

// Daglig cron — auto-triggers
setInterval(async () => {
  try { await koerTriggers(await alleShops()); } catch (e) { console.warn('Cron fejl:', e.message); }
}, 1000 * 60 * 60);

// Ugentlig cron — mandag morgen kl. 8
async function koerUgerapporter() {
  const nu = new Date();
  if (nu.getDay() !== 1 || nu.getHours() !== 8) return;

  for (const shop of await alleShops()) {
    const trigger = await hentTrigger(shop.email);
    if (!trigger?.ugerapport) continue;
    try {
      const adapter = getAdapter(shop);
      const [orders, customers] = await Promise.all([adapter.getOrders(), adapter.getCustomers()]);
      const churn = beregnChurn(orders, customers);
      const topProdukter = beregnTopProdukter(orders);
      const ugensData = beregnUgensData(orders, customers, churn, topProdukter);
      let tip = '';
      try { const ai = await import('./ai.js'); tip = await ai.genererTip(beregnNoeglettal(orders), churn); } catch {}
      await sendUgerapport(shop, ugensData, tip);
      console.log(`Ugerapport sendt til ${shop.email}`);
    } catch (e) { console.warn(`Ugerapport fejl for ${shop.email}:`, e.message); }
  }
}

setInterval(koerUgerapporter, 1000 * 60 * 60); // tjekker hver time om det er mandag kl. 8

// Serve frontend filer
const FRONTEND = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND));

async function koerMigrationer() {
  await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'woocommerce'`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS genaktiver_emne TEXT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS genaktiver_tekst TEXT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS review_emne TEXT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS review_tekst TEXT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS genaktiver_rabat_procent INT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS genaktiver_rabat_dage INT NOT NULL DEFAULT 14`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS review_rabat_procent INT`);
  await pool.query(`ALTER TABLE triggers ADD COLUMN IF NOT EXISTS review_rabat_dage INT NOT NULL DEFAULT 14`);
  await pool.query(`CREATE TABLE IF NOT EXISTS afmeldinger (
    shop_email   TEXT NOT NULL,
    kunde_email  TEXT NOT NULL,
    afmeldt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_email, kunde_email)
  )`);
  await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hq_jobs (
    id           SERIAL PRIMARY KEY,
    titel        TEXT NOT NULL,
    virksomhed   TEXT,
    url          TEXT UNIQUE,
    beskrivelse  TEXT,
    kilde        TEXT,
    fundet_dato  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Backend kører på http://localhost:${PORT}`);
  try { await koerMigrationer(); console.log('Migrationer OK'); } catch (e) { console.warn('Migration fejl:', e.message); }
});

