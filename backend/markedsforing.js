import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function overvaagsKonkurrenter(topProdukter) {
  const produkter = topProdukter.slice(0, 4).map(p => p.navn).join(', ');

  const prompt = `Søg på Google Shopping og nettet efter priser på disse produkter: ${produkter}.

Find hvad de koster hos danske og internationale webshops.

Returner KUN dette JSON (ingen forklaring, ingen markdown):
{
  "produkter": [
    {
      "navn": "produktnavn",
      "voresPris": null,
      "konkurrenter": [
        { "butik": "Butiksnavn", "pris": 299 }
      ]
    }
  ]
}

Inkluder 2-4 konkurrenter per produkt. Brug de faktiske priser du finder.`;

  const messages = [{ role: 'user', content: prompt }];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages
  });

  while (response.stop_reason === 'tool_use') {
    messages.push({ role: 'assistant', content: response.content });
    const toolResults = response.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
    messages.push({ role: 'user', content: toolResults });
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages
    });
  }

  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const match = raw.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : raw); } catch { return { produkter: [] }; }
}

export async function genererContentPakke({ titel, beskrivelse, shopProfil, topProdukter, kategorier, shopUrl }) {
  const produktListe = topProdukter.slice(0, 5).map(p => p.navn).join(', ');

  const prompt = `Du er en professionel marketing-copywriter for en dansk webshop.

SHOP: ${shopUrl}
SHOP-PROFIL: ${shopProfil || kategorier.join(', ')}
TOP-PRODUKTER: ${produktListe}

MARKETINGMULIGHED: ${titel}
BESKRIVELSE: ${beskrivelse}

Generer færdigt marketingindhold til ALLE disse kanaler. Returner KUN dette JSON (ingen forklaring, ingen markdown):
{
  "email": {
    "emne": "Email-emnelinje",
    "tekst": "Email-brødtekst med {navn} som personalisering. Brug \\n for linjeskift."
  },
  "social": {
    "facebook": "Færdigt Facebook-opslag med emojis. Klar til copy-paste. Max 3 afsnit.",
    "instagram": "Færdigt Instagram-opslag med emojis og relevante hashtags. Max 2200 tegn."
  },
  "ads": {
    "overskrifter": ["Max 30 tegn", "Max 30 tegn", "Max 30 tegn"],
    "beskrivelser": ["Max 90 tegn beskrivelse 1", "Max 90 tegn beskrivelse 2"]
  },
  "sms": "Kort SMS under 160 tegn. Inkluder et call-to-action."
}

Skriv på dansk. Vær konkret og salgsorienteret. Brug shopens faktiske produktkategorier som kontekst.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const json = JSON.parse(match ? match[0] : raw);
    if (json.email?.tekst) json.email.tekst = json.email.tekst.replace(/\\n/g, '\n');
    return json;
  } catch {
    return null;
  }
}

export async function genererMarkedsforing({ topProdukter, kategorier, shopUrl, shopHtml }) {
  const iDag = new Date().toLocaleDateString('da-DK', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const produktListe = topProdukter.slice(0, 8).map(p => p.navn).join(', ');
  const kategoriListe = kategorier.join(', ');

  const prompt = `I dag er det ${iDag}.

Du analyserer en dansk webshop og skal finde konkrete marketingmuligheder.

SHOP INFO:
- URL: ${shopUrl}
- Produktkategorier: ${kategoriListe || 'ukendt'}
- Bedst sælgende produkter: ${produktListe || 'ukendt'}

HJEMMESIDE INDHOLD (uddrag af HTML — brug det til at forstå brand, tone og målgruppe):
${shopHtml ? shopHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000) : 'Ikke tilgængeligt'}

Din opgave:
1. Forstå hvad denne shop sælger og hvem deres kunder er
2. Søg på internettet efter kommende begivenheder, trends og sæsonmuligheder de næste 60 dage der er relevante for NETOP DENNE shop
3. Find 4-5 konkrete marketingmuligheder

Returner KUN dette JSON-format (ingen forklaring, ingen markdown):
{
  "shopProfil": "1 sætning der beskriver shoppen og dens kunder",
  "forslag": [
    {
      "titel": "Kort titel fx 'Påskekampagne'",
      "beskrivelse": "Konkret og specifik beskrivelse — henvis til deres faktiske produkter og målgruppe",
      "dage": 18,
      "type": "genaktiver"
    }
  ]
}

'dage' er antal dage til begivenheden (0 hvis igangværende trend). 'type' skal være en af: genaktiver, loyale, klub`;

  const messages = [{ role: 'user', content: prompt }];

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages
  });

  while (response.stop_reason === 'tool_use') {
    messages.push({ role: 'assistant', content: response.content });
    const toolResults = response.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages
    });
  }

  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { shopProfil: '', forslag: [] };
  }
}
