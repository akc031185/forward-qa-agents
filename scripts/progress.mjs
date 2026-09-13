#!/usr/bin/env node
// Measures the repo and stamps a new day entry at the top of PROGRESS.md.
// Usage: npm run progress            -> insert today's entry (no-op if today already exists)
//        npm run progress -- --print -> print the snapshot table only, change nothing
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sh = (cmd) => { try { return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

const today = new Date();
const ymd = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-'); // local date, not UTC
const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });

function countLines(dir) {
  let files = 0, lines = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (name !== 'node_modules') walk(p); }
      else if (/\.(ts|mjs|js)$/.test(name)) { files++; lines += readFileSync(p, 'utf8').split('\n').length; }
    }
  };
  if (existsSync(dir)) walk(dir);
  return { files, lines };
}

const commits = sh('git rev-list --count HEAD') || '0';
const commitsToday = sh(`git log --since="${ymd}T00:00:00" --oneline`).split('\n').filter(Boolean).length;
const head = sh('git log -1 --format=%h');
sh('git fetch -q origin');
const ahead = sh('git rev-list --count origin/main..HEAD');
const behind = sh('git rev-list --count HEAD..origin/main');
const dirty = sh('git status --porcelain | sed "s/^/x/"').split('\n').filter(Boolean).map(l => l.slice(1));
const typecheck = sh('npm run -s typecheck && echo ok') ? 'pass' : 'FAIL';
const testOut = sh('LLM_PROVIDER=none npm test -s 2>&1');
const pass = (testOut.match(/ℹ pass (\d+)/) || [])[1] ?? '?';
const fail = (testOut.match(/ℹ fail (\d+)/) || [])[1] ?? '?';
const suites = (testOut.match(/ℹ suites (\d+)/) || [])[1] ?? '?';
const src = countLines(join(root, 'src'));
const tests = countLines(join(root, 'tests'));
const runs = sh(`sqlite3 data/forward-qa.db "select count(*)||' ('||coalesce(group_concat(agent||':'||status),'none')||')' from runs"`) || 'db not initialised';

const sync = ahead === '0' && behind === '0' ? 'yes, in sync' : `no (ahead ${ahead || '?'}, behind ${behind || '?'})`;
const table = [
  '| Metric | Value |', '|---|---|',
  `| Commits on main | ${commits} (${commitsToday} today, head \`${head}\`) |`,
  `| Pushed to origin | ${sync} |`,
  `| Uncommitted files | ${dirty.length}${dirty.length ? ' (' + dirty.map(l => l.replace(/^..\s?/, '')).join(', ') + ')' : ''} |`,
  `| Typecheck | ${typecheck} |`,
  `| Tests | ${pass} pass, ${fail} fail (${suites} suites) |`,
  `| Source lines (src/) | ${src.lines} across ${src.files} files |`,
  `| Test lines (tests/) | ${tests.lines} across ${tests.files} files |`,
  `| Agent runs in DB | ${runs} |`,
].join('\n');

if (process.argv.includes('--print')) { console.log(table); process.exit(0); }

const file = join(root, 'PROGRESS.md');
const md = readFileSync(file, 'utf8');
if (md.includes(`## ${ymd} `)) {
  console.log(`PROGRESS.md already has an entry for ${ymd}. Snapshot to paste over the old table:\n\n${table}`);
  process.exit(0);
}
const entry = `## ${ymd} (${weekday})

**Snapshot at end of day**

${table}

**Done**

- HH:MM 

**Decided**

- 

**Open / next**

1. 

---

`;
const marker = '---\n\n## ';
const idx = md.indexOf(marker);
if (idx < 0) throw new Error('Could not find the first entry marker in PROGRESS.md');
const out = md.slice(0, idx + 5) + entry + md.slice(idx + 5);
writeFileSync(file, out);
console.log(`Inserted ${ymd} entry at the top of PROGRESS.md. Fill in Done / Decided / Open before ending the session.`);
