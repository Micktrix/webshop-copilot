export function beregnNoeglettal(orders) {
  const iDag = new Date();
  const for30Dage = new Date();
  for30Dage.setDate(iDag.getDate() - 30);

  const sidsteManedOrdrer = orders.filter(o => new Date(o.date_created) >= for30Dage);

  const omsaetning = sidsteManedOrdrer.reduce((sum, o) => sum + parseFloat(o.total), 0);
  const antalOrdrer = sidsteManedOrdrer.length;
  const gennemsnit = antalOrdrer > 0 ? omsaetning / antalOrdrer : 0;

  // Graf data — omsætning per dag de sidste 30 dage
  const grafData = {};
  for (let i = 29; i >= 0; i--) {
    const dato = new Date();
    dato.setDate(iDag.getDate() - i);
    const key = dato.toISOString().split('T')[0];
    grafData[key] = 0;
  }
  sidsteManedOrdrer.forEach(o => {
    const key = o.date_created.split('T')[0];
    if (grafData[key] !== undefined) {
      grafData[key] += parseFloat(o.total);
    }
  });

  return {
    omsaetning: Math.round(omsaetning),
    antalOrdrer,
    gennemsnit: Math.round(gennemsnit),
    grafData: Object.entries(grafData).map(([dato, beloeb]) => ({ dato, beloeb }))
  };
}

export function beregnNyeKunder(customers) {
  const iDag = new Date();
  const startDenneMaaned = new Date(iDag.getFullYear(), iDag.getMonth(), 1);
  const startForrigeMaaned = new Date(iDag.getFullYear(), iDag.getMonth() - 1, 1);

  const denneMaaned = customers.filter(c => new Date(c.date_created) >= startDenneMaaned).length;
  const forrigeMaaned = customers.filter(c => {
    const d = new Date(c.date_created);
    return d >= startForrigeMaaned && d < startDenneMaaned;
  }).length;

  const vaekst = forrigeMaaned > 0
    ? Math.round(((denneMaaned - forrigeMaaned) / forrigeMaaned) * 100)
    : denneMaaned > 0 ? 100 : 0;

  return { denneMaaned, forrigeMaaned, vaekst };
}

export function beregnSaesonSammenligning(orders) {
  const iDag = new Date();
  const mnd = iDag.getMonth();
  const aar = iDag.getFullYear();

  const filter = (y) => orders.filter(o => {
    const d = new Date(o.date_created);
    return d.getMonth() === mnd && d.getFullYear() === y;
  });

  const denneMaaned = filter(aar);
  const sidsteAar = filter(aar - 1);

  const omsD = Math.round(denneMaaned.reduce((s, o) => s + parseFloat(o.total), 0));
  const omsS = Math.round(sidsteAar.reduce((s, o) => s + parseFloat(o.total), 0));
  const vaekst = omsS > 0 ? Math.round(((omsD - omsS) / omsS) * 100) : null;

  return {
    denneMaaned: { omsaetning: omsD, ordrer: denneMaaned.length },
    sidsteAar: { omsaetning: omsS, ordrer: sidsteAar.length },
    vaekst
  };
}

export function beregnCrossSell(orders) {
  const par = {};
  orders.forEach(o => {
    const items = (o.line_items || []).map(i => ({ id: i.product_id, navn: i.name }));
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = [items[i].id, items[j].id].sort().join('-');
        if (!par[key]) par[key] = { a: items[i].navn, b: items[j].navn, antal: 0 };
        par[key].antal++;
      }
    }
  });
  return Object.values(par).filter(p => p.antal >= 2).sort((a, b) => b.antal - a.antal).slice(0, 8);
}

export function beregnRFM(orders, customers) {
  const iDag = new Date();
  const metrics = {};

  orders.forEach(o => {
    const id = o.customer_id;
    if (!id) return;
    if (!metrics[id]) metrics[id] = { total: 0, antal: 0, sidst: null };
    metrics[id].total += parseFloat(o.total);
    metrics[id].antal++;
    const d = new Date(o.date_created);
    if (!metrics[id].sidst || d > metrics[id].sidst) metrics[id].sidst = d;
  });

  const ids = Object.keys(metrics).filter(id => metrics[id].sidst);
  const recencies = ids.map(id => Math.floor((iDag - metrics[id].sidst) / 86400000));
  const frequencies = ids.map(id => metrics[id].antal);
  const monetaries = ids.map(id => metrics[id].total);

  function pctScore(val, arr, reverse = false) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = sorted.findIndex(v => v >= val);
    const pct = idx / sorted.length;
    const s = Math.min(5, Math.ceil(pct * 5) || 1);
    return reverse ? 6 - s : s;
  }

  const segmentNavn = (r, f) => {
    if (r >= 4 && f >= 4) return 'Champions';
    if (f >= 4) return 'Loyale';
    if (r >= 4) return 'Lovende';
    if (r <= 2 && f >= 3) return 'I fare';
    if (r <= 2 && f >= 4) return 'Tabt stor';
    return 'Sover';
  };

  const segmentFarve = { Champions: '#16a34a', Loyale: '#6366f1', Lovende: '#0ea5e9', 'I fare': '#d97706', 'Tabt stor': '#dc2626', Sover: '#aaa' };

  const kunder = customers.filter(c => metrics[c.id]?.sidst).map(c => {
    const m = metrics[c.id];
    const dageSiden = Math.floor((iDag - m.sidst) / 86400000);
    const r = pctScore(dageSiden, recencies, true);
    const f = pctScore(m.antal, frequencies);
    const mon = pctScore(m.total, monetaries);
    const segment = segmentNavn(r, f);
    return {
      id: c.id, navn: `${c.first_name} ${c.last_name}`, email: c.email,
      r, f, m: mon, segment, dageSiden,
      totalKoeb: Math.round(m.total), antalOrdrer: m.antal,
      farve: segmentFarve[segment] || '#888'
    };
  });

  const segmenter = {};
  kunder.forEach(k => {
    if (!segmenter[k.segment]) segmenter[k.segment] = [];
    segmenter[k.segment].push(k);
  });

  return { kunder, segmenter };
}

