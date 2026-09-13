// Hand-drawn-style SVG diagrams for plates 44 and 45, in the site.css house style.
// Colours come from the section variables (--ac, --deep, --tint) so each plate keeps its hue.

const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a ?? 'middle'}" font-size="${o.fs ?? 13}" font-weight="${o.fw ?? 700}" fill="${o.fill ?? 'var(--deep)'}">${s}</text>`;
/** Rounded box with a title and optional sub line. */
function box(x, y, w, h, title, o = {}) {
  const rot = o.rot ?? 0;
  const fill = o.fill ?? '#fff';
  const stroke = o.stroke ?? 'var(--ac)';
  const sub = o.sub ? T(x + w / 2, y + h / 2 + 16, o.sub, { fs: 11, fw: 600, fill: 'var(--ink-soft)' }) : '';
  const ty = o.sub ? y + h / 2 - 2 : y + h / 2 + 5;
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 16}" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw ?? 3.5}"/>${T(x + w / 2, ty, title, { fs: o.fs ?? 13.5, fw: 800, fill: o.color ?? 'var(--deep)' })}${sub}</g>`;
}
/** Pill (fully rounded). */
const pill = (x, y, w, title, o = {}) => box(x, y, w, 30, title, { rx: 15, fill: o.fill ?? 'var(--tint)', ...o });
/** Diamond decision. */
function diamond(cx, cy, w, h, l1, l2) {
  return `<path d="M${cx} ${cy - h / 2} L${cx + w / 2} ${cy} L${cx} ${cy + h / 2} L${cx - w / 2} ${cy} Z" fill="var(--tint)" stroke="var(--deep)" stroke-width="3"/>${T(cx, cy - (l2 ? 3 : -5), l1, { fs: 12 })}${l2 ? T(cx, cy + 13, l2, { fs: 12 }) : ''}`;
}
const arrow = (d, o = {}) => `<path class="hand" d="${d}" stroke="${o.stroke ?? 'var(--deep)'}" stroke-width="${o.sw ?? 3.5}" ${o.dash ? 'stroke-dasharray="1 8"' : ''} marker-end="url(#${o.m ?? 'ah'})"/>`;
const defs = (id = 'ah', fill = 'var(--deep)') => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${fill}"/></marker></defs>`;
const lbl = (x, y, s, o = {}) => T(x, y, s, { fs: 11.5, fw: 700, fill: 'var(--ink-soft)', ...o });
/** DB cylinder. */
function db(x, y, w, h, title, rows) {
  const ry = 10;
  return `<g><path d="M${x} ${y + ry} v${h - 2 * ry} a${w / 2} ${ry} 0 0 0 ${w} 0 v-${h - 2 * ry}" fill="#fff" stroke="var(--deep)" stroke-width="3"/><ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="var(--tint)" stroke="var(--deep)" stroke-width="3"/>${T(x + w / 2, y + 36, title, { fs: 12.5, fw: 800 })}${rows.map((r, i) => T(x + w / 2, y + 54 + i * 15, r, { fs: 11, fw: 700, fill: 'var(--ink-soft)' })).join('')}</g>`;
}
const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${defs()}${body}</svg>`;

// ───────────────────────────────────────────── plate 44

export const fdtPipeline = svg(760, 300, 'Pipeline of the Forward Deployed Tester: a target URL goes through reconnaissance, findings, provisioning and report; rows land in SQLite and files in the workspace', [
  pill(20, 118, 118, 'target_url', { rot: -2 }),
  arrow('M140 133 L172 133'),
  box(176, 100, 118, 66, '1 Recon', { sub: 'Chromium crawl', rot: -1.5 }),
  arrow('M296 133 L322 133'),
  box(326, 100, 118, 66, '2 Findings', { sub: 'fixed severities', rot: 1.5 }),
  arrow('M446 133 L472 133'),
  box(476, 100, 118, 66, '3 Provision', { sub: 'files as strings', rot: -1.5 }),
  arrow('M596 133 L622 133'),
  box(626, 100, 118, 66, '4 Report', { sub: 'md + json', rot: 1.5 }),
  // outputs down
  arrow('M385 168 L385 205', { dash: true }),
  arrow('M535 168 L535 205', { dash: true }),
  arrow('M685 168 L685 205', { dash: true }),
  db(300, 208, 170, 84, 'SQLite forward-qa.db', ['runs · findings · artifacts']),
  box(490, 212, 96, 60, 'infra/', { sub: 'pages, tests, CI', fill: 'var(--tint)' }),
  box(636, 212, 104, 60, 'report.md', { sub: '+ report.json', fill: 'var(--tint)' }),
  // model note
  box(596, 20, 156, 44, 'local model?', { sub: 'only rewrites the summary', fs: 12, stroke: 'var(--ink-soft)', sw: 2.5, rot: 2 }),
  arrow('M685 66 L685 96', { dash: true, stroke: 'var(--ink-soft)' }),
  lbl(235, 40, 'no model needed for any of this →', { a: 'start' }),
  arrow('M235 46 L235 96', { dash: true, stroke: 'var(--ink-soft)' }),
].join(''));

export const fdtCrawlLoop = svg(760, 430, 'Flowchart of the crawl loop: pop the queue, check the page budget, visit, branch on status, harvest and enqueue links, repeat', [
  pill(30, 24, 150, 'queue = [start]', { rot: -1 }),
  arrow('M105 55 L105 84'),
  box(40, 88, 130, 44, 'pop next URL', { rx: 12 }),
  arrow('M170 110 L212 110'),
  diamond(290, 110, 150, 70, 'pages ≥', 'max_pages?'),
  arrow('M365 110 L420 110'),
  lbl(392, 100, 'no'),
  box(424, 88, 120, 44, 'visit(url)', { rx: 12, fill: 'var(--tint)' }),
  arrow('M290 145 L290 178'),
  lbl(310, 166, 'yes'),
  pill(220, 182, 140, 'skipped.push', { fill: '#fff', stroke: 'var(--ink-soft)' }),
  arrow('M484 132 L484 168'),
  diamond(484, 205, 150, 70, 'status ≥ 400', 'or error?'),
  arrow('M559 205 L612 205'),
  lbl(586, 195, 'yes'),
  box(616, 183, 124, 44, 'brokenLinks', { rx: 12, sub: '', fill: '#fff' }),
  arrow('M484 240 L484 274'),
  lbl(505, 262, 'no'),
  box(404, 278, 160, 46, 'harvest in page', { rx: 12, sub: '≤ 60 elements', fill: 'var(--tint)' }),
  arrow('M484 324 L484 352'),
  box(384, 356, 200, 46, 'deriveLocator × N', { rx: 12, sub: 'role › label › … › css' }),
  arrow('M384 379 L120 379 L120 134', { dash: true }),
  lbl(250, 370, 'enqueue new same-origin links'),
  arrow('M678 227 L678 400 L120 400 L120 134', { dash: true, stroke: 'var(--ink-soft)' }),
  lbl(678, 250, 'does not', { fill: 'var(--ink-soft)' }),
  lbl(678, 264, 'count', { fill: 'var(--ink-soft)' }),
  arrow('M290 212 L290 260', { dash: true, stroke: 'var(--ink-soft)' }),
  pill(210, 262, 160, 'loop until empty', { fill: '#fff', stroke: 'var(--ink-soft)' }),
].join(''));

export const fdtLocatorLadder = svg(760, 400, 'Decision ladder for picking a Playwright locator: role and name first, then label, placeholder, text, test id, and only then CSS forms', (() => {
  const rungs = [
    ['role + accessible name', "getByRole(role, { name, exact })", 'high', 'demo: 8 of 9'],
    ['label element text', "getByLabel(text, { exact })", 'high', ''],
    ['placeholder', "getByPlaceholder(text)", 'high', ''],
    ['visible text (a, button, span…)', "getByText(text, { exact })", 'medium', ''],
    ['data-testid / data-test / data-cy', "getByTestId(id)", 'medium', ''],
    ['role only, no name', "getByRole(role)", 'low', 'last resort'],
    ['id, not generated-looking', "locator('#id')", 'medium', ''],
    ['name attribute', "locator('tag[name=\"x\"]')", 'medium', 'demo: firstInput'],
    ['stable classes, else tag', "locator('tag.a.b') / locator('tag')", 'low', ''],
  ];
  const col = { high: '#2EC4A0', medium: '#FFB020', low: '#FF6B6B' };
  const rows = rungs.map(([q, code, conf, note], i) => {
    const y = 26 + i * 40;
    return `${box(20, y, 250, 30, q, { rx: 15, fs: 12.5, fill: i % 2 ? '#fff' : 'var(--tint)' })}${arrow(`M272 ${y + 15} L300 ${y + 15}`, { sw: 2.5 })}<text x="306" y="${y + 20}" font-size="12" font-weight="700" fill="var(--ink)" font-family="ui-monospace,Menlo,monospace">${code.replace(/</g, '&lt;').replace(/"/g, '&quot;')}</text><rect x="574" y="${y + 4}" width="66" height="22" rx="11" fill="${col[conf]}"/>${T(607, y + 19, conf, { fs: 11, fill: '#fff' })}${note ? lbl(648, y + 19, note, { a: 'start', fs: 10.5 }) : ''}`;
  }).join('');
  const down = rungs.slice(0, -1).map((_, i) => `<path class="hand" d="M40 ${58 + i * 40} v6" stroke="var(--ink-soft)" stroke-width="2.5"/>`).join('');
  return rows + down + lbl(380, 392, 'first rung that matches wins · the confidence is written into the page-object comment');
})());

