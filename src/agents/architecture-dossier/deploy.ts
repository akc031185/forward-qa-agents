// Collector: deployment. Where and how the code ships: vercel.json, railway.toml / railway.json,
// Dockerfiles, fly.toml, render.yaml, netlify.toml, Procfile, docker-compose, Kubernetes manifests, GitHub workflows.
import { RepoFiles } from './files.js';

export interface DeployTarget { platform: string; file: string; detail: Record<string, string | number | boolean> }
export interface DockerImage { file: string; base_images: string[]; exposes: string[]; user?: string; healthcheck: boolean; stages: number }
export interface Workflow { file: string; name?: string; triggers: string[]; jobs: string[]; deploys_with: string[] }
export interface DeployResult { targets: DeployTarget[]; docker: DockerImage[]; workflows: Workflow[] }

/** Minimal TOML: `[section]` headers and `key = value` scalars. Enough for railway.toml and fly.toml. */
export function tomlScalars(text: string): Record<string, string> {
  const out: Record<string, string> = {}; let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const sec = /^\[\[?([^\]]+)\]\]?$/.exec(line); if (sec) { section = sec[1]!.trim(); continue; }
    const kv = /^([\w.-]+)\s*=\s*(.+)$/.exec(line); if (kv) out[section ? `${section}.${kv[1]}` : kv[1]!] = kv[2]!.trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Top-level `on:` triggers and `jobs:` keys of a GitHub workflow, without a YAML parser. */
