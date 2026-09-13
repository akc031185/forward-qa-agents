#!/usr/bin/env ts-node
/**
 * build-catalog.ts — static generator for the "Field Guide to a Workforce of
 * Software Agents" catalog. Reads structured, plain-English content (one JSON
 * per agent in ./content) + a category map (./categories.json) and renders:
 *   - index.html                (the contents: hero, primer, category rosters)
 *   - agents/<slug>.html         (one rich "specimen plate" per agent)
 * All pages link ./assets/site.css relatively → self-contained offline folder.
 *
 * Audience: technical practitioners (SWE/QA/SDET/PM/TPM/SRE/DevOps) who know AI
 * at a concept level and want the practical, implementation-level reality.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content + category map live beside this script in _build/; the rendered site
// is written to the repo root one level up, so index.html sits next to README.md.
const BUILD = __dirname;
const SITE = path.join(BUILD, '..');
const CONTENT_DIR = path.join(BUILD, 'content');
const OUT_AGENTS = path.join(SITE, 'agents');

// ── Content schema (the fan-out fills these) ──────────────────────────────
interface Example { caption: string; input: string; output: string; }
/** v2 flow step: a plain step mapped to the real function that implements it. */
interface FlowStep { step: string; fn?: string; explain?: string; code?: string; }
/** v2 under-the-hood slide: one embedded mini-deck slide per idea. */
interface HoodSlide { heading: string; whenRuns: string; input: string; output: string; }
/** Optional final carousel slide: shows the agent's output turned into an HTML page. */
interface OutputSample { heading: string; whenRuns: string; input: string; output: string; img: string; imgAlt?: string; caption?: string; }
interface AgentContent {
  slug: string;
  plate: number;                // stable plate number (assigned in categories.json order)
  name: string;                 // friendly name (NOT the filename)
  techName: string;             // original file, shown small
  category: string;             // must match a categories.json id
  oneLiner: string;             // what it does for you, one sentence
  lead: string;                 // 2-3 sentence plain-English summary
  chore: string;                // the tedious human task it removes
  instead: string;              // what you get instead
  whyItMatters?: string;        // the stakes, in human terms
  howItWorks: (string | FlowStep)[];   // v1 strings OR v2 flow steps (with code)
  examples: Example[];          // one or more worked examples
  underHood?: string | HoodSlide[];    // v1 string OR v2 slideable mini-deck
  runbook?: Runbook;            // v3: "Run it & wire it in"
  outputSample?: OutputSample;  // v4: optional "output → HTML page" carousel slide
  status: 'reference' | 'toolkit';
}
/** v3 runbook — beginner-verbose "how to actually run it". */
interface RunStep { label: string; cmd?: string; why: string; firstRun?: string; rerun?: string; }
interface NamedThing { name: string; desc: string; }
interface Runbook {
  runnable: boolean;            // true = you can really run it; false = needs its target system
  prerequisites: string[];     // what you need before step 1
  steps: RunStep[];            // node install → deps → config → run, each with WHY
  inputs: NamedThing[];        // what you give it
  outputs: NamedThing[];       // what comes back
  rerun: string;               // what's different the second time
  integrate: string;           // how to plug it into an existing system
}
const asStep = (s: string | FlowStep): FlowStep => (typeof s === 'string' ? { step: s } : s);
interface Category { id: string; no: string; name: string; desc: string; accent?: number; }
/** Per-suite chrome — title, hero copy and stat tiles. Lives in _build/site.json. */
interface Site {
  title: string;        // <title> and masthead brand
  eyebrow: string;      // small pill above the hero h1
  nav: { label: string; href: string }[];   // masthead links, relative to the site root
  footer: string;
  heroH1: string;
  heroLead: string;
  primerP: string;
  stats: { num: string; lbl: string }[];
}
const SITE_CFG: Site = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.json'), 'utf8'));

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
/** minimal inline markup: `code` and **bold** */
function rich(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="doclink" href="$2">$1</a>');
}

