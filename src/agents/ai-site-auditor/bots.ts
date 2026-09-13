// The crawlers that decide whether a site can be found and cited by AI assistants, with what each
// one does. Sources: developers.openai.com/api/docs/bots, Anthropic's crawler docs (Feb 2026),
// Perplexity's bot docs, Google Search Central "AI features and your website" (Dec 2025), and the
// Vercel/MERJ crawler study (Dec 2024) for which ones execute JavaScript.

export type BotPurpose = 'search' | 'user-fetch' | 'training' | 'policy-token';

export interface AiBot {
  token: string;              // the robots.txt user-agent token
  vendor: string;
  purpose: BotPurpose;
  rendersJs: boolean;         // false = sees only the raw HTML response
  userAgent?: string;         // full string, for the firewall check (policy tokens never fetch)
  note: string;
}

export const AI_BOTS: AiBot[] = [
  { token: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'search', rendersJs: false, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot', note: 'Surfaces sites in ChatGPT search results.' },
  { token: 'ChatGPT-User', vendor: 'OpenAI', purpose: 'user-fetch', rendersJs: false, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot', note: 'Fetches a page when a ChatGPT user asks about it.' },
  { token: 'GPTBot', vendor: 'OpenAI', purpose: 'training', rendersJs: false, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot', note: 'Collects training data. Blocking it does not remove you from ChatGPT search.' },
  { token: 'Claude-SearchBot', vendor: 'Anthropic', purpose: 'search', rendersJs: false, note: 'Indexes content for Claude search results.' },
  { token: 'Claude-User', vendor: 'Anthropic', purpose: 'user-fetch', rendersJs: false, note: 'Fetches a page when a Claude user asks about it.' },
  { token: 'ClaudeBot', vendor: 'Anthropic', purpose: 'training', rendersJs: false, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', note: 'Collects training data.' },
  { token: 'PerplexityBot', vendor: 'Perplexity', purpose: 'search', rendersJs: false, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', note: 'Indexes content for Perplexity answers.' },
  { token: 'Perplexity-User', vendor: 'Perplexity', purpose: 'user-fetch', rendersJs: false, note: 'Fetches a page when a Perplexity user asks about it.' },
  { token: 'Googlebot', vendor: 'Google', purpose: 'search', rendersJs: true, note: 'Google Search, including AI Overviews and AI Mode. Renders JavaScript, later.' },
  { token: 'Google-Extended', vendor: 'Google', purpose: 'policy-token', rendersJs: true, note: 'Not a crawler. Opts content out of Gemini training; does not affect Search or AI Overviews.' },
  { token: 'Applebot-Extended', vendor: 'Apple', purpose: 'policy-token', rendersJs: true, note: 'Not a crawler. Opts content out of Apple model training.' },
  { token: 'CCBot', vendor: 'Common Crawl', purpose: 'training', rendersJs: false, note: 'Open crawl reused by many model builders for training.' },
];

/** Bots whose robots.txt access decides whether an AI assistant can find and cite the site. */
export const CITATION_BOTS = AI_BOTS.filter(b => b.purpose === 'search' || b.purpose === 'user-fetch');
/** Bots sent with their real user agent to see whether a firewall or CDN turns them away. */
export const UA_PROBE_BOTS = AI_BOTS.filter(b => b.userAgent);
