import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { text, vendor } = await req.json();
  const rates = await fetch('https://rates.harbor-fixture.dev/v1/latest').then(r => r.json());
  if (vendor === 'b') {
    const m = await anthropic.messages.create({ model: 'fixture-model', max_tokens: 200, messages: [{ role: 'user', content: text }] });
    return Response.json({ m, rates });
  }
  const r = await openai.chat.completions.create({ model: 'fixture-model', messages: [{ role: 'user', content: text }] });
  return Response.json({ r, rates });
}
