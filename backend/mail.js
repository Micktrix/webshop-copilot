import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resendKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
const resend = resendKey ? new Resend(resendKey) : null;

const AFSENDER_MAIL = process.env.RESEND_FROM || 'noreply@vixx.dk';
const BASE_URL = process.env.BASE_URL || 'https://vixx.dk';

function htmlSkabelon(tekst, fromName, unsubscribeUrl) {
  const linjer = tekst
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => `<p style="margin:0 0 14px;line-height:1.6">${l}</p>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#f9f9f9;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;padding:40px;font-family:Arial,sans-serif;color:#333;font-size:15px">
        <tr><td>
          ${linjer}
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
          <p style="font-size:11px;color:#aaa;text-align:center;margin:0">
            Du modtager denne mail som kunde hos ${fromName}.<br>
            <a href="${unsubscribeUrl}" style="color:#aaa;text-decoration:underline">Afmeld fremtidige mails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function genererMail(type, kunder, butiksNavn = 'din butik', rabatKode = null) {
  const kodeInfo = rabatKode
    ? `Brug PRÆCIS denne rabatkode i mailen: ${rabatKode}. Skriv ikke andre koder.`
    : `Du kan opfinde en rabatkode hvis relevant.`;

  const typer = {
    genaktiver: `Du skriver en kort, venlig genaktiveringsmail fra en webshop til kunder der ikke har købt i lang tid.
Butikkens navn er "${butiksNavn}". Skriv et emne og en mail der lokker dem tilbage. ${kodeInfo}`,
    loyale: `Du skriver en varm takkmail fra en webshop til deres mest loyale kunder.
Butikkens navn er "${butiksNavn}". Udtryk taknemmelighed og giv dem en lille eksklusiv fordel. ${kodeInfo}`,
    klub: `Du skriver en nyhedsmail fra en webshop til deres kundeklub.
Butikkens navn er "${butiksNavn}". Skriv noget der føles eksklusivt og personligt. ${kodeInfo}`,
    review: `Du skriver en kort, venlig mail fra en webshop der beder kunden om at skrive en anmeldelse af deres seneste køb.
Butikkens navn er "${butiksNavn}". Vær uformel og taknemlig. Gør det nemt og uforpligtende. ${kodeInfo}`
  };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `${typer[type]}

Returner KUN dette JSON-format (ingen forklaring):
{
  "emne": "emailens emne her",
  "tekst": "emailens brødtekst her (brug \\n for linjeskift)"
}`
    }]
  });

  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const json = JSON.parse(match ? match[0] : raw);
    json.tekst = json.tekst.replace(/\\n/g, '\n');
    return json;
  } catch {
    return { emne: 'Vi savner dig!', tekst: raw };
  }
}

export async function sendEnMail({ to, subject, html, text }) {
  if (resend) {
    return resend.emails.send({
      from: `Vixx <${AFSENDER_MAIL}>`,
      to,
      subject,
      html,
      text
    });
  }
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  return transporter.sendMail({ from: `"Vixx" <noreply@test.dk>`, to, subject, html, text });
}

export async function sendVelkomstMail(email) {
  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#f9f9f9;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;padding:40px;font-family:Arial,sans-serif;color:#333;font-size:15px">
        <tr><td>
          <div style="text-align:center;margin-bottom:28px">
            <div style="display:inline-block;background:#6366f1;border-radius:10px;width:44px;height:44px;line-height:44px;font-size:1.3rem;color:white;text-align:center">◈</div>
            <h1 style="font-size:1.4rem;font-weight:700;color:#0f172a;margin:12px 0 4px">Velkommen til Vixx</h1>
            <p style="color:#64748b;margin:0;font-size:0.95rem">Dit AI-dashboard til mere salg</p>
          </div>

          <p style="margin:0 0 14px;line-height:1.6">Hej!</p>
          <p style="margin:0 0 14px;line-height:1.6">Tak fordi du har oprettet dig på Vixx. Du er nu klar til at få indsigt i din butiks data — churn, omsætning, top-kunder og meget mere.</p>

          <p style="margin:0 0 8px;font-weight:700;color:#0f172a">Kom godt i gang i 3 trin:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9">
              <span style="background:#ede9fe;color:#6366f1;font-weight:700;border-radius:6px;padding:2px 8px;font-size:0.82rem;margin-right:10px">1</span>
              Log ind på dit dashboard og se dine første nøgletal
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9">
              <span style="background:#ede9fe;color:#6366f1;font-weight:700;border-radius:6px;padding:2px 8px;font-size:0.82rem;margin-right:10px">2</span>
              Se hvilke kunder der er i fare for at churne
            </td></tr>
            <tr><td style="padding:10px 0">
              <span style="background:#ede9fe;color:#6366f1;font-weight:700;border-radius:6px;padding:2px 8px;font-size:0.82rem;margin-right:10px">3</span>
              Opgrader til Pro og send din første AI-kampagnemail
            </td></tr>
          </table>

          <div style="text-align:center;margin-bottom:28px">
            <a href="https://www.vixx.dk/dashboard.html" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:700;font-size:0.95rem">Gå til dit dashboard →</a>
          </div>

          <p style="margin:0 0 14px;line-height:1.6;color:#64748b;font-size:0.88rem">Har du spørgsmål? Svar bare på denne mail.</p>
          <p style="margin:0;line-height:1.6">Med venlig hilsen,<br><strong>Vixx-teamet</strong></p>

          <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
          <p style="font-size:11px;color:#aaa;text-align:center;margin:0">Vixx · www.vixx.dk</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEnMail({
    to: email,
    subject: 'Velkommen til Vixx — dit dashboard er klar',
    html,
    text: `Velkommen til Vixx!\n\nTak fordi du har oprettet dig. Log ind på dit dashboard her: https://www.vixx.dk/dashboard.html\n\nMed venlig hilsen,\nVixx-teamet`
  });
}

export async function sendMails(kunder, emne, tekst, shopOpts = {}) {
  const { shopEmail = '', fromName = 'Din butik' } = shopOpts;
  const resultater = [];

  if (resend) {
    for (const kunde of kunder) {
      const personligTekst = tekst.replace(/\{navn\}/g, kunde.navn.split(' ')[0]);
      const token = Buffer.from(`${kunde.email}:${shopEmail}`).toString('base64url');
      const unsubscribeUrl = `${BASE_URL}/api/afmeld?token=${token}`;

      await resend.emails.send({
        from: `${fromName} <${AFSENDER_MAIL}>`,
        to: kunde.email,
        subject: emne,
        text: personligTekst,
        html: htmlSkabelon(personligTekst, fromName, unsubscribeUrl),
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` }
      });

      resultater.push({ navn: kunde.navn, email: kunde.email });
    }
    return resultater;
  }

  // Fallback: Ethereal (test uden rigtig afsendelse)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });

  for (const kunde of kunder) {
    const personligTekst = tekst.replace(/\{navn\}/g, kunde.navn.split(' ')[0]);
    const info = await transporter.sendMail({
      from: `"${fromName}" <noreply@test.dk>`,
      to: kunde.email,
      subject: emne,
      text: personligTekst
    });
    resultater.push({ navn: kunde.navn, email: kunde.email, previewUrl: nodemailer.getTestMessageUrl(info) });
  }

  return resultater;
}