export const fdtSeverityMap = svg(760, 250, 'Grid mapping finding categories to their fixed severity', (() => {
  const cols = [['critical', '#C93F3F'], ['high', '#FF6B6B'], ['medium', '#FFB020'], ['low', '#3FB4E8'], ['info', '#9B6BF2']];
  const chips = {
    critical: ['no page rendered'],
    high: ['navigation failed', '5xx link', 'load > 9 s'],
    medium: ['4xx link', 'console errors', 'load > 3 s', 'unlabeled form controls', '5xx sub-request'],
    low: ['image without alt', 'no <h1>', 'no landmark', 'unlabeled control, no form', '4xx sub-request'],
    info: ['mostly untargetable page'],
  };
  let out = '';
  cols.forEach(([name, color], i) => {
    const x = 16 + i * 148;
    out += `<rect x="${x}" y="14" width="136" height="28" rx="14" fill="${color}"/>${T(x + 68, 33, name, { fs: 12.5, fill: '#fff' })}`;
    chips[name].forEach((c, j) => { out += `<rect x="${x}" y="${52 + j * 36}" width="136" height="28" rx="10" fill="#fff" stroke="${color}" stroke-width="2.5"/>${T(x + 68, 70 + j * 36, c.replace(/</g, '&lt;'), { fs: 10.5, fw: 700, fill: 'var(--ink)' })}`; });
  });
  return out;
})());

