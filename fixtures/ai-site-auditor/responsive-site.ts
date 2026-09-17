// A fourth fabricated site: technically fine (indexable, server-rendered, no design tells) but
// wearing every responsiveness defect on purpose, so the responsive area can be exercised against
// a real browser end to end, not just against hand-built ResponsiveRaw fixtures.
import http from 'node:http';

// A big inline SVG whose *root* width/height attributes set its intrinsic size — the same thing a
// naturalWidth/naturalHeight read gives a real raster image, without needing to encode one.
const HUGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000" viewBox="0 0 2000 1000"><rect width="2000" height="1000" fill="#4263eb"/></svg>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fixture Co — Home</title><meta name="description" content="Fixture Co builds things, on purpose badly for a test.">
<link rel="canonical" href="ORIGIN/"><link rel="icon" href="/favicon.png">
<style>
  body{margin:0;font-family:system-ui,sans-serif;color:#111}
  header{padding:12px 16px}
  main{padding:16px}
  /* clean at a phone width, clean again from 600px up, but nothing covers the gap between —
     a real designer who only ever resized to 360 and then to a laptop would never see this. */
  .gap{width:500px;background:#eee;padding:8px}
  @media (max-width:400px){ .gap{width:auto} }
  @media (min-width:600px){ .gap{width:auto} }

  /* two icon buttons stacked on top of each other: a thumb aiming at one can hit both */
  .stack{position:relative;height:70px}
  .stack button{position:absolute;left:10px;top:10px;width:26px;height:26px;border:0;background:#4263eb}
  .stack button.second{left:22px;top:16px;background:#f03e3e}

  /* a single line of text in a box too short to hold it, with no ellipsis: it just vanishes */
  .clip{width:160px;height:20px;overflow:hidden;white-space:nowrap;background:#fafafa}

  /* a promo link outside the nav that a mobile media query removes with nothing put in its place */
  @media (max-width:480px){ .promo{display:none} }

  .hero-image{width:200px;height:100px;display:block}
</style></head>
<body>
<header><nav><a href="/">Home</a></nav></header>
<main>
  <h1>Fixture Co</h1>
  <p>${'This is real body copy describing a fictional company that builds fictional things. '.repeat(6)}</p>
  <div class="gap">A box that is only checked at the named breakpoints.</div>
  <div class="stack"><button aria-label="Like"></button><button class="second" aria-label="Share"></button></div>
  <p class="clip">A single line of text that is much longer than the box that contains it and gets cut off</p>
  <p class="promo"><a href="/case-studies">Read our case studies</a></p>
  <img class="hero-image" src="/hero.svg" alt="A hero illustration">
</main>
</body></html>`;

export function createResponsiveSite(): http.Server {
  return http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const origin = `http://${req.headers.host}`;
    const send = (status: number, type: string, body: string) => { res.writeHead(status, { 'content-type': type }); res.end(body.replaceAll('ORIGIN', origin)); };
    if (u.pathname === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nAllow: /\n');
    if (u.pathname === '/hero.svg') return send(200, 'image/svg+xml', HUGE_SVG);
    if (u.pathname === '/favicon.png') return send(200, 'image/png', '');
    if (u.pathname === '/') return send(200, 'text/html', PAGE);
    return send(404, 'text/html', '<h1>Not found</h1>');
  });
}
