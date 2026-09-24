// Builds a throwaway git repository from the synthetic fixture. Secret-like files are written at
// run time (never checked in here): a committed .env and .pem, and an uncommitted .env.local and
// route, so tests can prove the dossier reads only committed HEAD and never opens secret files.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FIXTURE = path.resolve('fixtures/architecture-dossier/sample-repo');
export const FIXTURE_DIR = path.resolve('fixtures/architecture-dossier');
// Assembled at run time so no key-shaped literal is committed: GitHub push protection
// rightly blocks anything that looks like a live Stripe key, even an obvious fake.
export const FAKE_SECRET = ['sk', 'live', 'FAKEdossierFixture0000000000'].join('_');
export const FAKE_PEM_BODY = 'MIIFAKEdossierPemBody0000';
export const WORKTREE_SECRET = 'wt_only_FAKE_worktree_secret_1234';
export const TEMPLATE_VALUE = 'example-value-not-for-output';

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

export function makeFixtureRepo(): { dir: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-fixture-'));
  const dir = path.join(root, 'harbor');
  fs.cpSync(FIXTURE, dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'initial');
  fs.writeFileSync(path.join(dir, '.env'), `STRIPE_SECRET_KEY=${FAKE_SECRET}\nMONGODB_URI=mongodb://u:${FAKE_SECRET}@db.invalid/x\n`);
  fs.mkdirSync(path.join(dir, 'certs'));
  fs.writeFileSync(path.join(dir, 'certs', 'dev.pem'), `-----BEGIN PRIVATE KEY-----\n${FAKE_PEM_BODY}\n-----END PRIVATE KEY-----\n`);
  git(dir, 'add', '-f', '.env', 'certs/dev.pem');
  git(dir, 'commit', '-q', '-m', 'oops: commit secrets');
  // Working-tree-only changes that must never reach the dossier.
  fs.writeFileSync(path.join(dir, '.env.local'), `WT_ONLY=${WORKTREE_SECRET}\n`);
  fs.mkdirSync(path.join(dir, 'src/app/api/uncommitted'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app/api/uncommitted/route.ts'), 'export async function GET() { return new Response(process.env.UNCOMMITTED_ONLY_VAR); }\n');
  return { dir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
