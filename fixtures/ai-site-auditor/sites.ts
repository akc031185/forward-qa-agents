// Two fabricated sites for The AI Site Auditor, shared by the tests and `npm run fixture:audit-sites`.
// Site 1 is what a Vite/React export from an AI builder usually looks like; site 2 is server-rendered.
import http from 'node:http';

// ── Site 1: what a Vite/React export from an AI builder usually looks like ──
export const FAKE_KEY = 'sk-proj-' + 'Zq7'.repeat(16);   // shape of a real key, not a real key
const SPA_SHELL = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><link rel="icon" href="/vite.svg"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vite + React</title><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div></body></html>`;
const SPA_JS = `
const OPENAI_KEY = "${FAKE_KEY}";
const routes = {
  '/': { title: 'Acme Robotics', h1: 'Robots that fold laundry', body: 'We build home robots. '.repeat(20) + 'Contact John Doe at hello@example.com or (555) 123-4567.' },
  '/pricing': { title: 'Acme Robotics', h1: 'Pricing', body: 'Plans for every home. '.repeat(20) },
};
const r = routes[location.pathname] || { title: 'Acme Robotics', h1: 'Not found', body: 'Nothing here. '.repeat(10) };
document.title = r.title;
const m = document.createElement('meta'); m.name = 'description'; m.content = 'Acme robots'; document.head.appendChild(m);
document.getElementById('root').innerHTML = '<nav><a href="/">Home</a> <a href="/pricing">Pricing</a></nav><h1>' + r.h1 + '</h1><p>' + r.body + '</p><img src="/hero.png"><a id="lovable-badge" href="https://lovable.dev/projects/x">Edit with Lovable</a>';
console.error('Failed to load resource: analytics');
`;

// ── Site 2: server-rendered, the way it should be done ──
const ssr = (title: string, h1: string, pathName: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><meta name="description" content="${title} — home robots that fold laundry, explained."><link rel="canonical" href="ORIGIN${pathName}"><link rel="icon" href="/favicon.png">
<meta property="og:title" content="${title}"><meta property="og:image" content="ORIGIN/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme Robotics","url":"ORIGIN/"}</script></head>
<body><header><nav><a href="/">Home</a> <a href="/pricing">Pricing</a></nav></header><main><h1>${h1}</h1><p>${'Acme builds home robots that fold laundry and tidy rooms. '.repeat(12)}</p><img src="/hero.png" alt="A robot folding a shirt"><img src="/never.png" alt="An image whose request never finishes"></main></body></html>`;

export function createSpaSite(): http.Server {
  return http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/assets/index.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(SPA_JS); }
    if (u.pathname === '/hero.png' || u.pathname === '/vite.svg') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.alloc(0)); }
    if ((req.headers['user-agent'] ?? '').includes('PerplexityBot')) { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('<title>Attention Required</title>'); }
    res.writeHead(200, { 'content-type': 'text/html' });   // catch-all: robots.txt, sitemap.xml, llms.txt and junk all get the shell
    res.end(SPA_SHELL);
  });
}

export function createSsrSite(): http.Server {
  return http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const origin = `http://${req.headers.host}`;
    const send = (status: number, type: string, body: string) => { res.writeHead(status, { 'content-type': type, 'x-content-type-options': 'nosniff' }); res.end(body.replaceAll('ORIGIN', origin)); };
    if (u.pathname === '/never.png') return;   // holds the load event open forever
    if (u.pathname === '/robots.txt') return send(200, 'text/plain', 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ORIGIN/sitemap.xml\nSitemap: http://production.invalid/sitemap.xml\n');
    if (u.pathname === '/sitemap.xml') return send(200, 'application/xml', '<?xml version="1.0"?><urlset><url><loc>ORIGIN/</loc></url><url><loc>ORIGIN/pricing</loc></url></urlset>');
    if (u.pathname === '/llms.txt') return send(200, 'text/markdown', '# Acme Robotics\n\n> Home robots.\n\n- [Pricing](ORIGIN/pricing): plans\n');
    if (u.pathname === '/') return send(200, 'text/html', ssr('Acme Robotics — Home', 'Robots that fold laundry', '/'));
    if (u.pathname === '/pricing') return send(200, 'text/html', ssr('Pricing — Acme Robotics', 'Pricing', '/pricing'));
    if (u.pathname === '/hero.png' || u.pathname === '/favicon.png' || u.pathname === '/og.png') return send(200, 'image/png', '');
    return send(404, 'text/html', '<h1>Not found</h1>');
  });
}

