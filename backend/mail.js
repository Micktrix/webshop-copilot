import nodemailer from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Til test bruger vi Ethereal (gratis fake SMTP — mails sendes ikke rigtig men kan ses online)
export async function createTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
    _previewUrl: testAccount
  });
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

  // Udtræk JSON fra svaret — selv hvis der er tekst omkring det
  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const json = JSON.parse(match ? match[0] : raw);
    // Erstat literal \n med rigtige linjeskift
    json.tekst = json.tekst.replace(/\\n/g, '\n');
    return json;
  } catch {
    return { emne: 'Vi savner dig!', tekst: raw };
  }
}

export async function sendMails(kunder, emne, tekst) {
  const transporter = await createTransporter();
  const resultater = [];

  for (const kunde of kunder) {
    const personligTekst = tekst.replace('{navn}', kunde.navn.split(' ')[0]);

    const info = await transporter.sendMail({
      from: '"Webshop Co-pilot" <noreply@webshop.dk>',
      to: kunde.email,
      subject: emne,
      text: personligTekst
    });

    resultater.push({
      navn: kunde.navn,
      email: kunde.email,
      previewUrl: nodemailer.getTestMessageUrl(info)
    });
  }

  return resultater;
}
