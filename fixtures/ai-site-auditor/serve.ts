// npm run fixture:audit-sites  →  the AI-builder SPA on :4801 and the server-rendered site on :4802
import { createSpaSite, createSsrSite } from './sites.js';
const spa = createSpaSite().listen(4801, '127.0.0.1');
const ssr = createSsrSite().listen(4802, '127.0.0.1');
console.log('AI-builder SPA     http://127.0.0.1:4801/\nServer-rendered    http://127.0.0.1:4802/\nCtrl+C to stop');
process.on('SIGINT', () => { spa.closeAllConnections(); ssr.closeAllConnections(); spa.close(); ssr.close(); process.exit(0); });