/** Link known Microsoft terms to their public docs — first occurrence of each. */
function docLinkify(html: string): string {
  const map: [RegExp, string][] = [
    [/(?<![\w>])Playwright MCP\b/, 'https://github.com/microsoft/playwright-mcp'],
    [/(?<![\w>])Playwright\b/, 'https://playwright.dev/docs/intro'],
    [/(?<![\w>])playwright-bdd\b/, 'https://vitalets.github.io/playwright-bdd/'],
    [/(?<![\w>])Ollama\b/, 'https://ollama.com'],
    [/(?<![\w>])node:sqlite\b/, 'https://nodejs.org/api/sqlite.html'],
  ];
  for (const [re, url] of map) {
    html = html.replace(re, m => `<a class="doclink" href="${url}" target="_blank" rel="noopener">${m}</a>`);
  }
  return html;
}

/** Safe-embed JSON in a <script> tag (escape < so </script> can't break out). */
function jsonScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The flowchart: clickable nodes (open a code preview) joined by arrows. */
function flowchartHtml(steps: FlowStep[]): string {
  const hasCode = steps.some(s => s.code);
  const nodes = steps.map((s, i) => {
    const clickable = Boolean(s.code || s.explain);
    const tag = clickable ? 'button' : 'div';
    const attrs = clickable ? `class="fc-node fc-node--live" data-fc="${i}" type="button"` : 'class="fc-node"';
    return `<${tag} ${attrs}>
        <span class="fc-node__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="fc-node__body">
          <span class="fc-node__t">${rich(s.step)}</span>
          ${s.fn ? `<span class="fc-node__fn">${esc(s.fn)}</span>` : ''}
        </span>
        ${clickable ? '<span class="fc-node__peek">view code →</span>' : ''}
      </${tag}>`;
  }).join('\n      <div class="fc-arrow" aria-hidden="true">↓</div>\n      ');

  const data = steps.map(s => ({ fn: s.fn || '', explain: s.explain || '', code: s.code || '' }));
  const modal = hasCode ? `
    <div class="code-modal" id="codeModal" hidden>
      <div class="code-modal__backdrop" data-close></div>
      <div class="code-modal__panel" role="dialog" aria-modal="true" aria-labelledby="cmFn">
        <button class="code-modal__x" data-close aria-label="Close">✕</button>
        <div class="code-modal__grid">
          <div class="code-modal__codecol">
            <div class="code-modal__cap"><code id="cmFn"></code></div>
            <pre class="code-modal__code"><code id="cmCode"></code></pre>
          </div>
          <aside class="code-modal__explain">
            <h4>What this step does</h4>
            <p id="cmExplain"></p>
          </aside>
        </div>
      </div>
    </div>
    <script type="application/json" id="fcData">${jsonScript(data)}</script>` : '';

  return `<p class="flow-lead">${hasCode ? 'Follow the flow — <strong>click any step to see the exact code behind it.</strong>' : 'Follow the flow from top to bottom.'}</p>
    <div class="flowchart">
      ${nodes}
    </div>${modal}`;
}

/** "Run it & wire it in" — the engineer-facing runbook. */
function runbookHtml(rb: Runbook | undefined): string {
  if (!rb) return '';
  const rbInner = rb ? `
    <div class="rb__banner rb__banner--${rb.runnable ? 'live' : 'ref'}">
      ${rb.runnable
        ? 'You can run this yourself, end to end — every command below is real.'
        : 'This was an internal tool: the steps are real, but running it needs access to the system it targets (your tracker, the app’s API, the designs). Treat it as a faithful how-it-ran guide.'}
    </div>
    <h3 class="display">Before you start</h3>
    <ul class="rb__prereqs">${rb.prerequisites.map(p => `<li>${rich(p)}</li>`).join('')}</ul>

    <h3 class="display">Step by step</h3>
    <ol class="rb__steps">
      ${rb.steps.map(s => `<li class="rb__step">
        <div class="rb__label">${rich(s.label)}</div>
        ${s.cmd ? `<pre class="rb__cmd"><code>${esc(s.cmd)}</code></pre>` : ''}
        <div class="rb__why"><span>Why</span> ${rich(s.why)}</div>
        ${s.firstRun ? `<div class="rb__run rb__run--first"><span>First run</span> ${rich(s.firstRun)}</div>` : ''}
        ${s.rerun ? `<div class="rb__run rb__run--again"><span>Re-run</span> ${rich(s.rerun)}</div>` : ''}
      </li>`).join('\n      ')}
    </ol>

    <div class="rb__io grid cols-2">
      <div><h3 class="display">What you give it</h3><dl class="rb__list">${rb.inputs.map(i => `<dt>${esc(i.name)}</dt><dd>${rich(i.desc)}</dd>`).join('')}</dl></div>
      <div><h3 class="display">What comes back</h3><dl class="rb__list">${rb.outputs.map(o => `<dt>${esc(o.name)}</dt><dd>${rich(o.desc)}</dd>`).join('')}</dl></div>
    </div>

    <div class="rb__note"><strong>Running it again.</strong> ${rich(rb.rerun)}</div>
    <div class="rb__note rb__note--wire"><strong>Plug it into your stack.</strong> ${rich(rb.integrate)}</div>` : '';


  return docLinkify(`<h2 class="display">Run it &amp; wire it in</h2>
    <section class="runbook">${rbInner}</section>`);
}