// ── Site 3: server-rendered and technically fine, but every design tell is present ──
// Isolates the design area: AI visibility and search score well, so a low design grade can only
// come from the design checks themselves. Styles are inline so the CSSOM is same-origin readable.
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const LUCIDE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lucide lucide-zap"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
const VIBE_CSS = `
:root{--mouse-x:0px;--mouse-y:0px}
body{margin:0;background:#0a0a0a;color:#fafafa;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.hero{background-image:${GRAIN},linear-gradient(135deg,rgb(124,58,237) 0%,rgb(59,130,246) 100%);padding:41px 13px}
.hero h1{font-family:'Space Grotesk',Inter,sans-serif;background-image:linear-gradient(90deg,rgb(139,92,246),rgb(56,189,248));-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:21px}
.badge{display:inline-block;border-radius:999px;font-size:12px;padding:7px 18px;background:rgba(255,255,255,.1)}
.accent{font-family:'Instrument Serif',Georgia,serif;font-style:italic}
.muted,.text-muted-foreground{color:rgb(115,115,115);font-size:16px}
.beam{position:fixed;left:var(--mouse-x);top:var(--mouse-y);width:200px;height:200px}
.grid{display:flex;gap:26px;padding:33px 7px}
.card{border:1px solid rgb(139,92,246);border-radius:14px;padding:18px 26px;backdrop-filter:blur(12px);background:rgba(255,255,255,.04)}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}
.btn,a.btn{border-radius:10px;padding:13px 21px;background:rgb(124,58,237);color:#fff;text-decoration:none;display:inline-block}
.btn:hover,a.btn:hover{opacity:.8}
`;
const vibe = (title: string, h1: string, pathName: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><meta name="description" content="${title} — an analytics platform for modern teams."><link rel="canonical" href="ORIGIN${pathName}"><link rel="icon" href="/favicon.png">
<meta property="og:title" content="${title}"><meta property="og:image" content="ORIGIN/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Nimbus","url":"ORIGIN/"}</script>
<style>${VIBE_CSS}</style></head>
<body><header><nav><a href="/">Home</a> <a href="/pricing">Pricing</a></nav></header>
<main><section class="hero"><span class="badge">✨ Now in beta</span><h1>🚀 ${h1}</h1>
<p class="muted text-muted-foreground">Seamlessly supercharge your workflow — a cutting-edge platform — built for the future — so your team can elevate your output.</p>
<p class="accent">Analytics, reimagined.</p><a class="btn" href="/pricing">Get started</a></section>
<section class="grid">
  <div class="card reveal">${LUCIDE}<h3>Fast</h3><p class="muted text-muted-foreground">Effortlessly quick.</p></div>
  <div class="card reveal">${LUCIDE}<h3>Secure</h3><p class="muted text-muted-foreground">Robust and scalable.</p></div>
  <div class="card reveal">${LUCIDE}<h3>Simple</h3><p class="muted text-muted-foreground">Powerful and intuitive.</p></div>
</section>
<section class="grid"><div class="card reveal">${LUCIDE}<h3>More</h3><p class="muted">Detail.</p></div><div class="card reveal">${LUCIDE}<h3>Even more</h3><p class="muted">Detail.</p></div><div class="card reveal">${LUCIDE}<h3>Most</h3><p class="accent">Built different.</p></div></section>
<div class="beam"></div><img src="/hero.png" alt="A dashboard showing weekly active users"></main></body></html>`;

export function createVibecodedSite(): http.Server {
  return http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const origin = `http://${req.headers.host}`;
    const send = (status: number, type: string, body: string) => { res.writeHead(status, { 'content-type': type, 'x-content-type-options': 'nosniff' }); res.end(body.replaceAll('ORIGIN', origin)); };
    if (u.pathname === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nAllow: /\n\nSitemap: ORIGIN/sitemap.xml\n');
    if (u.pathname === '/sitemap.xml') return send(200, 'application/xml', '<?xml version="1.0"?><urlset><url><loc>ORIGIN/</loc></url></urlset>');
    if (u.pathname === '/') return send(200, 'text/html', vibe('Nimbus — Analytics', 'Ship faster with Nimbus', '/'));
    if (u.pathname === '/pricing') return send(200, 'text/html', vibe('Pricing — Nimbus', 'Simple pricing', '/pricing'));
    if (u.pathname === '/hero.png' || u.pathname === '/favicon.png' || u.pathname === '/og.png') return send(200, 'image/png', '');
    return send(404, 'text/html', '<h1>Not found</h1>');
  });
}
