// Collector: data models and stores. Mongoose schemas (model name, collection, fields, indexes),
// SQL `CREATE TABLE` / `CREATE INDEX` statements (SQLite and others), and Prisma models. Stores
// are the databases the dependency graph says the app talks to.
import { RepoFiles, depsOf, isTestPath, readPackages, sortUniq } from './files.js';

export type StoreKind = 'mongodb' | 'sqlite' | 'postgres' | 'mysql' | 'redis' | 'kv' | 'sql';
export interface ModelField { name: string; type: string; required?: boolean; unique?: boolean; index?: boolean; ref?: string; enum?: string[] }
export interface ModelIndex { fields: string[]; unique: boolean; name?: string }
export interface Model {
  name: string; store: StoreKind; orm: 'mongoose' | 'prisma' | 'sql';
  collection?: string; collection_source?: 'explicit' | 'inferred';
  file: string; fields: ModelField[]; indexes: ModelIndex[]; timestamps?: boolean;
}
export interface Store { kind: StoreKind; label: string; evidence: string[] }
export interface ModelsResult { models: Model[]; stores: Store[] }

const STORE_PKGS: [pkg: string, kind: StoreKind, label: string][] = [
  ['mongoose', 'mongodb', 'MongoDB'], ['mongodb', 'mongodb', 'MongoDB'], ['@auth/mongodb-adapter', 'mongodb', 'MongoDB'],
  ['better-sqlite3', 'sqlite', 'SQLite'], ['sqlite3', 'sqlite', 'SQLite'], ['node:sqlite', 'sqlite', 'SQLite'],
  ['pg', 'postgres', 'PostgreSQL'], ['postgres', 'postgres', 'PostgreSQL'], ['@vercel/postgres', 'postgres', 'PostgreSQL'], ['@neondatabase/serverless', 'postgres', 'PostgreSQL'],
  ['mysql2', 'mysql', 'MySQL'], ['ioredis', 'redis', 'Redis'], ['redis', 'redis', 'Redis'], ['@upstash/redis', 'redis', 'Redis'], ['@vercel/kv', 'kv', 'Vercel KV'],
];

/** Index of the bracket that closes the one at `open`, skipping strings and comments. -1 if unbalanced. */
export function closeOf(src: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
    if (pairs[c]) stack.push(pairs[c]!);
    else if (c === '}' || c === ')' || c === ']') { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
  }
  return -1;
}

