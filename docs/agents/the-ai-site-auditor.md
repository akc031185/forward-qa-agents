# The AI Site Auditor

**Plate 46** · `ai-site-auditor`

> Point it at a site built with an AI tool; it scores whether AI assistants can read and cite it, whether search engines will index it, and which build mistakes were left behind, then writes an evaluation page.

## The chore

- A site made with Lovable, Bolt, v0, Replit or a Vite/CRA export looks finished in a browser.
- Nobody checks what a crawler actually receives, so the problems stay invisible until traffic doesn't come.
- The usual audit is a pile of SEO tools that ignore AI assistants, and never look inside the JavaScript bundle for a leaked key.

## Instead

- One command, one self-contained `report.html` you can hand to the site owner.
- Three scores: **AI visibility**, **Search**, **Build quality**, each 0–100 with a letter grade.
- A side-by-side of what an AI crawler sees (JavaScript off) versus a browser, per page.
- Every finding carries why it matters, the fix, the pages affected and a source link.

## How it works

1. **Site probes, no browser.** `robots.txt`, sitemaps (this host only), `llms.txt`, a random URL to detect soft 404s, `http→https`, `/.env`, security headers, and the home page requested with each AI crawler's real user agent.
2. **Two views per page.** The raw HTML is fetched once, then fed into Chromium with JavaScript disabled (what GPTBot, OAI-SearchBot, ClaudeBot and PerplexityBot get) and loaded normally (what a browser and Googlebot's renderer get). One extraction script reads both.
3. **Crawl.** Start URL, same-origin sitemap URLs, then links from rendered pages, up to `max_pages` (default 10).
4. **Bundle scan.** Same-origin scripts are fetched and scanned for OpenAI, Anthropic, Stripe, AWS and GitHub keys, private keys and Supabase `service_role` JWTs; values are redacted to six characters.
5. **Rules.** 51 deterministic checks with fixed severities (12 AI visibility, 24 search, 15 build), plus integrity checks so a failed audit never reads as a pass. A problem on many pages is one finding listing the pages.
6. **Scores and report.** 100 minus 40 per critical, 18 per high, 8 per medium, 3 per low finding in each area. `report.html`, `report.md`, `report.json`, findings and artifacts in SQLite.

## What it checks

| Area | Checks |
|---|---|
| AI visibility | content only after JavaScript · title, h1, description or JSON-LD set by JavaScript · robots.txt blocking search/user-fetch agents · firewall blocking AI user agents · no or invalid structured data · `nosnippet` · `llms.txt` missing (info) or malformed |
| Search | robots.txt missing, HTML, or blocking Googlebot · no sitemap, broken sitemap URLs, sitemap on another host · soft 404 · http not redirected · `noindex` · missing, duplicate or long titles · missing or duplicate descriptions · missing canonical, canonical to home, canonical to another host · missing or multiple h1 · lang, viewport · hash routes · Open Graph · image alt · broken internal pages |
| Build quality | secrets in JavaScript · public browser keys (info) · `/.env` downloadable · public source maps · scaffold titles ("Vite + React", "React App"…) · placeholder copy · builder badges and default favicons · console errors · failed requests · mixed content · heavy JavaScript · missing security headers · pages that could not render · load event that never fires |

Judgement calls encoded in the rules, with sources:

- AI crawlers from OpenAI, Anthropic and Perplexity do not execute JavaScript ([Vercel/MERJ, Dec 2024](https://vercel.com/blog/the-rise-of-the-ai-crawler)).
- Blocking training agents (GPTBot, ClaudeBot) is a policy choice; blocking search and user-fetch agents removes the site from answers ([OpenAI](https://developers.openai.com/api/docs/bots)).
- Google needs nothing AI-specific beyond indexability and snippet eligibility; structured data is not required ([Search Central, Dec 2025](https://developers.google.com/search/docs/appearance/ai-features)).
- `llms.txt` is a proposal Google Search ignores, so its absence is `info` ([llmstxt.org](https://llmstxt.org/)).
- On localhost, private networks and preview hosts, canonicals and sitemaps pointing at production are expected and reported as `info`/`low`.

## Under the hood

**Input** (`POST /agents/ai-site-auditor/runs`, body `{ engagement_id, input }`):

| Field | Type | Default | Notes |
|---|---|---|---|
| `target_url` | URL | required | Start page |
| `org_slug` | string | required | Report label |
| `max_pages` | 1..50 | 10 | Pages audited |
| `timeout_ms` | 1000..120000 | 15000 | Per request and navigation |
| `headless` | boolean | true | |

**Output:** `{ pages_audited, scores, grades, findings_by_severity, report_html, report_md, summary }`.
`GET /agents/ai-site-auditor/runs/:id/report` serves `report.html`.

Source: `src/agents/ai-site-auditor/` — `bots.ts` (crawler list), `robots.ts` (RFC 9309 matcher), `parse.ts` (sitemap, llms.txt, secrets, placeholders), `collect.ts` (probes and two-view browser pass), `rules.ts` (checks and scores), `report.ts`, `index.ts`, `cli.ts`.

## Runbook

```bash
npm install && npx playwright install chromium

# try it on two fabricated sites
npm run fixture:audit-sites                      # SPA on :4801, server-rendered on :4802
npm run agent:audit -- --url http://127.0.0.1:4801/ --org acme-robotics
npm run agent:audit -- --url http://127.0.0.1:4802/ --org acme-robotics

# a real site (only sites you own or are authorised to test)
npm run agent:audit -- --url https://www.example.com/ --org acme --max-pages 20
open workspace/<run_id>/report.html
```

## Example

Recorded runs on 2026-09-13 against the bundled fixture sites:

| Site | AI visibility | Search | Build | Findings |
|---|---|---|---|---|
| AI-builder SPA (`:4801`) | 0 · F | 46 · D | 23 · F | 2 critical, 5 high, 7 medium, 6 low |
| Server-rendered (`:4802`) | 100 · A | 97 · A | 97 · A | 2 low |

The SPA's home page: 97 words in a browser, 0 in the HTML crawlers receive; title "Vite + React" to crawlers, "Acme Robotics" in a browser; an OpenAI-shaped key in the bundle; PerplexityBot answered with 403.

Validated the same day against three real local builds before release: two Create React App builds (D and F for AI visibility; 0 of 18 and 9 of 435 words visible without JavaScript) and one Next.js build (A; 192 of 193 words). That validation found and fixed three bugs: a render timeout that scored a site 100 while auditing nothing, a word threshold that skipped small app shells, and a form label read as placeholder copy.

## Known limitations

- Crawler prerendering that only serves verified crawler IPs cannot be observed from outside; the report says so.
- Checks the home page and up to `max_pages` pages; it does not submit forms or log in.
- Secret detection is pattern-based: it finds known key shapes, not every credential.
