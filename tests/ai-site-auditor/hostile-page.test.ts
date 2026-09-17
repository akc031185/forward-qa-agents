// A hostile page can open a blocking alert()/confirm()/prompt() before the DOM is even ready.
// This passes with or without collect.ts's explicit autoDismissDialogs — Playwright's Chromium
// already auto-dismisses an unhandled dialog rather than hanging — so it is not a regression test
// for a proven bug. It is a pin: it documents the behaviour this repo depends on (a dialog bomb
// must never stall a crawl) and will catch it if a future engine, or a future Playwright default,
// stops being as forgiving. See the comment on autoDismissDialogs in collect.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { collect } from '../../src/agents/ai-site-auditor/collect.js';

function createDialogBombSite(): http.Server {
  return http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nAllow: /\n'); }
    res.writeHead(200, { 'content-type': 'text/html' });
    // synchronous dialogs before the page has finished parsing — as hostile as this gets
    res.end('<!doctype html><html><head><title>Hostile</title><script>alert("boo");confirm("also boo");</script></head><body><h1>Still here</h1></body></html>');
  });
}

test('a page that opens blocking dialogs on load is still audited, never hangs', { timeout: 30_000 }, async (t) => {
  let chromiumOk = true;
  try { const { chromium } = await import('playwright'); await (await chromium.launch()).close(); } catch { chromiumOk = false; }
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }

  const server = createDialogBombSite();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  try {
    const facts = await collect({ startUrl: url, maxPages: 1, timeoutMs: 8000, headless: true });
    const home = facts.pages[0]!;
    assert.equal(home.status, 200);
    assert.ok(home.rendered, 'the page rendered instead of hanging on the dialog');
    assert.equal(home.rendered!.h1[0], 'Still here');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(r => server.close(() => r()));
  }
});
