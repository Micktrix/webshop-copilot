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
