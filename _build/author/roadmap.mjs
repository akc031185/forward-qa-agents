// Renders The SDET Roadmap site from roadmap-data.mjs into a static folder on the shared stylesheet.
// Usage: node _build/author/roadmap.mjs [outDir]   (default ../sdet-roadmap)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { draw } from './diagrams.mjs';
import { SOURCES, SIGNALS, RULES, TRACKS } from './roadmap-data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.resolve(process.argv[2] ?? path.join(REPO, '..', 'sdet-roadmap'));
const { T, box, pill, diamond, arrow, lbl, svg } = draw;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const bullets = (xs, cls = '') => {
  if (xs.length > 6) throw new Error(`more than six bullets: ${xs[0]}`);
  return `<ul class="bul${cls ? ' ' + cls : ''}">${xs.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`;
};

// ───────────────────────────────────────────── diagrams
/** Snake map of six stages with a gate after each. */
function trackMap(track) {
  const pos = (i) => i < 3 ? { x: 20 + i * 250, y: 40 } : { x: 520 - (i - 3) * 250, y: 210 };
  const parts = [];
  track.stages.forEach((s, i) => {
    const { x, y } = pos(i);
    parts.push(box(x, y, 200, 72, `${s.n} · ${s.map ?? s.title}`, { rx: 16, fs: 12.5, sub: s.time, fill: i % 2 ? '#fff' : 'var(--tint)', rot: i % 2 ? 1 : -1 }));
    const top = s.gates[0][0];
    parts.push(lbl(x + 100, y + 96, `gate: ${/^[A-Z][a-z]/.test(top) ? top[0].toLowerCase() + top.slice(1) : top}${s.gates.length > 1 ? ` +${s.gates.length - 1} more` : ''}`, { fs: 11 }));
    if (i < 5) {
      if (i === 2) {
        parts.push(arrow(`M${x + 202} ${y + 36} Q${x + 228} ${y + 36} ${x + 228} ${y + 110} Q${x + 228} ${y + 206} ${x + 204} ${y + 206}`));
        parts.push(diamond(x + 228, y + 120, 26, 26, ''));
      } else if (i < 2) {
        parts.push(arrow(`M${x + 202} ${y + 36} L${x + 246} ${y + 36}`));
        parts.push(diamond(x + 224, y + 36, 26, 26, ''));
      } else {
        parts.push(arrow(`M${x - 2} ${y + 36} L${x - 46} ${y + 36}`));
        parts.push(diamond(x - 24, y + 36, 26, 26, ''));
      }
    }
  });
  parts.push(lbl(380, 340, 'each diamond is an exit gate: the stage ends when its numbers exist'));
  return svg(760, 356, `${track.title}: six stages, each ending in a measurable gate`, parts.join(''));
}

const anatomy = svg(760, 190, 'Anatomy of a stage: goal, steps, deliverable, then a gate of measurable targets that must pass before the next stage', [
  box(16, 50, 130, 64, 'Goal', { sub: 'one sentence' }),
  arrow('M148 82 L178 82'),
  box(182, 50, 150, 64, 'Steps', { sub: 'six at most' }),
  arrow('M334 82 L364 82'),
  box(368, 50, 150, 64, 'Deliverable', { sub: 'a file you can show', fill: 'var(--tint)' }),
  arrow('M520 82 L556 82'),
  diamond(604, 82, 96, 76, 'gate', 'passes?'),
  arrow('M652 82 L744 82'), lbl(700, 72, 'next stage'),
  arrow('M604 122 L604 160 L260 160 L260 118', { dash: true, stroke: 'var(--ink-soft)' }), lbl(430, 178, 'no: repeat the steps, not the gate'),
  lbl(604, 30, 'metric · target · how to measure'),
].join(''));

const evalLayers = svg(760, 250, 'Three layers of AI evaluation: cheap deterministic code checks first, an LLM judge for semantics, and humans for disagreements, with humans calibrating the judge', [
  box(20, 40, 210, 80, 'Code evaluators', { sub: 'schema · tool · args · refusal', fill: '#DDF6EF', stroke: '#2EC4A0', color: '#0E7D69' }),
  lbl(125, 140, 'milliseconds, free, every case'),
  arrow('M232 80 L270 80'),
  box(274, 40, 210, 80, 'LLM-as-judge', { sub: 'rubric: correct · grounded · relevant', fill: 'var(--tint)' }),
  lbl(379, 140, 'seconds, model cost'),
  arrow('M486 80 L524 80'),
  box(528, 40, 210, 80, 'Human review', { sub: 'disagreements and samples', fill: '#FFF3D9', stroke: '#FFB020', color: '#9E6800' }),
  lbl(633, 140, 'slowest, the ground truth'),
  arrow('M633 150 Q633 200 380 200 Q379 200 379 126', { dash: true }),
  lbl(506, 222, 'calibration: Cohen\'s κ ≥ 0.6 before the judge is trusted'),
].join(''));