// ───────────────────────────────────────────── plate 45

export const sdetPipeline = svg(760, 330, 'Pipeline of the SDET Architect: a legacy estate is inventoried, parsed by dialect into one model, locators standardised, pages planned, code generated, and a migration report written', [
  pill(16, 130, 110, 'estate dir', { rot: -2 }),
  arrow('M128 145 L156 145'),
  box(160, 112, 104, 66, 'a Inventory', { sub: 'classify by content', rot: -1.5 }),
  arrow('M266 145 L292 145'),
  box(296, 112, 104, 66, 'b Parse', { sub: 'regex + lines', rot: 1.5 }),
  arrow('M402 145 L428 145'),
  box(432, 112, 104, 66, 'c Standardise', { sub: 'locators + plan', rot: -1.5 }),
  arrow('M538 145 L564 145'),
  box(568, 112, 104, 66, 'd Generate', { sub: 'pure strings', rot: 1.5 }),
  arrow('M672 145 L698 145'),
  pill(700, 130, 56, 'write', { rot: 2 }),
  // dialects feeding parse
  ...['java', 'python', 'c#', 'js / cypress', '.feature', 'postman', 'markdown'].map((d, i) => `${pill(16 + i * 106, 24, 96, d, { fill: '#fff', stroke: 'var(--ink-soft)', sw: 2, fs: 12 })}`),
  arrow('M348 56 L348 108', { dash: true, stroke: 'var(--ink-soft)' }),
  lbl(362, 84, 'seven parsers, one engine', { a: 'start', fill: 'var(--ink-soft)' }),
  // model in the middle
  box(232, 210, 300, 46, 'TestSuite { tests, pageObjects, hooks, locators }', { rx: 12, fs: 12, fill: 'var(--tint)', sub: 'Step { kind, locator, value, assertion, raw, line }' }),
  arrow('M348 180 L348 206', { dash: true }),
  arrow('M484 206 L484 180', { dash: true }),
  // outputs
  db(560, 220, 190, 100, 'SQLite', ['findings ×5 categories', 'artifacts, one per file']),
  arrow('M620 180 L640 216', { dash: true }),
  box(16, 214, 190, 60, 'playwright/', { sub: 'pages · fixtures · specs · CI', fill: 'var(--tint)', fs: 12.5 }),
  box(16, 280, 190, 40, 'MIGRATION.md', { fill: '#fff', rx: 12, fs: 12.5 }),
  arrow('M232 233 L210 240', { dash: true }),
].join(''));

