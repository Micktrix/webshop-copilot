import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function genererTip(noeglettal, churn) {
  const prompt = `Du er en e-commerce rådgiver for en lille webshop. Her er deres data:

Omsætning sidste 30 dage: ${noeglettal.omsaetning} kr
Antal ordrer: ${noeglettal.antalOrdrer}
Gennemsnitskøb: ${noeglettal.gennemsnit} kr
Kunder i fare for at forsvinde (ikke købt i 90+ dage): ${churn.ifare.length}
Loyale kunder (købt inden for 30 dage): ${churn.loyale.length}

Giv ét kort, konkret handlingsforslag på dansk (maks 2 sætninger) baseret på den vigtigste indsigt i disse tal.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}