/** Under the hood: an embedded, slideable mini-deck (one slide per idea). */
function hoodHtml(hood: AgentContent['underHood'], sample?: OutputSample, rel = '../'): string {
  if (!hood && !sample) return '';
  if (typeof hood === 'string' && !sample) {
    return `<h2 class="display">Under the hood</h2>
    <details class="underhood"><summary>For the curious</summary><div class="underhood__body">${rich(hood)}</div></details>`;
  }
  const base: HoodSlide[] = Array.isArray(hood) ? hood : [];
  const total = base.length + (sample ? 1 : 0);
  const slides = base.map((s, i) => `
      <article class="uh-slide" data-uh="${i}">
        <div class="uh-slide__no">${i + 1} / ${total}</div>
        <h3 class="display">${esc(s.heading)}</h3>
        <dl class="uh-io">
          <dt>When it runs</dt><dd>${rich(s.whenRuns)}</dd>
          <dt>Takes in</dt><dd>${rich(s.input)}</dd>
          <dt>Shows out</dt><dd>${rich(s.output)}</dd>
        </dl>
      </article>`).join('');
  const sampleSlide = sample ? `
      <article class="uh-slide" data-uh="${base.length}">
        <div class="uh-slide__no">${total} / ${total}</div>
        <h3 class="display">${esc(sample.heading)}</h3>
        <div class="uh-sample">
          <div class="uh-sample__text"><dl class="uh-io">
            <dt>When it runs</dt><dd>${rich(sample.whenRuns)}</dd>
            <dt>Takes in</dt><dd>${rich(sample.input)}</dd>
            <dt>Shows out</dt><dd>${rich(sample.output)}</dd>
          </dl></div>
          <figure class="uh-sample__shot">
            <img alt="${esc(sample.imgAlt || 'Sample output rendered as an HTML page')}" src="${rel}${esc(sample.img)}">
            ${sample.caption ? `<figcaption>${esc(sample.caption)}</figcaption>` : ''}
          </figure>
        </div>
      </article>` : '';
  const dots = Array.from({ length: total }, (_, i) => `<button class="uh-dot${i === 0 ? ' is-on' : ''}" data-uh-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
  return `<h2 class="display">Under the hood — for the curious</h2>
    <p class="flow-lead">A slide for each moving part. Slide back and forth.</p>
    <section class="uh-deck" data-uh-deck>
      <div class="uh-viewport"><div class="uh-track">${slides}${sampleSlide}</div></div>
      <div class="uh-nav">
        <button class="uh-btn" data-uh-prev aria-label="Previous">‹ Back</button>
        <span class="uh-dots">${dots}</span>
        <button class="uh-btn" data-uh-next aria-label="Next">Next ›</button>
      </div>
    </section>`;
}

const PLATE_JS = `<script>
(function(){
  // --- code preview modal (flowchart) ---
  var modal = document.getElementById('codeModal');
  var dataEl = document.getElementById('fcData');
  if (modal && dataEl) {
    var data = JSON.parse(dataEl.textContent);
    var cmFn = document.getElementById('cmFn'), cmCode = document.getElementById('cmCode'), cmExplain = document.getElementById('cmExplain');
    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function open(i){ var d = data[i]; if(!d) return; cmFn.textContent = d.fn || 'code'; cmCode.textContent = d.code || ''; cmExplain.innerHTML = esc(d.explain || '').replace(/\`([^\`]+)\`/g, '<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>'); modal.hidden = false; document.body.style.overflow='hidden'; }
    function close(){ modal.hidden = true; document.body.style.overflow=''; }
    document.querySelectorAll('.fc-node--live').forEach(function(n){ n.addEventListener('click', function(){ open(+n.getAttribute('data-fc')); }); });
    modal.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click', close); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !modal.hidden) close(); });
  }
  // --- under-the-hood carousel ---
  var deck = document.querySelector('[data-uh-deck]');
  if (deck) {
    var track = deck.querySelector('.uh-track');
    var slides = deck.querySelectorAll('.uh-slide');
    var dots = deck.querySelectorAll('.uh-dot');
    var i = 0;
    function go(n){ i = Math.max(0, Math.min(slides.length-1, n)); track.style.transform = 'translateX(' + (-i*100) + '%)'; dots.forEach(function(d,j){ d.classList.toggle('is-on', j===i); }); }
    deck.querySelector('[data-uh-prev]').addEventListener('click', function(){ go(i-1); });
    deck.querySelector('[data-uh-next]').addEventListener('click', function(){ go(i+1); });
    dots.forEach(function(d,j){ d.addEventListener('click', function(){ go(j); }); });
  }
})();
</script>`;

const HEAD = (title: string, rel: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${rel}assets/site.css">
</head>`;

const MAST = (rel: string) => `
<header class="masthead"><div class="wrap masthead__inner">
  <div class="masthead__title"><b>◑</b> ${esc(SITE_CFG.title)}</div>
  <nav class="masthead__nav">
    ${SITE_CFG.nav.map(n => `<a href="${rel}${esc(n.href)}">${esc(n.label)}</a>`).join('\n    ')}
  </nav>
</div></header>`;

// ── Load content + categories ─────────────────────────────────────────────
function load(): { agents: AgentContent[]; cats: Category[] } {
  const cats: Category[] = JSON.parse(fs.readFileSync(path.join(BUILD, 'categories.json'), 'utf8'));
  const agents: AgentContent[] = [];
  if (fs.existsSync(CONTENT_DIR)) {
    for (const f of fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).sort()) {
      agents.push(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')));
    }
  }
  agents.sort((a, b) => a.plate - b.plate);
  return { agents, cats };
}

// ── Render one plate ───────────────────────────────────────────────────────
function plateHtml(a: AgentContent, cats: Category[], prev?: AgentContent, next?: AgentContent): string {
  const cat = cats.find(c => c.id === a.category);
  const catName = cat ? cat.name : a.category;
  const examples = a.examples.map(ex => `
    <figure class="specimen">
      <figcaption class="specimen__cap">${esc(ex.caption)}</figcaption>
      <div class="specimen__body">
        <div class="specimen__io"><h4>What goes in</h4><pre>${esc(ex.input)}</pre></div>
        <div class="specimen__io"><h4>What comes out</h4><pre>${esc(ex.output)}</pre></div>
      </div>
    </figure>`).join('\n');

  const sN = cat?.accent ?? cats.findIndex(c => c.id === a.category) + 1;
  return `${HEAD(`${a.name} — Agent ${String(a.plate).padStart(2, '0')}`, '../')}
<body class="plate-shell s${sN}">
${MAST('../')}
<main class="wrap wrap--article">
  <article class="plate">
    <div class="plate__top">
      <div class="plate__no">${String(a.plate).padStart(2, '0')}<small>Agent</small></div>
      <div class="plate__title">
        <div class="plate__cat"><span class="chip ${a.status === 'toolkit' ? 'chip--toolkit' : ''}">${esc(catName)}</span></div>
        <h1>${esc(a.name)}</h1>
        <p class="lead">${rich(a.oneLiner)}</p>
        <p class="kicker">Source: <a href="${codeUrl(a)}">src/agents/${esc(a.slug)}/</a> &nbsp;·&nbsp; Doc: <a href="../docs/agents/${esc(a.slug)}.md">docs/agents/${esc(a.slug)}.md</a> &nbsp;·&nbsp; Tests: <a href="../tests/${esc(a.slug)}/">tests/${esc(a.slug)}/</a></p>
      </div>
    </div>

    <p>${rich(a.lead)}</p>

    <h2 class="display">Why this exists</h2>
    <div class="beforeafter">
      <div class="ba ba--before"><div class="ba__label">The chore it removes</div><p>${rich(a.chore)}</p></div>
      <div class="ba__arrow">→</div>
      <div class="ba ba--after"><div class="ba__label">What you get instead</div><p>${rich(a.instead)}</p></div>
    </div>
    ${a.whyItMatters ? `<p>${rich(a.whyItMatters)}</p>` : ''}

    <h2 class="display">How it works</h2>
    ${flowchartHtml(a.howItWorks.map(asStep))}

    <h2 class="display">See it in action</h2>
    ${examples}

    ${runbookHtml(a.runbook)}

    ${hoodHtml(a.underHood, a.outputSample)}

    <nav class="platenav">
      <a href="${prev ? `${prev.slug}.html` : '../index.html'}">← ${prev ? esc(prev.name) : 'Contents'}</a>
      <a href="${next ? `${next.slug}.html` : '../index.html'}">${next ? esc(next.name) : 'Contents'} →</a>
    </nav>
  </article>
</main>
${PLATE_JS}
</body></html>`;
}

// ── GitHub publish wiring ──────────────────────────────────────────────────
// The catalog site (this hub) links each agent block to its source file, which
// lives in that agent's CATEGORY repo. One hub repo (qa-agents) hosts this site
// via Pages; eight category repos hold the code.
/**
 * Link to the source file backing an agent. Deliberately RELATIVE, not an
 * absolute github.com URL: this repo is private, may be renamed or forked, and
 * the pages are also read straight off a clone. A relative path resolves to the
 * blob view when browsing the repo on GitHub and to the file on disk locally.
 */
function codeUrl(a: AgentContent): string {
  return `../src/agents/${a.slug}/index.ts`;
}
/** Same link, from a page at the repo root (index.html) rather than agents/. */
function codeUrlFromRoot(a: AgentContent): string {
  return `src/agents/${a.slug}/index.ts`;
}

/** The hero crew: one friendly character per agent, first N of the set. */
const CREW: string[] = [
  `<rect x="6" y="18" width="52" height="52" rx="16" fill="#FF6B6B"/><circle cx="24" cy="40" r="3.4" fill="#3B3532"/><circle cx="40" cy="40" r="3.4" fill="#3B3532"/><path d="M24 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
  `<circle cx="103" cy="44" r="27" fill="#FFB020"/><circle cx="95" cy="40" r="3.4" fill="#3B3532"/><circle cx="111" cy="40" r="3.4" fill="#3B3532"/><path d="M95 51c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
  `<path d="M146 70V46c0-15 12-27 27-27s27 12 27 27v24Z" fill="#6C7BFF"/><circle cx="165" cy="44" r="3.4" fill="#FFF8EE"/><circle cx="181" cy="44" r="3.4" fill="#FFF8EE"/><path d="M165 55c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#FFF8EE" stroke-width="3" stroke-linecap="round"/>`,
  `<rect x="216" y="18" width="52" height="52" rx="26" fill="#2EC4A0"/><circle cx="234" cy="40" r="3.4" fill="#3B3532"/><circle cx="250" cy="40" r="3.4" fill="#3B3532"/><path d="M234 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
  `<rect x="286" y="18" width="52" height="52" rx="16" fill="#FF7BAC"/><circle cx="304" cy="40" r="3.4" fill="#3B3532"/><circle cx="320" cy="40" r="3.4" fill="#3B3532"/><path d="M304 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
  `<circle cx="383" cy="44" r="27" fill="#3FB4E8"/><circle cx="375" cy="40" r="3.4" fill="#3B3532"/><circle cx="391" cy="40" r="3.4" fill="#3B3532"/><path d="M375 51c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
  `<path d="M426 70V46c0-15 12-27 27-27s27 12 27 27v24Z" fill="#FF8A3D"/><circle cx="445" cy="44" r="3.4" fill="#3B3532"/><circle cx="461" cy="44" r="3.4" fill="#3B3532"/><path d="M445 55c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>`,
];
function crewSvg(n: number): string {
  const picked = CREW.slice(0, Math.max(1, Math.min(n, CREW.length)));
  // Each character occupies a ~70px column; trim the viewBox so a short row stays left-aligned.
  const width = 6 + picked.length * 70;
  return `<svg viewBox="0 0 ${width} 84">${picked.join('')}</svg>`;
}

// ── Render index (contents) ────────────────────────────────────────────────
function indexHtml(agents: AgentContent[], cats: Category[]): string {
  const total = agents.length;
  const sections = cats.map(c => {
    const members = agents.filter(a => a.category === c.id);
    if (!members.length) return '';
    const sN = c.accent ?? cats.indexOf(c) + 1;
    const cards = members.map(a => `
      <div class="rcard ${a.status === 'toolkit' ? 'rcard--toolkit' : ''}">
        <div class="rcard__no">Agent ${String(a.plate).padStart(2, '0')}</div>
        <div class="rcard__name">${esc(a.name)}</div>
        <div class="rcard__one">${rich(a.oneLiner)}</div>
        <div class="rcard__actions">
          <a class="rcard__code" href="${codeUrlFromRoot(a)}" title="View the annotated source">&#8249;&#47;&#8250; View code</a>
          <a class="rcard__tag" href="agents/${a.slug}.html">Details &rarr;</a>
        </div>
      </div>`).join('\n');
    return `
    <section class="section s${sN}" id="${esc(c.id)}">
      <div class="wrap">
        <div class="section__head"><span class="section__no">${esc(c.no)}</span><h2 class="display">${esc(c.name)}</h2></div>
        <p class="section__desc">${rich(c.desc)}</p>
        <div class="roster">${cards}</div>
      </div>
    </section>`;
  }).join('\n');

  return `${HEAD(SITE_CFG.title, '')}
<body>
${MAST('')}
<section class="hero">
  <div class="hero__blobs" aria-hidden="true">
    <svg style="top:-60px;right:-120px;width:460px" viewBox="0 0 460 460"><path fill="#FFE9C7" d="M230 20c95 0 210 60 210 175S345 420 230 420 20 330 20 215 135 20 230 20Z" opacity=".8"/></svg>
    <svg style="bottom:-90px;left:-140px;width:380px" viewBox="0 0 380 380"><path fill="#DDF6EF" d="M190 10c80 10 180 70 170 180S270 375 175 365 5 280 15 175 110 0 190 10Z" opacity=".8"/></svg>
    <svg style="top:120px;left:52%;width:120px" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#E9ECFF" opacity=".9"/></svg>
  </div>
  <div class="wrap">
  <div class="eyebrow hero__eyebrow">${esc(SITE_CFG.eyebrow)}</div>
  <h1 class="display">${esc(SITE_CFG.heroH1)}</h1>
  <p class="lead">${rich(SITE_CFG.heroLead)}</p>
  <div class="hero__crew" aria-hidden="true">
    ${crewSvg(total)}
  </div>
  <div class="hero__meta">
    ${SITE_CFG.stats.map((t, i) => `<div class="stat stat--${'abc'[i] || 'a'}"><div class="num">${esc(t.num)}</div><div class="lbl">${esc(t.lbl)}</div></div>`).join('\n    ')}
  </div>
  </div>
</section>

<section class="primer"><div class="wrap"><div class="primer__grid">
  <div>
    <div class="eyebrow">What "agent" means here</div>
    <h2 class="display">Scoped automation, not a chat assistant.</h2>
    <p>${rich(SITE_CFG.primerP)}</p>
  </div>
  <div class="primer__figure">"One job, one contract — composable, scriptable, and boring by design."</div>
</div></div></section>

${sections}

<footer class="footer"><div class="wrap">${rich(SITE_CFG.footer)}</div></footer>
</body></html>`;
}

// ── Build ──────────────────────────────────────────────────────────────────
function main(): void {
  const { agents, cats } = load();
  if (!agents.length) { console.log('No content yet in ./content — nothing to build.'); return; }
  fs.mkdirSync(OUT_AGENTS, { recursive: true });
  fs.writeFileSync(path.join(SITE, 'index.html'), indexHtml(agents, cats));
  for (let i = 0; i < agents.length; i++) {
    fs.writeFileSync(path.join(OUT_AGENTS, `${agents[i].slug}.html`), plateHtml(agents[i], cats, agents[i - 1], agents[i + 1]));
  }

  console.log(`Built: index.html, ${agents.length} agent page(s)`);
  console.log(`Categories with members: ${cats.filter(c => agents.some(a => a.category === c.id)).map(c => c.id).join(', ')}`);
}
main();