/** Split the inside of a bracket at top-level commas. */
export function splitTop(body: string): string[] {
  const out: string[] = []; let depth = 0; let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '"' || c === "'" || c === '`') { const q = c; cur += c; i++; while (i < body.length && body[i] !== q) { if (body[i] === '\\') { cur += body[i]; i++; } cur += body[i] ?? ''; i++; } cur += q; continue; }
    if (c === '/' && body[i + 1] === '/') { while (i < body.length && body[i] !== '\n') i++; continue; }
    if (c === '/' && body[i + 1] === '*') { const e = body.indexOf('*/', i + 2); i = e < 0 ? body.length : e + 1; continue; }
    if ('{[('.includes(c)) depth++;
    if ('}])'.includes(c)) depth--;
    if (c === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const quoted = (s: string) => [...s.matchAll(/['"]([^'"]{1,60})['"]/g)].map(m => m[1]!);

export function parseMongooseField(entry: string): ModelField | undefined {
  const m = /^\s*['"]?([A-Za-z_$][\w$]*)['"]?\s*:\s*([\s\S]*)$/.exec(entry);
  if (!m) return undefined;
  const name = m[1]!; const v = m[2]!.trim();
  const f: ModelField = { name, type: 'Mixed' };
  const typeName = (t: string) => t.replace(/\s+/g, '').replace(/^mongoose\./, '').replace(/^Schema\.Types\./, '').replace(/^Types\./, '');
  if (v.startsWith('{')) {
    const t = /(?:^|[{,\s])type\s*:\s*(\[\s*[\w.]+\s*\]|[\w.]+)/.exec(v)?.[1];
    f.type = t ? typeName(t) : 'Object';
    if (/\brequired\s*:\s*(true|\[)/.test(v)) f.required = true;
    if (/\bunique\s*:\s*true/.test(v)) f.unique = true;
    if (/\bindex\s*:\s*true/.test(v)) f.index = true;
    const ref = /\bref\s*:\s*['"]([\w-]+)['"]/.exec(v)?.[1]; if (ref) f.ref = ref;
    const en = /\benum\s*:\s*\[([^\]]*)\]/.exec(v)?.[1]; if (en) f.enum = quoted(en).slice(0, 12);
  } else if (v.startsWith('[')) {
    const inner = v.slice(1, -1).trim();
    f.type = inner.startsWith('{') ? '[Object]' : `[${typeName(inner) || 'Mixed'}]`;
    const ref = /\bref\s*:\s*['"]([\w-]+)['"]/.exec(inner)?.[1]; if (ref) f.ref = ref;
  } else {
    f.type = typeName(v.split(/\s/)[0] ?? 'Mixed');
  }
  return f;
}

/** Mongoose's default collection name, approximately (its `pluralize` rules): lower-cased; x, ch,
 *  ss, sh take -es; a trailing single s is kept (DailyAnalytics -> dailyanalytics); consonant+y
 *  takes -ies; everything else takes -s. */
export const inferCollection = (model: string) => { const l = model.toLowerCase(); return /(x|ch|ss|sh)$/.test(l) ? `${l}es` : /s$/.test(l) ? l : /([^aeiouy]|qu)y$/.test(l) ? `${l.slice(0, -1)}ies` : `${l}s`; };

export interface MongooseSchema { fields: ModelField[]; indexes: ModelIndex[]; timestamps?: boolean; collection?: string; file?: string }

/** The `const x = new Schema({...})` declarations in one file, by variable name. The optional type
 *  annotation stops at the line end, so an interface member above it (`userId: Types.ObjectId;`)
 *  cannot swallow the declaration and steal its name. */
export function parseMongooseSchemas(src: string): Map<string, MongooseSchema> {
  const schemas = new Map<string, MongooseSchema>();
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*(?::\s*[^=;\n]+)?=\s*new\s+(?:mongoose\.)?Schema\s*(?:<[^>]*>)?\s*\(/g)) {
    const open = src.indexOf('{', m.index! + m[0].length - 1);
    if (open < 0) continue;
    const close = closeOf(src, open); if (close < 0) continue;
    const fields = splitTop(src.slice(open + 1, close)).map(parseMongooseField).filter((x): x is ModelField => !!x);
    const after = src.slice(close + 1, close + 400);
    let timestamps: boolean | undefined; let collection: string | undefined;
    const optOpen = /^\s*,\s*\{/.exec(after);
    if (optOpen) {
      const o = close + 1 + after.indexOf('{');
      const oc = closeOf(src, o);
      const opts = oc > 0 ? src.slice(o, oc + 1) : '';
      if (/timestamps\s*:\s*(true|\{)/.test(opts)) timestamps = true;
      collection = /collection\s*:\s*['"]([\w.-]+)['"]/.exec(opts)?.[1];
    }
    const indexes: ModelIndex[] = fields.filter(f => f.unique || f.index).map(f => ({ fields: [f.name], unique: !!f.unique }));
    schemas.set(m[1]!, { fields, indexes, timestamps, collection });
  }
  for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\.index\s*\(\s*\{([^}]*)\}\s*(?:,\s*\{([^}]*)\})?/g)) {
    const s = schemas.get(m[1]!); if (!s) continue;
    const fields = [...m[2]!.matchAll(/['"]?([\w.$]+)['"]?\s*:/g)].map(x => x[1]!);
    s.indexes.push({ fields, unique: /unique\s*:\s*true/.test(m[3] ?? '') });
  }
  return schemas;
}

export function parseMongoose(file: string, src: string, external?: Map<string, MongooseSchema>): Model[] {
  const schemas = parseMongooseSchemas(src);
  // `model('X', s)`, `mongoose.model(...)`, and project factories such as `registerModel('X', s)`;
  // only counted when the second argument is a schema declared in this file, or (via `external`)
  // one declared once elsewhere in the repo and imported here.
  const out: Model[] = [];
  for (const m of src.matchAll(/\b(?:model|[A-Za-z_$][\w$]*Model)\s*(?:<[^>]*>)?\s*\(\s*['"]([\w-]+)['"]\s*,\s*([A-Za-z_$][\w$]*)(?:\s*,\s*['"]([\w.-]+)['"])?/g)) {
    const s = schemas.get(m[2]!) ?? external?.get(m[2]!); if (!s) continue;
    const explicit = m[3] ?? s.collection;
    out.push({
      name: m[1]!, store: 'mongodb', orm: 'mongoose', collection: explicit ?? inferCollection(m[1]!), collection_source: explicit ? 'explicit' : 'inferred',
      file: s.file ?? file, fields: s.fields, indexes: s.indexes, timestamps: s.timestamps,
    });
  }
  return out;
}

export function parseSql(file: string, src: string, store: StoreKind): Model[] {
  const tables = new Map<string, Model>();
  for (const m of src.matchAll(/CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?([\w.]+)[`"\]]?\s*\(/gi)) {
    const open = m.index! + m[0].length - 1;
    const close = closeOf(src, open); if (close < 0) continue;
    const fields: ModelField[] = []; const indexes: ModelIndex[] = [];
    for (const entry of splitTop(src.slice(open + 1, close))) {
      const e = entry.replace(/\s+/g, ' ').trim();
      const pk = /^(?:CONSTRAINT \S+ )?(PRIMARY KEY|UNIQUE) ?\(([^)]*)\)/i.exec(e);
      if (pk) { indexes.push({ fields: pk[2]!.split(',').map(s => s.trim().replace(/[`"[\]]/g, '')), unique: true, name: pk[1]!.toUpperCase() === 'PRIMARY KEY' ? 'primary key' : undefined }); continue; }
      if (/^(CONSTRAINT|FOREIGN KEY|CHECK)\b/i.test(e)) continue;
      const c = /^[`"[]?(\w+)[`"\]]?\s*([A-Za-z]+(?:\s*\([^)]*\))?)?/.exec(e); if (!c) continue;
      const f: ModelField = { name: c[1]!, type: (c[2] ?? 'ANY').toUpperCase() };
      if (/PRIMARY KEY/i.test(e)) { f.unique = true; indexes.push({ fields: [f.name], unique: true, name: 'primary key' }); }
      if (/NOT NULL/i.test(e)) f.required = true;
      if (/\bUNIQUE\b/i.test(e)) f.unique = true;
      const ref = /REFERENCES\s+[`"[]?(\w+)/i.exec(e)?.[1]; if (ref) f.ref = ref;
      const chk = /CHECK\s*\(\s*\w+\s+IN\s*\(([^)]*)\)/i.exec(e)?.[1]; if (chk) f.enum = quoted(chk).slice(0, 12);
      fields.push(f);
    }
    tables.set(m[1]!.toLowerCase(), { name: m[1]!, store, orm: 'sql', collection: m[1]!, collection_source: 'explicit', file, fields, indexes });
  }
  for (const m of src.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s+ON\s+[`"]?(\w+)[`"]?\s*\(([^)]*)\)/gi)) {
    const t = tables.get(m[3]!.toLowerCase()); if (!t) continue;
    if (t.indexes.some(i => i.name?.toLowerCase() === m[2]!.toLowerCase())) continue;   // re-declared in a migration
    t.indexes.push({ name: m[2]!, unique: !!m[1], fields: m[4]!.split(',').map(s => s.trim().split(/\s+/)[0]!.replace(/[`"]/g, '')) });
  }
  return [...tables.values()];
}

export function parsePrisma(file: string, src: string): Model[] {
  const provider = /datasource\s+\w+\s*\{[^}]*provider\s*=\s*"(\w+)"/.exec(src)?.[1] ?? '';
  const store: StoreKind = /postgres/.test(provider) ? 'postgres' : /mysql/.test(provider) ? 'mysql' : /sqlite/.test(provider) ? 'sqlite' : /mongo/.test(provider) ? 'mongodb' : 'sql';
  const out: Model[] = [];
  for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields: ModelField[] = []; const indexes: ModelIndex[] = [];
    let table: string | undefined;
    for (const line of m[2]!.split('\n').map(l => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)) {
      const map = /^@@map\(\s*"([^"]+)"/.exec(line); if (map) { table = map[1]; continue; }
      const idx = /^@@(index|unique|id)\(\s*(?:fields:\s*)?\[([^\]]*)\]/.exec(line);
      if (idx) { indexes.push({ fields: idx[2]!.split(',').map(s => s.trim().split('(')[0]!), unique: idx[1] !== 'index', name: idx[1] === 'id' ? 'primary key' : undefined }); continue; }
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line); if (!f) continue;
      const field: ModelField = { name: f[1]!, type: `${f[2]}${f[3] ?? ''}` };
      if (!f[4] && !f[3]) field.required = true;
      if (/@unique|@id/.test(f[5]!)) { field.unique = true; indexes.push({ fields: [field.name], unique: true, name: /@id/.test(f[5]!) ? 'primary key' : undefined }); }
      const rel = /@relation/.test(f[5]!) || /^[A-Z]/.test(f[2]!) && !['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'].includes(f[2]!);
      if (rel) field.ref = f[2];
      fields.push(field);
    }
    out.push({ name: m[1]!, store, orm: 'prisma', collection: table ?? m[1]!, collection_source: table ? 'explicit' : 'inferred', file, fields, indexes });
  }
  return out;
}

export function collectModels(repo: RepoFiles): ModelsResult {
  const pkgs = readPackages(repo);
  const allDeps = new Set(pkgs.flatMap(p => Object.keys(depsOf(p, false))));
  const models: Model[] = [];
  const storeEvidence = new Map<StoreKind, { label: string; ev: string[] }>();
  const addStore = (kind: StoreKind, label: string, ev: string) => { const s = storeEvidence.get(kind) ?? { label, ev: [] }; s.ev.push(ev); storeEvidence.set(kind, s); };
  for (const [pkg, kind, label] of STORE_PKGS) if (allDeps.has(pkg)) addStore(kind, label, `dependency ${pkg}`);

  // Schemas declared in one file and registered in another (exported, then passed to a `useDb()`
  // connection's `model()`): index every declaration by variable name, keeping only names declared
  // once in the repo so an ambiguous name never borrows the wrong fields.
  const external = new Map<string, MongooseSchema>(); const seenSchema = new Set<string>();
  for (const f of repo.files) {
    if (isTestPath(f) || !/\.[cm]?[jt]sx?$/.test(f) || /\.d\.ts$/.test(f)) continue;
    const src = repo.text(f); if (!src || !/mongoose/.test(src) || !/\bSchema\s*(?:<[^>]*>)?\s*\(/.test(src)) continue;
    for (const [name, s] of parseMongooseSchemas(src)) {
      if (seenSchema.has(name)) external.delete(name); else external.set(name, { ...s, file: f });
      seenSchema.add(name);
    }
  }

  for (const f of repo.files) {
    if (isTestPath(f)) continue;
    if (f.endsWith('.prisma')) { const ms = parsePrisma(f, repo.text(f) ?? ''); models.push(...ms); for (const m of ms) addStore(m.store, m.store, f); continue; }
    const isCode = /\.[cm]?[jt]sx?$/.test(f) && !/\.d\.ts$/.test(f);
    if (!isCode && !f.endsWith('.sql')) continue;
    const src = repo.text(f); if (!src) continue;
    // A registering file need not mention mongoose (`opsModel('X', importedSchema)`); the schema
    // argument must still resolve to a Mongoose schema declared here or once elsewhere.
    if (isCode && ((/mongoose/.test(src) && /\bSchema\s*(?:<[^>]*>)?\s*\(/.test(src)) || /\b(?:model|[A-Za-z_$][\w$]*Model)\s*(?:<[^>]*>)?\s*\(\s*['"]/.test(src))) models.push(...parseMongoose(f, src, external));
    if (/CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE/i.test(src)) {
      const store: StoreKind = /sqlite|better-sqlite3|DatabaseSync/i.test(src) ? 'sqlite' : /\bpg\b|postgres|SERIAL|JSONB/i.test(src) ? 'postgres' : /mysql|AUTO_INCREMENT/i.test(src) ? 'mysql' : allDeps.has('better-sqlite3') || allDeps.has('sqlite3') ? 'sqlite' : 'sql';
      const ms = parseSql(f, src, store); models.push(...ms);
      if (ms.length && store === 'sqlite') addStore('sqlite', 'SQLite', f);
    }
    if (isCode && /from\s+['"]node:sqlite['"]/.test(src)) addStore('sqlite', 'SQLite', f);
  }
  const LABEL: Record<StoreKind, string> = { mongodb: 'MongoDB', sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL', redis: 'Redis', kv: 'Vercel KV', sql: 'SQL database' };
  if (models.some(m => m.store === 'sql') && !storeEvidence.size) addStore('sql', 'SQL database', 'CREATE TABLE statements');
  const stores = [...storeEvidence.entries()].map(([kind, s]) => ({ kind, label: LABEL[kind], evidence: sortUniq(s.ev).slice(0, 8) }));
  // One-off scripts often redeclare a model inline (a seed script's own User); when the app itself
  // defines a model of that name, the script copies are noise.
  const inScripts = (f: string) => /(^|\/)scripts?\//.test(f);
  const appModels = new Set(models.filter(m => !inScripts(m.file)).map(m => `${m.store}:${m.name}`));
  // The same registration seen twice (a doc-comment example elsewhere that resolves to the same
  // schema) is one model.
  const once = new Set<string>();
  const kept = models.filter(m => !inScripts(m.file) || !appModels.has(`${m.store}:${m.name}`))
    .filter(m => { const k = `${m.store}:${m.name}:${m.file}`; if (once.has(k)) return false; once.add(k); return true; });
  kept.sort((a, b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name));
  return { models: kept, stores };
}