export const sdetNormalize = svg(760, 430, 'One Selenium statement passing through normalisation: string literals, By locators, findElement wrappers, scope variables and typed values become tokens, then the token shape is classified into a Step', (() => {
  const mono = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a ?? 'start'}" font-size="${o.fs ?? 12}" font-weight="700" fill="${o.fill ?? 'var(--ink)'}" font-family="ui-monospace,Menlo,monospace">${s.replace(/</g, '&lt;')}</text>`;
  // vertical stages: label box on the left, the token string on the right, a note under it
  const stage = (i, title, code, note) => {
    const y = 66 + i * 58;
    return `${box(16, y, 150, 34, title, { rx: 12, fs: 12, fill: i === 4 ? 'var(--tint)' : '#fff' })}${arrow(`M168 ${y + 17} L190 ${y + 17}`, { sw: 2.5 })}${mono(198, y + 21, code)}${lbl(198, y + 38, note, { a: 'start', fs: 10.5 })}${i < 4 ? `<path class="hand" d="M91 ${y + 36} v14" stroke="var(--ink-soft)" stroke-width="2.5"/>` : ''}`;
  };
  return [
    mono(16, 30, 'Assert.assertEquals(cartBadge.getText(), "1");', { fs: 13.5, fill: 'var(--deep)' }),
    lbl(16, 48, 'CheckoutTest.java:48 · cartBadge was bound two lines earlier by an assignment, which emitted no step', { a: 'start' }),
    stage(0, '1 strings → «S»', 'Assert.assertEquals(cartBadge.getText(), «S0»)', 'strs[0] = "1" — nothing inside a literal can confuse later regexes'),
    stage(1, '2 By(…) → «L»', '(no By(…) on this line)', 'By.id("cart-count") on line 47 became «L0» and bound cartBadge in scope'),
    stage(2, '3 scope vars → «E»', 'Assert.assertEquals(«E0».getText(), «S0»)', 'cartBadge ∈ scope.elements → «E0» carries locator id=cart-count'),
    stage(3, '4 reads → «V»', 'Assert.assertEquals(«V0», «S0»)', 'V0 = { type: text, locator: id cart-count }'),
    stage(4, '5 classify', 'assertEquals( «V0» , «S0» ) → parseAssertion → equals', 'typed value text + literal expected → Step'),
    box(198, 372, 330, 46, 'Step { kind: assert, type: text, expected: "1" }', { rx: 12, fs: 12, fill: 'var(--tint)', sub: 'locator: id cart-count · raw kept · line 48' }),
    arrow('M91 356 L91 395 L194 395', { sw: 2.5 }),
    mono(546, 382, "→ await expect(", { fs: 11.5, fill: 'var(--deep)' }),
    mono(546, 398, "    checkoutPage.cartCount", { fs: 11.5, fill: 'var(--deep)' }),
    mono(546, 414, "  ).toHaveText('1');", { fs: 11.5, fill: 'var(--deep)' }),
    // what else step 5 can decide, as a side column
    lbl(660, 66, 'other outcomes of step 5', { fs: 11 }),
    pill(586, 76, 156, 'assignment → scope', { fill: '#fff', stroke: 'var(--ink-soft)', sw: 2, fs: 11.5 }),
    pill(586, 112, 156, 'lifecycle noise → dropped', { fill: '#fff', stroke: 'var(--ink-soft)', sw: 2, fs: 11.5 }),
    pill(586, 148, 156, 'Thread.sleep → NOTE', { fill: '#fff', stroke: 'var(--ink-soft)', sw: 2, fs: 11.5 }),
    pill(586, 184, 156, 'navigate · click · fill', { fs: 11.5 }),
    pill(586, 220, 156, 'select · press · hover', { fs: 11.5 }),
    pill(586, 256, 156, 'wait · read · call', { fs: 11.5 }),
    pill(586, 292, 156, 'anything else → TODO', { fill: '#FFECE7', stroke: '#FF6B6B', color: '#C93F3F', fs: 11.5 }),
  ].join('');
})());

