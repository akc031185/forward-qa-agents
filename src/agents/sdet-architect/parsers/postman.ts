// Postman collection (v2.x) parser. Pure function on the JSON text.
import type { ApiRequest, TestSuite } from '../model.js';
import { emptySuite } from '../model.js';

export function isPostmanCollection(text: string): boolean {
  if (!/getpostman/.test(text)) return false;
  try { const j = JSON.parse(text); return typeof j?.info?.schema === 'string' && j.info.schema.includes('getpostman'); } catch { return false; }
}

interface PmItem { name?: string; item?: PmItem[]; request?: PmRequest | string; event?: { listen: string; script?: { exec?: string[] | string } }[] }
interface PmRequest { method?: string; url?: string | { raw?: string; host?: string[]; path?: string[]; query?: { key: string; value: string }[] }; header?: { key: string; value: string; disabled?: boolean }[]; body?: { mode?: string; raw?: string; urlencoded?: { key: string; value: string }[]; formdata?: { key: string; value: string }[] } }

export function parsePostman(text: string, file: string): TestSuite {
  const suite = emptySuite(file, 'postman', 'postman-collection');
  const j = JSON.parse(text) as { info?: { name?: string }; variable?: { key: string; value: string }[]; item?: PmItem[] };
  suite.className = j.info?.name ?? file;
  suite.variables = Object.fromEntries((j.variable ?? []).map((v) => [v.key, String(v.value ?? '')]));
  const requests: ApiRequest[] = [];
  const walk = (items: PmItem[], folder: string[]) => {
    for (const it of items) {
      if (it.item) { walk(it.item, [...folder, it.name ?? '']); continue; }
      if (!it.request) continue;
      const r = typeof it.request === 'string' ? { method: 'GET', url: it.request } : it.request;
      const url = typeof r.url === 'string' ? r.url : r.url?.raw ?? [(r.url?.host ?? []).join('.'), ...(r.url?.path ?? [])].join('/');
      const headers = (r.header ?? []).filter((h) => !h.disabled).map((h) => ({ key: h.key, value: String(h.value ?? '') }));
      let body: string | undefined;
      if (r.body?.mode === 'raw' && r.body.raw) body = r.body.raw;
      else if (r.body?.mode === 'urlencoded' && r.body.urlencoded) body = new URLSearchParams(r.body.urlencoded.map((p) => [p.key, p.value])).toString();
      else if (r.body?.mode === 'formdata' && r.body.formdata) body = JSON.stringify(Object.fromEntries(r.body.formdata.map((p) => [p.key, p.value])));
      const testScript = (it.event ?? []).filter((e) => e.listen === 'test').flatMap((e) => { const x = e.script?.exec; return Array.isArray(x) ? x : x ? [x] : []; });
      const status = testScript.map((l) => /to\.have\.status\((\d{3})\)|response\.code\)\.to\.(?:eql|equal)\((\d{3})\)|responseCode\.code\s*===?\s*(\d{3})/.exec(l)).find(Boolean);
      requests.push({
        name: it.name ?? `${r.method} ${url}`, folder, method: (r.method ?? 'GET').toUpperCase(), url, headers, body,
        expectedStatus: status ? Number(status[1] ?? status[2] ?? status[3]) : undefined, testScript,
      });
    }
  };
  walk(j.item ?? [], []);
  suite.requests = requests;
  for (const r of requests) {
    suite.tests.push({ name: [...r.folder, r.name].join(' / '), line: 0, steps: [{ kind: 'navigate', raw: `${r.method} ${r.url}`, line: 0, value: r.url }, ...(r.expectedStatus ? [{ kind: 'assert' as const, raw: `status ${r.expectedStatus}`, line: 0 }] : [])] });
    for (const u of [r.url]) if (/^https?:\/\//.test(u)) suite.urls.push(u);
  }
  return suite;
}