export function workflowShape(y: string): { name?: string; triggers: string[]; jobs: string[] } {
  const name = /^name\s*:\s*['"]?([^'"\n]+)/m.exec(y)?.[1]?.trim();
  const triggers = new Set<string>();
  const onLine = /^(?:on|"on"|'on')[ \t]*:[ \t]*(.*)$/m.exec(y);
  if (onLine) {
    const inline = onLine[1]!.trim();
    if (inline && !inline.startsWith('#')) for (const t of inline.replace(/[[\]]/g, '').split(',')) { if (t.trim()) triggers.add(t.trim()); }
    else {
      const after = y.slice(onLine.index! + onLine[0].length).split('\n');
      for (const l of after) { if (/^\S/.test(l)) break; const k = /^ {2}([\w-]+)\s*:/.exec(l); if (k) triggers.add(k[1]!); }
    }
  }
  const jobs: string[] = [];
  const j = /^jobs\s*:\s*$/m.exec(y);
  if (j) for (const l of y.slice(j.index! + j[0].length).split('\n')) { if (/^\S/.test(l)) break; const k = /^ {2}([\w-]+)\s*:/.exec(l); if (k) jobs.push(k[1]!); }
  return { name, triggers: [...triggers], jobs };
}

/** Kubernetes object kinds declared in a YAML file (multi-document aware). Empty when it is not a manifest. */
export function k8sKinds(y: string): string[] {
  const kinds: string[] = [];
  for (const doc of y.split(/^---\s*$/m)) {
    const api = /^apiVersion\s*:\s*['"]?([\w./-]+)/m.exec(doc)?.[1];
    const kind = /^kind\s*:\s*['"]?(\w+)/m.exec(doc)?.[1];
    if (api && kind && (/^v1$|\.k8s\.io\/|^(apps|batch|autoscaling|policy|networking\.k8s\.io|kustomize\.config\.k8s\.io)\//.test(api))) kinds.push(kind);
  }
  return kinds;
}

export function collectDeploy(repo: RepoFiles): DeployResult {
  const targets: DeployTarget[] = [];
  for (const f of repo.files) {
    const base = f.split('/').pop()!;
    const text = () => repo.text(f) ?? '';
    if (base === 'vercel.json') {
      try {
        const j = JSON.parse(text()) as Record<string, unknown>;
        const len = (k: string) => (Array.isArray(j[k]) ? (j[k] as unknown[]).length : 0);
        const fns = j.functions && typeof j.functions === 'object' ? Object.values(j.functions as Record<string, { maxDuration?: number }>) : [];
        const d: Record<string, string | number | boolean> = { crons: len('crons'), headers: len('headers'), rewrites: len('rewrites'), redirects: len('redirects') };
        if (typeof j.framework === 'string') d.framework = j.framework;
        if (Array.isArray(j.regions)) d.regions = (j.regions as string[]).join(', ');
        if (fns.length) { d.function_overrides = fns.length; const md = Math.max(...fns.map(x => x.maxDuration ?? 0)); if (md) d.max_duration_s = md; }
        targets.push({ platform: 'Vercel', file: f, detail: d });
      } catch { targets.push({ platform: 'Vercel', file: f, detail: { parse_error: true } }); }
    } else if (base === 'railway.toml' || base === 'railway.json') {
      const d: Record<string, string | number | boolean> = {};
      if (base === 'railway.toml') {
        const t = tomlScalars(text());
        for (const k of ['build.builder', 'build.dockerfilePath', 'deploy.startCommand', 'deploy.healthcheckPath', 'deploy.healthcheckTimeout', 'deploy.restartPolicyType', 'deploy.numReplicas']) if (t[k] !== undefined) d[k] = t[k]!;
      } else {
        try { const j = JSON.parse(text()) as { build?: Record<string, unknown>; deploy?: Record<string, unknown> }; for (const [s, o] of Object.entries({ build: j.build, deploy: j.deploy })) for (const [k, v] of Object.entries(o ?? {})) if (typeof v !== 'object') d[`${s}.${k}`] = v as string; } catch { d.parse_error = true; }
      }
      targets.push({ platform: 'Railway', file: f, detail: d });
    } else if (base === 'fly.toml') {
      const t = tomlScalars(text()); const d: Record<string, string> = {};
      for (const k of ['primary_region', 'http_service.internal_port', 'http_service.auto_stop_machines']) if (t[k] !== undefined) d[k] = t[k]!;
      targets.push({ platform: 'Fly.io', file: f, detail: d });
    } else if (base === 'render.yaml') {
      targets.push({ platform: 'Render', file: f, detail: { services: (text().match(/^\s*-\s*type\s*:/gm) ?? []).length } });
    } else if (base === 'netlify.toml') {
      targets.push({ platform: 'Netlify', file: f, detail: {} });
    } else if (base === 'Procfile') {
      targets.push({ platform: 'Procfile (Heroku-style)', file: f, detail: { processes: text().split('\n').filter(l => /^\w+:/.test(l)).map(l => l.split(':')[0]).join(', ') } });
    } else if (/^(docker-)?compose\.ya?ml$/.test(base) || /^docker-compose\.[\w-]+\.ya?ml$/.test(base)) {
      const svc = /^services\s*:\s*$/m.exec(text());
      const names: string[] = [];
      if (svc) for (const l of text().slice(svc.index! + svc[0].length).split('\n')) { if (/^\S/.test(l)) break; const k = /^ {2}([\w-]+)\s*:/.exec(l); if (k) names.push(k[1]!); }
      targets.push({ platform: 'Docker Compose', file: f, detail: { services: names.join(', ') } });
    } else if (/^next\.config\.[cm]?[jt]s$/.test(base)) {
      const out = /output\s*:\s*['"](\w+)['"]/.exec(text())?.[1];
      if (out) targets.push({ platform: `Next.js output: ${out}`, file: f, detail: { output: out } });
    }
  }

  // Kubernetes: YAML manifests with apiVersion + kind (and kustomization files), one target per folder.
  const k8s = new Map<string, Set<string>>();
  for (const f of repo.files) {
    if (!/\.ya?ml$/.test(f) || /^\.github\//.test(f)) continue;
    const kinds = k8sKinds(repo.text(f) ?? '');
    if (!kinds.length) continue;
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
    const set = k8s.get(dir) ?? new Set<string>(); for (const k of kinds) set.add(k); k8s.set(dir, set);
  }
  for (const [dir, kinds] of [...k8s.entries()].sort()) targets.push({ platform: 'Kubernetes', file: dir, detail: { kinds: [...kinds].sort().join(', ') } });

  const docker: DockerImage[] = repo.files.filter(f => /(^|\/)Dockerfile[^/]*$/.test(f)).map(f => {
    const t = repo.text(f) ?? '';
    const users = [...t.matchAll(/^\s*USER\s+(\S+)/gm)].map(m => m[1]!);
    return {
      file: f,
      base_images: [...t.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)].map(m => m[1]!),
      exposes: [...t.matchAll(/^\s*EXPOSE\s+(.+)$/gm)].flatMap(m => m[1]!.trim().split(/\s+/)),
      user: users[users.length - 1],
      healthcheck: /^\s*HEALTHCHECK\s/m.test(t),
      stages: (t.match(/^\s*FROM\s/gim) ?? []).length,
    };
  });

  const workflows: Workflow[] = repo.files.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).map(f => {
    const y = repo.text(f) ?? '';
    const shape = workflowShape(y);
    // YAML comments often explain the platform ("Vercel's Hobby plan...") without deploying to it.
    const live = y.split('\n').filter(l => !/^\s*#/.test(l)).map(l => l.replace(/\s+#.*$/, '')).join('\n');
    const deploys_with = [
      [/vercel(-action)?\b|vercel\s+deploy|npx\s+vercel/i, 'Vercel'], [/railway\s+up|railwayapp\//i, 'Railway'], [/flyctl|superfly\//i, 'Fly.io'],
      [/docker\/build-push-action|docker\s+push/i, 'container registry'], [/actions\/deploy-pages|peaceiris\/actions-gh-pages|gh-pages/i, 'GitHub Pages'],
    ].filter(([re]) => (re as RegExp).test(live)).map(([, l]) => l as string);
    return { file: f, ...shape, deploys_with };
  });

  return { targets, docker, workflows };
}
