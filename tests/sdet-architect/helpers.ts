import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXTURES = path.join(REPO, 'fixtures', 'sdet-architect');
export const read = (rel: string) => fs.readFileSync(path.join(FIXTURES, rel), 'utf8');