export function beregnTopProdukter(orders) {
  const produkter = {};
  orders.forEach(o => {
    (o.line_items || []).forEach(item => {
      const id = item.product_id;
      if (!produkter[id]) produkter[id] = { navn: item.name, antalSolgt: 0, omsaetning: 0 };
      produkter[id].antalSolgt += item.quantity;
      produkter[id].omsaetning += parseFloat(item.total);
    });
  });
  return Object.values(produkter)
    .sort((a, b) => b.omsaetning - a.omsaetning)
    .slice(0, 10)
    .map(p => ({ ...p, omsaetning: Math.round(p.omsaetning) }));
}

export function beregnLTV(orders, customers) {
  const kundeData = {};
  orders.forEach(o => {
    const id = o.customer_id;
    if (!id) return;
    if (!kundeData[id]) kundeData[id] = { totalKoeb: 0, antalOrdrer: 0, sidstKobt: null };
    kundeData[id].totalKoeb += parseFloat(o.total);
    kundeData[id].antalOrdrer += 1;
    const dato = new Date(o.date_created);
    if (!kundeData[id].sidstKobt || dato > kundeData[id].sidstKobt) {
      kundeData[id].sidstKobt = dato;
    }
  });

  return customers
    .filter(c => kundeData[c.id])
    .map(c => ({
      id: c.id,
      navn: `${c.first_name} ${c.last_name}`,
      email: c.email,
      totalKoeb: Math.round(kundeData[c.id].totalKoeb),
      antalOrdrer: kundeData[c.id].antalOrdrer,
      sidstKobt: kundeData[c.id].sidstKobt.toISOString().split('T')[0]
    }))
    .sort((a, b) => b.totalKoeb - a.totalKoeb)
    .slice(0, 10);
}

export function beregnPrognose(orders) {
  const iDag = new Date();
  // Byg månedlig omsætning de sidste 3 måneder
  const maaneder = [2, 1, 0].map(offset => {
    const start = new Date(iDag.getFullYear(), iDag.getMonth() - offset, 1);
    const slut = new Date(iDag.getFullYear(), iDag.getMonth() - offset + 1, 1);
    const sum = orders
      .filter(o => { const d = new Date(o.date_created); return d >= start && d < slut; })
      .reduce((s, o) => s + parseFloat(o.total), 0);
    return Math.round(sum);
  });

  // Simpel lineær trend
  const [m1, m2, m3] = maaneder;
  const trend = ((m2 - m1) + (m3 - m2)) / 2;
  const prognose = Math.max(0, Math.round(m3 + trend));
  const pct = m3 > 0 ? Math.round((trend / m3) * 100) : 0;

  return { historik: maaneder, prognose, pct };
}

export function beregnChurn(orders, customers, dage = 90) {
  const iDag = new Date();
  const graense = new Date();
  graense.setDate(iDag.getDate() - dage);

  // Find seneste ordre per kunde
  const sidsteKoeb = {};
  orders.forEach(o => {
    const id = o.customer_id;
    if (!id) return;
    const dato = new Date(o.date_created);
    if (!sidsteKoeb[id] || dato > sidsteKoeb[id]) {
      sidsteKoeb[id] = dato;
    }
  });

  const ifare = [];
  const loyale = [];

  customers.forEach(c => {
    const sidst = sidsteKoeb[c.id];
    if (!sidst) return;

    const dagesiden = Math.floor((iDag - sidst) / (1000 * 60 * 60 * 24));
    const kundeInfo = {
      id: c.id,
      navn: `${c.first_name} ${c.last_name}`,
      email: c.email,
      sidstKobt: sidst.toISOString().split('T')[0],
      dageSiden: dagesiden
    };

    if (sidst < graense) {
      ifare.push(kundeInfo);
    } else if (dagesiden <= 30) {
      loyale.push(kundeInfo);
    }
  });

  return { ifare, loyale };
}
