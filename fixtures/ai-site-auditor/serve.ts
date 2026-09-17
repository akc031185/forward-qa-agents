// npm run fixture:audit-sites  →  three fabricated sites to audit locally
import { createSpaSite, createSsrSite, createVibecodedSite } from './sites.js';
const spa = createSpaSite().listen(4801, '127.0.0.1');
const ssr = createSsrSite().listen(4802, '127.0.0.1');
const vibe = createVibecodedSite().listen(4803, '127.0.0.1');
console.log([
  'AI-builder SPA     http://127.0.0.1:4801/   invisible to AI crawlers, leaked key, soft 404',
  'Server-rendered    http://127.0.0.1:4802/   the way it should be done',
  'Vibecoded          http://127.0.0.1:4803/   indexable, but wearing every design tell',
  'Ctrl+C to stop',
].join('\n'));
process.on('SIGINT', () => {
  for (const s of [spa, ssr, vibe]) { s.closeAllConnections(); s.close(); }
  process.exit(0);
});
