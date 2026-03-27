import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyserSEO({ topProdukter, kategorier, shopUrl }) {
  const produktListe = topProdukter.slice(0, 6).map(p => p.navn).join('\n- ');
  const kategoriListe = kategorier.slice(0, 6).join(', ');

  const prompt = `Du er en dansk SEO-ekspert der hjælper webshop-ejere.

Butikkens URL: ${shopUrl}
Produktkategorier: ${kategoriListe}
Top-produkter:
- ${produktListe}

Lav to ting:

1. PRODUKT-ANALYSE: Analyser produkt-titlerne og vurder om de er SEO-venlige. For hver titel: giv en vurdering (god/ok/svag) og et konkret forslag til en bedre titel der inkluderer søgeord folk søger på.

2. SØGEORDS-IDÉER: Generer 12 søgeord inddelt i tre kategorier:
   - "Lette" (lav konkurrence, realistisk at ranke på)
   - "Mellemsvære" (medium konkurrence, god trafik)
   - "Værdifulde" (høj konvertering, folk klar til at købe)

Returner KUN dette JSON (ingen forklaring, ingen markdown):
{
  "produktAnalyse": [
    {
      "original": "original titel",
      "vurdering": "god|ok|svag",
      "forslag": "forbedret titel med søgeord",
      "begrundelse": "kort forklaring"
    }
  ],
  "soegord": {
    "lette": ["søgeord 1", "søgeord 2", "søgeord 3", "søgeord 4"],
    "mellемsvære": ["søgeord 1", "søgeord 2", "søgeord 3", "søgeord 4"],
    "værdifulde": ["søgeord 1", "søgeord 2", "søgeord 3", "søgeord 4"]
  }
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

export async function genererBlogIdeer({ topProdukter, kategorier, shopUrl }) {
  const produktListe = topProdukter.slice(0, 5).map(p => p.navn).join(', ');
  const kategoriListe = kategorier.slice(0, 5).join(', ');

  const prompt = `Du er en dansk content-strateg der hjælper webshops med SEO via blogindlæg.

Butik: ${shopUrl}
Kategorier: ${kategoriListe}
Topsælgende produkter: ${produktListe}

Generer 6 blogindlæg-idéer der:
- Matcher søgeord potentielle kunder søger på
- Understøtter salget af ovenstående produkter
- Er realistiske for en lille webshop at skrive

Returner KUN dette JSON (ingen forklaring, ingen markdown):
{
  "ideer": [
    {
      "titel": "Blogindlæg-titel der er SEO-venlig",
      "soegord": "primært søgeord",
      "beskrivelse": "2 sætninger om hvad indlægget skal handle om",
      "svaerhed": "let|medium|svær"
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

export async function genererProduktBeskrivelse({ produktnavn, kategori, shopUrl }) {
  const prompt = `Du er en dansk SEO-tekstforfatter der skriver produktbeskrivelser til webshops.

Produkt: ${produktnavn}
Kategori: ${kategori}
Butik: ${shopUrl}

Skriv en SEO-optimeret produktbeskrivelse der:
- Er 80-120 ord
- Indeholder relevante søgeord naturligt
- Fremhæver fordele frem for features
- Er på dansk og har en venlig tone

Returner KUN dette JSON (ingen forklaring, ingen markdown):
{
  "beskrivelse": "den færdige produktbeskrivelse her",
  "metaBeskrivelse": "meta description på max 155 tegn",
  "soegord": ["søgeord1", "søgeord2", "søgeord3"]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}
