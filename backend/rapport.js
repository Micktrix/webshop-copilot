import { sendEnMail } from './mail.js';

export function beregnUgensData(orders, customers, churn, topProdukter) {
  const iDag = new Date();
  const for7Dage = new Date(); for7Dage.setDate(iDag.getDate() - 7);
  const for14Dage = new Date(); for14Dage.setDate(iDag.getDate() - 14);

  const denneUge = orders.filter(o => new Date(o.date_created) >= for7Dage);
  const forrigeUge = orders.filter(o => {
    const d = new Date(o.date_created);
    return d >= for14Dage && d < for7Dage;
  });

  const omsD = Math.round(denneUge.reduce((s, o) => s + parseFloat(o.total), 0));
  const omsF = Math.round(forrigeUge.reduce((s, o) => s + parseFloat(o.total), 0));
  const omsPct = omsF > 0 ? Math.round(((omsD - omsF) / omsF) * 100) : null;

  const nyeKunder = customers.filter(c => new Date(c.date_created) >= for7Dage).length;
  const topProdukt = topProdukter[0] || null;

  return { omsD, omsF, omsPct, nyeKunder, ifare: churn.ifare.length, topProdukt };
}

export async function sendUgerapport(shop, ugensData, tip) {
  const { omsD, omsF, omsPct, nyeKunder, ifare, topProdukt } = ugensData;

  const pilOg = omsPct != null
    ? `<span style="color:${omsPct >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${omsPct >= 0 ? '↑' : '↓'} ${Math.abs(omsPct)}% vs. forrige uge</span>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:580px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#1a1a2e;padding:28px 32px">
      <div style="color:white;font-size:1.1rem;font-weight:700">Vixx</div>
      <div style="color:rgba(255,255,255,0.5);font-size:0.82rem;margin-top:4px">Ugerapport — ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>

    <!-- Nøgletal -->
    <div style="padding:28px 32px 0">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:16px">Ugens tal</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div style="background:#f4f6f9;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.75rem;color:#888;margin-bottom:6px">Omsætning</div>
          <div style="font-size:1.4rem;font-weight:700;color:#1a1a2e">${omsD.toLocaleString('da-DK')} kr</div>
          <div style="font-size:0.78rem;margin-top:4px">${pilOg}</div>
        </div>
        <div style="background:#f4f6f9;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.75rem;color:#888;margin-bottom:6px">Nye kunder</div>
          <div style="font-size:1.4rem;font-weight:700;color:#1a1a2e">${nyeKunder}</div>
        </div>
        <div style="background:#fee2e2;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:0.75rem;color:#888;margin-bottom:6px">Kunder i fare</div>
          <div style="font-size:1.4rem;font-weight:700;color:#dc2626">${ifare}</div>
          <div style="font-size:0.78rem;color:#888;margin-top:4px">ikke købt i 90+ dage</div>
        </div>
      </div>
    </div>

    ${topProdukt ? `
    <!-- Top produkt -->
    <div style="padding:20px 32px 0">
      <div style="background:#ede9fe;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6366f1;margin-bottom:4px">Ugens bedste produkt</div>
          <div style="font-weight:600;color:#1a1a2e">${topProdukt.navn}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.2rem;font-weight:700;color:#6366f1">${topProdukt.omsaetning.toLocaleString('da-DK')} kr</div>
          <div style="font-size:0.78rem;color:#888">${topProdukt.antalSolgt} solgt</div>
        </div>
      </div>
    </div>` : ''}

    ${tip ? `
    <!-- AI anbefaling -->
    <div style="padding:20px 32px 0">
      <div style="background:#1a1a2e;border-radius:10px;padding:20px">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:8px">✦ AI-anbefaling</div>
        <div style="color:rgba(255,255,255,0.9);font-size:0.9rem;line-height:1.6">${tip}</div>
      </div>
    </div>` : ''}

    ${ifare > 0 ? `
    <!-- CTA -->
    <div style="padding:20px 32px 0;text-align:center">
      <a href="https://www.vixx.dk/dashboard.html" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;font-weight:600;font-size:0.9rem;text-decoration:none">Åbn dashboard og tag handling</a>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:24px 32px;margin-top:24px;border-top:1px solid #f0f0f0;text-align:center">
      <div style="font-size:0.78rem;color:#aaa">Vixx · Du modtager denne mail fordi du har slået ugerapport til</div>
    </div>
  </div>
</body>
</html>`;

  return sendEnMail({
    to: shop.email,
    subject: `Ugerapport: ${omsD.toLocaleString('da-DK')} kr denne uge${omsPct != null ? ` (${omsPct >= 0 ? '+' : ''}${omsPct}%)` : ''}`,
    html
  });
}