const parallelRun = svg(760, 230, 'Converting module by module: the Selenium suite shrinks while the Playwright suite grows, both run on the same build, and a test is retired only after 10 matching runs', (() => {
  const mods = ['login', 'search', 'cart', 'checkout', 'account'];
  let out = T(20, 30, 'Selenium', { a: 'start', fs: 13, fw: 800 }) + T(20, 150, 'Playwright', { a: 'start', fs: 13, fw: 800 });
  mods.forEach((m, i) => {
    const x = 120 + i * 124; const done = i < 3;
    out += box(x, 44, 110, 40, m, { rx: 12, fs: 12, fill: done ? '#f3efe8' : '#fff', stroke: done ? 'var(--ink-soft)' : 'var(--ac)', color: done ? 'var(--ink-soft)' : 'var(--deep)', sw: done ? 2 : 3 });
    if (done) out += `<path d="M${x + 8} 64 L${x + 102} 64" stroke="var(--ink-soft)" stroke-width="2"/>`;
    out += box(x, 164, 110, 40, m, { rx: 12, fs: 12, fill: done ? 'var(--tint)' : '#fff', stroke: done ? 'var(--ac)' : 'var(--line)', color: done ? 'var(--deep)' : 'var(--ink-soft)', sw: done ? 3 : 2 });
    if (done) out += diamond(x + 55, 124, 30, 30, '=');
    else out += lbl(x + 55, 128, 'not yet', { fs: 10.5 });
  });
  out += lbl(120 + 1.5 * 124 + 55, 222, '= verdicts matched on 10 runs, 3 seeded bugs caught → retire the Selenium test');
  return out;
})());

const twoTracks = svg(760, 250, 'Two tracks side by side, six stages each, with the shared Playwright foundation marked', (() => {
  let out = '';
  TRACKS.forEach((t, row) => {
    const y = 40 + row * 110;
    out += T(20, y + 30, row === 0 ? 'Track 1' : 'Track 2', { a: 'start', fs: 12, fw: 800 });
    out += T(20, y + 48, t.short, { a: 'start', fs: 11, fw: 700, fill: 'var(--ink-soft)' });
    t.stages.forEach((s, i) => {
      const x = 180 + i * 96;
      out += `<rect x="${x}" y="${y + 10}" width="84" height="50" rx="12" fill="${row === 0 ? '#FFE8F1' : '#EFE8FE'}" stroke="${row === 0 ? '#FF7BAC' : '#9B6BF2'}" stroke-width="2.5"/>`;
      out += T(x + 42, y + 32, String(s.n), { fs: 15, fw: 800, fill: row === 0 ? '#C43A6F' : '#6C3BC7' });
      out += T(x + 42, y + 50, s.time.replace(', by estate size', ''), { fs: 9.5, fw: 700, fill: 'var(--ink-soft)' });
      if (i < 5) out += `<path d="M${x + 86} ${y + 35} h8" stroke="var(--ink-soft)" stroke-width="2"/>`;
    });
  });
  out += `<path class="hand" d="M468 150 Q430 120 300 100" stroke="var(--ink-soft)" stroke-width="2.5" stroke-dasharray="1 7" fill="none"/>`;
  out += lbl(420, 238, 'new to Playwright? do Track 2 stages 0–2 before Track 1 stage 1', { fs: 11.5 });
  return out;
})());

