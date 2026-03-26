import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { createWooClient, getOrders, getCustomers, getForladteKurve, getKategorier, getShopBeskrivelse } from './woo.js';
import { beregnNoeglettal, beregnChurn, beregnNyeKunder, beregnTopProdukter, beregnLTV, beregnPrognose, beregnSaesonSammenligning, beregnCrossSell, beregnRFM } from './analytics.js';
import { hentMarginer, gemMarginer, beregnMarginer } from './margin.js';
import { overvaagsKonkurrenter } from './markedsforing.js';
import { genererTip } from './ai.js';
import { registerShop, loginShop, requireAuth } from './auth.js';
import pool from './db.js';
import { genererMail, sendMails } from './mail.js';
import { gemKampagne, hentKampagner } from './kampagner.js';
import { hentTrigger, gemTrigger, koerTriggers } from './triggers.js';
import { beregnUgensData, sendUgerapport } from './rapport.js';
import { genererMarkedsforing, genererContentPakke } from './markedsforing.js';
import { logEvent } from './events.js';
import { registerAdminRoutes } from './admin.js';
import { demoOrders, demoCustomers, demoForladteKurve } from './demo-data.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(helmet());
app.use(cors({
  origin: [
    'https://webshop-copilot-frontend.onrender.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ]
}));
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
    const token = await registerShop(req.body);
    res.json({ token });
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

// Dashboard — kræver login
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    let orders, customers;

    if (req.shop.demo) {
      orders = demoOrders;
      customers = demoCustomers;
    } else {
      const { wooUrl, wooKey, wooSecret } = req.shop;
      const client = createWooClient(wooUrl, wooKey, wooSecret);
      [orders, customers] = await Promise.all([
        getOrders(client),
        getCustomers(client)
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
    if (req.shop.demo) return res.json(demoForladteKurve);
    const kurve = await getForladteKurve(req.shop.wooUrl);
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

// Send mails
app.post('/api/mail/send', requireAuth, async (req, res) => {
  try {
    const { kunder, emne, tekst, rabatKode } = req.body;
    const resultater = await sendMails(kunder, emne, tekst);

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
    const { wooUrl, wooKey, wooSecret } = req.shop;
    const client = createWooClient(wooUrl, wooKey, wooSecret);
    const orders = await getOrders(client);
    const topProdukter = beregnTopProdukter(orders);
    res.json(beregnMarginer(topProdukter, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Konkurrentovervågning
app.get('/api/konkurrenter', requireAuth, async (req, res) => {
  try {
    let orders;
    if (req.shop.demo) {
      orders = demoOrders;
    } else {
      const { wooUrl, wooKey, wooSecret } = req.shop;
      const client = createWooClient(wooUrl, wooKey, wooSecret);
      orders = await getOrders(client);
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
    if (req.shop.demo) {
      orders = demoOrders;
      kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør'];
      shopHtml = '';
      shopUrl = 'demo-shop.dk';
    } else {
      const { wooUrl, wooKey, wooSecret } = req.shop;
      shopUrl = wooUrl;
      const client = createWooClient(wooUrl, wooKey, wooSecret);
      [orders, kategorier, shopHtml] = await Promise.all([
        getOrders(client),
        getKategorier(client),
        getShopBeskrivelse(wooUrl)
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
    if (req.shop.demo) {
      orders = demoOrders;
      kategorier = ['Kaffe', 'Kaffemaskiner', 'Tilbehør'];
      shopUrl = 'demo-shop.dk';
    } else {
      const { wooUrl, wooKey, wooSecret } = req.shop;
      shopUrl = wooUrl;
      const client = createWooClient(wooUrl, wooKey, wooSecret);
      [orders, kategorier] = await Promise.all([
        getOrders(client),
        getKategorier(client)
      ]);
    }
    const topProdukter = beregnTopProdukter(orders);
    const pakke = await genererContentPakke({ titel, beskrivelse, shopProfil, topProdukter, kategorier, shopUrl });
    res.json(pakke);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-trigger + rapport indstillinger
app.get('/api/trigger', requireAuth, (req, res) => {
  res.json(hentTrigger(req.shop.email));
});

app.post('/api/trigger', requireAuth, (req, res) => {
  gemTrigger(req.shop.email, req.body);
  res.json({ ok: true });
});

// Send ugerapport manuelt (test)
app.post('/api/rapport/send', requireAuth, async (req, res) => {
  try {
    const { wooUrl, wooKey, wooSecret } = req.shop;
    const client = createWooClient(wooUrl, wooKey, wooSecret);
    const [orders, customers] = await Promise.all([getOrders(client), getCustomers(client)]);
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

// Hent alle shops fra databasen
async function alleShops() {
  const result = await pool.query(
    `SELECT email, woo_url AS "wooUrl", woo_key AS "wooKey", woo_secret AS "wooSecret", plan, aktiv, demo FROM shops WHERE aktiv = true`
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
    const trigger = hentTrigger(shop.email);
    if (!trigger?.ugerapport) continue;
    try {
      const client = createWooClient(shop.wooUrl, shop.wooKey, shop.wooSecret);
      const [orders, customers] = await Promise.all([getOrders(client), getCustomers(client)]);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend kører på http://localhost:${PORT}`));
