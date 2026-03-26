import axios from 'axios';

export function createShopifyClient(shopUrl, accessToken) {
  const base = shopUrl.startsWith('http')
    ? shopUrl.replace(/\/$/, '')
    : `https://${shopUrl.replace(/\/$/, '')}`;
  return axios.create({
    baseURL: `${base}/admin/api/2024-01`,
    headers: { 'X-Shopify-Access-Token': accessToken }
  });
}

function mapOrder(o) {
  return {
    date_created: o.created_at,
    total: o.total_price,
    customer_id: o.customer?.id || null,
    line_items: (o.line_items || []).map(i => ({
      product_id: i.product_id,
      name: i.title,
      quantity: i.quantity,
      total: String(parseFloat(i.price) * i.quantity)
    }))
  };
}

function mapCustomer(c) {
  return {
    id: c.id,
    date_created: c.created_at,
    first_name: c.first_name || '',
    last_name: c.last_name || '',
    email: c.email || ''
  };
}

async function hentAlle(client, sti, key, extraParams = {}) {
  const resultater = [];
  let pageInfo = null;
  do {
    const params = pageInfo
      ? { limit: 250, page_info: pageInfo }
      : { limit: 250, ...extraParams };
    const res = await client.get(sti, { params });
    resultater.push(...(res.data[key] || []));
    const link = res.headers['link'] || '';
    const match = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    pageInfo = match ? match[1] : null;
    if (resultater.length >= 500) break;
  } while (pageInfo);
  return resultater;
}

export async function getOrders(client) {
  const orders = await hentAlle(client, '/orders.json', 'orders', { status: 'paid' });
  return orders.map(mapOrder);
}

export async function getCustomers(client) {
  const customers = await hentAlle(client, '/customers.json', 'customers');
  return customers.map(mapCustomer);
}

export async function getKategorier(client) {
  const [custom, smart] = await Promise.all([
    client.get('/custom_collections.json', { params: { limit: 50 } }),
    client.get('/smart_collections.json', { params: { limit: 50 } })
  ]);
  return [
    ...(custom.data.custom_collections || []).map(c => c.title),
    ...(smart.data.smart_collections || []).map(c => c.title)
  ];
}

export async function getShopBeskrivelse(shopUrl) {
  try {
    const base = shopUrl.startsWith('http') ? shopUrl : `https://${shopUrl}`;
    const res = await axios.get(base, { timeout: 5000 });
    return res.data.slice(0, 8000);
  } catch {
    return '';
  }
}

export async function createDiscountCode(client, { code, procent, udloebDage, antalBrugere }) {
  const udloeb = new Date();
  udloeb.setDate(udloeb.getDate() + udloebDage);
  const ruleRes = await client.post('/price_rules.json', {
    price_rule: {
      title: code,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: 'percentage',
      value: `-${procent}`,
      customer_selection: 'all',
      starts_at: new Date().toISOString(),
      ends_at: udloeb.toISOString(),
      usage_limit: antalBrugere
    }
  });
  const ruleId = ruleRes.data.price_rule.id;
  await client.post(`/price_rules/${ruleId}/discount_codes.json`, {
    discount_code: { code }
  });
  return code;
}

export async function getForladteKurve(client) {
  try {
    const res = await client.get('/checkouts.json', { params: { status: 'open', limit: 50 } });
    return (res.data.checkouts || []).map(c => ({
      navn: `${c.billing_address?.first_name || ''} ${c.billing_address?.last_name || ''}`.trim() || 'Ukendt',
      email: c.email || '',
      dato: c.created_at?.split('T')[0] || '',
      produkter: (c.line_items || []).map(i => i.title).join(', ')
    }));
  } catch {
    return [];
  }
}