export const sdetConfidence = svg(760, 400, 'Locator confidence ladder: each Selenium strategy and its Playwright form with the confidence assigned, and the 0.60 review line', (() => {
  const rows = [
    ['id (plain)', "locator('#x')", 0.95],
    ['data-testid / test-like id', "getByTestId('x')", 0.95],
    ['linkText', "getByRole('link', { name })", 0.90],
    ['name', "locator('[name=\"x\"]')", 0.85],
    ['text · //tag[text()=…]', "getByText / getByRole", 0.85],
    ['css (plain) · xpath chain', "locator('a b[c=\"d\"]')", 0.80],
    ['partialLinkText', "getByRole('link', { name: /x/ })", 0.80],
    ['className', "locator('.x')", 0.65],
    ['xpath exact multi-class', "locator('div[class=\"a b\"]')", 0.60],
    ['id looks generated · utility class', "locator('#gwt-uid-12')", 0.50],
    ['xpath positional [1] · tagName', "locator('div:nth-of-type(1)')", 0.50],
    ['xpath, not reducible', "locator('xpath=…')", 0.35],
    ['absolute /html/body/…', "locator('xpath=/html/…')", 0.20],
  ];
  const x0 = 300, w = 330;
  let out = '';
  rows.forEach(([s, e, c], i) => {
    const y = 14 + i * 27;
    const color = c >= 0.8 ? '#2EC4A0' : c >= 0.6 ? '#FFB020' : '#FF6B6B';
    out += T(290, y + 16, s, { a: 'end', fs: 11.5, fw: 800 });
    out += `<rect x="${x0}" y="${y + 4}" width="${w}" height="18" rx="9" fill="var(--tint)"/><rect x="${x0}" y="${y + 4}" width="${w * c}" height="18" rx="9" fill="${color}"/>`;
    out += `<text x="${x0 + 8}" y="${y + 17}" font-size="10.5" font-weight="700" fill="#fff" font-family="ui-monospace,Menlo,monospace">${e.replace(/</g, '&lt;').replace(/"/g, '&quot;')}</text>`;
    out += T(x0 + w + 12, y + 17, c.toFixed(2), { a: 'start', fs: 11.5, fw: 800, fill: 'var(--ink)' });
  });
  const lineX = x0 + w * 0.6;
  out += `<path class="hand" d="M${lineX} 8 V370" stroke="var(--deep)" stroke-width="2.5" stroke-dasharray="2 7"/>` + T(lineX, 386, '0.60 review line: below it → LOW CONFIDENCE comment + locator finding (high under 0.40)', { fs: 11 });
  return out;
})());

export const sdetStatus = svg(760, 230, 'How a test gets its status: count the TODO steps; none means converted, fewer than half means partial, half or more means manual with test.fixme', [
  box(16, 24, 170, 46, 'steps of one test', { rx: 12, sub: 'each emitted or TODO' }),
  arrow('M188 47 L226 47'),
  diamond(300, 47, 140, 62, 'todos', '== 0?'),
  arrow('M370 47 L420 47'), lbl(395, 38, 'yes'),
  box(424, 26, 130, 42, 'converted', { rx: 21, fill: '#DDF6EF', stroke: '#2EC4A0', color: '#0E7D69' }),
  arrow('M300 78 L300 116'), lbl(318, 100, 'no'),
  diamond(300, 150, 150, 62, 'todos × 2', '≥ total?'),
  arrow('M375 150 L420 150'), lbl(398, 141, 'no'),
  box(424, 129, 130, 42, 'partial', { rx: 21, fill: '#FFF3D9', stroke: '#FFB020', color: '#9E6800' }),
  arrow('M300 181 L300 204'), lbl(318, 196, 'yes'),
  box(226, 206, 148, 22, 'manual → test.fixme', { rx: 11, fill: '#FFECE7', stroke: '#FF6B6B', color: '#C93F3F', fs: 11.5, sw: 2.5 }),
  // side: hard wait
  box(590, 26, 156, 42, 'Thread.sleep(2000)', { rx: 12, fs: 12, stroke: 'var(--ink-soft)', sw: 2.5 }),
  arrow('M668 70 L668 104', { sw: 2.5 }),
  box(590, 108, 156, 46, '// NOTE + flakiness', { rx: 12, fs: 12, fill: 'var(--tint)', sub: 'not a TODO, not a step lost' }),
  lbl(668, 186, 'fixture: 4 sleeps removed,'),
  lbl(668, 202, '99 of 108 steps emitted, 9 TODOs'),
].join(''));