// ───────────────────────────────────────────── page chrome
const NAV = [
  ['Roadmap', 'index.html'],
  ...TRACKS.map(t => [t.short, t.file]),
  ['SDET Architect', 'https://akc031185.github.io/sdet-architect/'],
  ['FDT', 'https://akc031185.github.io/forward-deployed-tester/'],
];
const head = (title, extra = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="assets/site.css">
<style>
.fig{margin:18px 0 26px;background:var(--card);border-radius:var(--r-lg);box-shadow:var(--shadow-1);padding:22px 20px 14px;text-align:center}
.fig svg{width:100%;max-width:760px;height:auto;display:inline-block}.fig svg text{font-family:var(--font)}.fig svg .hand{stroke-linecap:round;stroke-linejoin:round;fill:none}
.fig figcaption{margin-top:8px;color:var(--ink-soft);font-weight:700;font-size:.85rem}
.guide-hero{padding:44px 0 6px}.guide-hero h1.display{margin:16px 0 14px;max-width:22ch}
.stage{background:var(--card);border-radius:var(--r-lg);box-shadow:var(--shadow-1);padding:22px 24px 18px;margin:22px 0;scroll-margin-top:80px}
.stage__head{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.stage__n{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:16px;background:var(--ac);color:#FFFDF8;font-weight:800;font-size:1.3rem;transform:rotate(-3deg)}
.stage__title{font-weight:800;font-size:1.25rem;letter-spacing:-.01em;margin:0}
.stage__time{font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:var(--tint);color:var(--deep);padding:4px 12px;border-radius:999px}
.stage__progress{margin-left:auto;font-size:.8rem;font-weight:800;color:var(--ink-soft)}
.stage h3{font-size:.78rem;letter-spacing:.09em;text-transform:uppercase;color:var(--deep);margin:16px 0 4px}
.stage .goal{font-weight:700;color:var(--ink);margin:10px 0 0;max-width:72ch}
.deliv{background:var(--tint);border-radius:12px;padding:10px 14px;font-weight:600;color:var(--ink-soft)}
.gates{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:6px}
.gates th{text-align:left;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);padding:6px 8px;border-bottom:2px solid var(--line)}
.gates td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink-soft);font-weight:600}
.gates td:nth-child(2){color:var(--ink);font-weight:800}.gates td code{font-size:.8em;background:#FBF5EA;border-radius:6px;padding:1px 5px;overflow-wrap:anywhere}
.gates input{width:18px;height:18px;accent-color:var(--ac);cursor:pointer}
.gates tr.done td{opacity:.55}.gates tr.done td:nth-child(2){text-decoration:line-through}
.tablewrap{overflow-x:auto}
.agentnote{border-left:5px solid var(--ac);background:color-mix(in srgb,var(--ac) 8%,transparent);border-radius:0 10px 10px 0;padding:8px 12px;margin-top:12px;font-weight:600;color:var(--ink-soft);font-size:.92rem}
.trackbar{position:sticky;top:var(--mast,64px);z-index:5;background:var(--bg);padding:10px 0 8px;display:flex;align-items:center;gap:12px}
.trackbar__bar{flex:1;height:10px;background:var(--line);border-radius:999px;overflow:hidden}.trackbar__bar i{display:block;height:100%;width:0;background:var(--ac);transition:width .25s}
.trackbar__txt{font-weight:800;font-size:.85rem;white-space:nowrap}
.trackbar button{font:inherit;font-size:.78rem;font-weight:800;border:0;background:var(--tint);color:var(--deep);padding:6px 12px;border-radius:999px;cursor:pointer}
.stagelist{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:6px}.stagelist a{text-decoration:none;font-weight:700;color:var(--deep)}
.signal{background:var(--card);border-radius:var(--r-md);box-shadow:var(--shadow-1);padding:18px 22px;margin:14px 0}
.signal h3{font-weight:800;font-size:1.05rem;margin:0 0 4px}
.srcs{font-size:.82rem;color:var(--ink-soft);font-weight:600;margin-top:6px}.srcs a{color:var(--deep)}
.sources li{margin:4px 0;color:var(--ink-soft);font-weight:600;font-size:.9rem}
.masthead__nav{flex-wrap:wrap}.masthead__nav a{white-space:nowrap}
@media (max-width:640px){
  .masthead__nav{flex-wrap:nowrap;overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch;padding-bottom:4px}
  .gates thead{display:none}
  .gates tr{display:grid;grid-template-columns:30px 1fr;column-gap:6px;padding:8px 0;border-bottom:1px solid var(--line)}
  .gates td{border:0;padding:2px 0}
  .gates td:first-child{grid-row:span 3}
  .gates td:nth-child(3)::before{content:"Target: ";color:var(--ink-soft);font-weight:700}
  .gates td:nth-child(4)::before{content:"Measure: ";font-weight:700}
  .stage{padding:18px 16px}.stage__progress{margin-left:0}
}
${extra}
</style></head>`;
const mast = (active) => `<header class="masthead"><div class="wrap masthead__inner">
  <div class="masthead__title"><b>◑</b> The SDET Roadmap</div>
  <nav class="masthead__nav">${NAV.map(([l, h]) => `<a href="${h}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ''}${h === active ? ' aria-current="page" style="background:var(--ink);color:#FFF8EE"' : ''}>${esc(l)}</a>`).join('')}</nav>
</div></header>`;
const src = (ids) => `<p class="srcs">Sources: ${ids.map(id => `<a href="${SOURCES[id].url}" target="_blank" rel="noopener">${esc(SOURCES[id].label)}</a>`).join(' · ')}</p>`;
const fig = (heading, s, caption) => `<figure class="fig"><div class="fig__head" style="display:inline-block;font-weight:800;font-size:.74rem;letter-spacing:.09em;text-transform:uppercase;background:var(--tint);color:var(--deep);padding:6px 14px;border-radius:999px;margin-bottom:12px">${esc(heading)}</div>${s}${caption ? `<figcaption>${rich(caption)}</figcaption>` : ''}</figure>`;
const footer = `<footer class="footer"><div class="wrap">The SDET Roadmap · measurable steps for agentic AI testing and Selenium-to-Playwright migration · generated from <a class="doclink" href="https://github.com/akc031185/forward-qa-agents" target="_blank" rel="noopener">forward-qa-agents</a>. Checklist progress stays in your browser.</div></footer>`;

// ───────────────────────────────────────────── pages
function indexPage() {
  const trackCards = TRACKS.map((t, i) => `<a class="path s${t.accent}" href="${t.file}">
      <span class="rcard__no">Track ${i + 1}</span><h3 class="display">${esc(t.title)}</h3>
      <p style="flex:0 0 auto">${rich(t.card)}</p>
      <ol class="stagelist" style="flex:1">${t.stages.map(s => `<li>${s.n} · ${esc(s.title)} <span class="muted small">(${esc(s.time)})</span></li>`).join('')}</ol>
      <span class="path__go">Open the track →</span></a>`).join('');
  return `${head('The SDET Roadmap — Field Guide')}
<body>${mast('index.html')}
<main class="wrap wrap--article"><article class="plate">
  <section class="s6"><div class="guide-hero">
    <span class="eyebrow">A roadmap · with a number at every step</span>
    <h1 class="display">Two skills SDET openings now ask for, as a roadmap you can measure.</h1>
    ${bullets([
      '**Track 1:** test AI agents and LLM features: golden datasets, evals in CI, trajectories, safety, cost.',
      '**Track 2:** convert a Selenium framework to Playwright without losing coverage.',
      'Six stages per track. Each ends in a gate of targets you measure yourself, with the command to do it.',
    ], 'lead')}
  </div></section>

  <section class="s6"><h2 class="display">What the postings ask for</h2>
    ${SIGNALS.map(sg => `<div class="signal"><h3>${esc(sg.title)}</h3>${bullets(sg.points)}${src(sg.sources)}</div>`).join('')}
  </section>

  <section class="s2"><h2 class="display">How every stage works</h2>
    ${fig('Anatomy of a stage', anatomy, 'The gate is the point: a stage is done when its numbers exist, not when the steps feel finished.')}
    ${bullets(RULES)}
  </section>

  <section class="s5"><h2 class="display">The two tracks</h2>
    ${fig('Twelve stages, two tracks', twoTracks, 'Stage numbers and typical time boxes. The time boxes are guidance, not targets.')}
    <div class="paths">${trackCards}</div>
  </section>

  <section class="s8"><h2 class="display">Where our agents help</h2>
    ${bullets([
      '**The SDET Architect** does the mechanical part of Track 2: inventory and baseline in stage 0, architecture in stage 2, first-pass conversion and MIGRATION.md in stage 3.',
      '**The Forward Deployed Tester** process defines the golden set, eval cube and cost ledger that Track 1 stages 2–5 practise.',
      'Both are free and run locally; neither replaces the gates. The gates are how you prove the work.',
    ])}
    ${src(['sdetArchitect', 'fdtProcess'])}
  </section>
</article></main>${footer}</body></html>`;
}

function trackPage(track, index) {
  const stages = track.stages.map(s => {
    const rows = s.gates.map((g, gi) => `<tr data-key="${track.id}:${s.n}:${gi}"><td><input type="checkbox" aria-label="Mark ${esc(g[0])} done"></td><td>${rich(g[0])}</td><td>${rich(g[1])}</td><td>${rich(g[2])}</td></tr>`).join('');
    return `<section class="stage" id="stage-${s.n}">
      <div class="stage__head"><span class="stage__n">${s.n}</span><h2 class="stage__title">${esc(s.title)}</h2><span class="stage__time">${esc(s.time)}</span><span class="stage__progress" data-stage="${s.n}">0 / ${s.gates.length}</span></div>
      <p class="goal">${rich(s.goal)}</p>
      <h3>Steps</h3>${bullets(s.steps)}
      <h3>Deliverable</h3><div class="deliv">${rich(s.deliverable)}</div>
      <h3>Exit gate</h3>
      <div class="tablewrap"><table class="gates"><thead><tr><th></th><th>Metric</th><th>Target</th><th>How to measure</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${s.agent ? `<div class="agentnote">${rich(s.agent)}</div>` : ''}
      ${s.n === 3 && track.id === 'selenium-to-playwright' ? fig('Old and new, side by side', parallelRun, 'Stage 3. A Selenium test is retired only when its Playwright twin has earned it.') : ''}
      ${s.n === 3 && track.id === 'agentic-ai-testing' ? fig('Three layers of evaluation', evalLayers, 'Stage 3. Cheap checks filter first; the judge is trusted only after calibration against humans.') : ''}
    </section>`;
  }).join('');
  const trackSources = track.id === 'agentic-ai-testing' ? ['rbc', 'apple', 'pwAgents', 'langfuse', 'confident', 'kappa', 'owasp', 'fdtProcess'] : ['currents', 'pwBest', 'sdetArchitect'];
  const other = TRACKS[1 - index];
  return `${head(`${track.title} — The SDET Roadmap`)}
<body class="s${track.accent}">${mast(track.file)}
<main class="wrap wrap--article"><article class="plate">
  <div class="guide-hero">
    <span class="eyebrow">Track ${index + 1} · ${esc(track.short)}</span>
    <h1 class="display">${esc(track.title)}</h1>
    ${bullets(track.lead, 'lead')}
  </div>
  ${fig('The track at a glance', trackMap(track), `Outcome: ${track.outcome}`)}
  <div class="trackbar"><span class="trackbar__txt" id="trackTxt">0 of ${track.stages.reduce((n, s) => n + s.gates.length, 0)} gates</span><div class="trackbar__bar"><i id="trackBar"></i></div><button type="button" id="resetBtn">Reset</button></div>
  ${stages}
  <section><h2 class="display">Sources</h2><ul class="sources">${trackSources.map(id => `<li><a class="doclink" href="${SOURCES[id].url}" target="_blank" rel="noopener">${esc(SOURCES[id].label)}</a></li>`).join('')}</ul></section>
  <nav class="platenav"><a href="index.html">← Roadmap</a><a href="${other.file}">${esc(other.short)} →</a></nav>
</article></main>${footer}
<script>
(function(){
  var KEY = 'sdet-roadmap:${track.id}';
  var mast = document.querySelector('.masthead'); if (mast) document.documentElement.style.setProperty('--mast', mast.offsetHeight + 'px');
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { state = {}; }
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr[data-key]'));
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function paint(){
    var done = 0;
    rows.forEach(function(r){ var on = !!state[r.dataset.key]; r.querySelector('input').checked = on; r.classList.toggle('done', on); if (on) done++; });
    document.getElementById('trackTxt').textContent = done + ' of ' + rows.length + ' gates';
    document.getElementById('trackBar').style.width = Math.round(done * 100 / rows.length) + '%';
    document.querySelectorAll('[data-stage]').forEach(function(el){
      var n = el.getAttribute('data-stage');
      var mine = rows.filter(function(r){ return r.dataset.key.split(':')[1] === n; });
      var d = mine.filter(function(r){ return state[r.dataset.key]; }).length;
      el.textContent = d === mine.length ? 'gate passed ✓' : d + ' / ' + mine.length;
    });
  }
  rows.forEach(function(r){ r.querySelector('input').addEventListener('change', function(e){ state[r.dataset.key] = e.target.checked; save(); paint(); }); });
  document.getElementById('resetBtn').addEventListener('click', function(){ state = {}; save(); paint(); });
  paint();
})();
</script>
</body></html>`;
}

fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(REPO, 'assets', 'site.css'), path.join(OUT, 'assets', 'site.css'));
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());
TRACKS.forEach((t, i) => fs.writeFileSync(path.join(OUT, t.file), trackPage(t, i)));
fs.writeFileSync(path.join(OUT, 'README.md'), `# The SDET Roadmap — Field Guide

Two tracks with measurable exit gates: agentic AI testing, and Selenium-to-Playwright migration.

**Generated. Do not edit here.** Source: \`_build/author/roadmap-data.mjs\` and \`_build/author/roadmap.mjs\` in
[akc031185/forward-qa-agents](https://github.com/akc031185/forward-qa-agents); run \`npm run catalog:roadmap\`.
`);
console.log(`Built ${OUT}: index.html, ${TRACKS.map(t => t.file).join(', ')}, assets/site.css`);
