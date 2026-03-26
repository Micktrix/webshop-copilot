import axios from 'axios';
import https from 'https';

export function createWooClient(wooUrl, wooKey, wooSecret) {
  return axios.create({
    baseURL: `${wooUrl}/wp-json/wc/v3`,
    auth: { username: wooKey, password: wooSecret },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
}

export async function getOrders(client, perPage = 100) {
  const res = await client.get('/orders', {
    params: { per_page: perPage, status: 'completed' }
  });
  return res.data;
}

export async function getCustomers(client, perPage = 100) {
  const res = await client.get('/customers', {
    params: { per_page: perPage }
  });
  return res.data;
}

export async function getKategorier(client) {
  const res = await client.get('/products/categories', {
    params: { per_page: 50, hide_empty: true }
  });
  return res.data.map(k => k.name);
}

export async function getShopBeskrivelse(wooUrl) {
  const https = (await import('https')).default;
  const axios = (await import('axios')).default;
  try {
    const res = await axios.get(wooUrl, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 5000
    });
    // Returner rå HTML — Claude analyserer den
    return res.data.slice(0, 8000); // maks 8000 tegn
  } catch {
    return '';
  }
}

export async function getForladteKurve(wooUrl) {
  const secret = process.env.COPILOT_SECRET || 'skift-mig';
  const url = `${wooUrl}/wp-json/copilot/v1/abandoned-carts?secret=${encodeURIComponent(secret)}`;

  const https = (await import('https')).default;
  const axios = (await import('axios')).default;

  const res = await axios.get(url, {
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data;
}
