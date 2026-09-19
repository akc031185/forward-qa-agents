import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { scores } from '../../src/agents/ai-site-auditor/rules.js';
import { AREAS, EFFORT_LABEL, HEADLINE, fixPlan, wireFindings } from '../../src/agents/ai-site-auditor/report.js';
import type { Area, CheckResult, Severity } from '../../src/agents/ai-site-auditor/types.js';

const r = (id: string, area: Area, severity: Severity): CheckResult => ({ id, area, severity, title: id, why: `why ${id}`, fix: `fix ${id}` });

// The shape of the dadbuildinglegacy-style run: five search findings, five readiness, two design tells.
const RESULTS: CheckResult[] = [
  r('seo.canonical-to-home', 'search', 'high'), r('seo.duplicate-descriptions', 'search', 'medium'),
  r('seo.duplicate-titles', 'search', 'medium'), r('seo.long-title', 'search', 'low'), r('seo.no-robots-txt', 'search', 'low'),
  r('readiness.no-privacy-policy', 'readiness', 'high'), r('readiness.no-terms', 'readiness', 'medium'),
  r('readiness.no-analytics', 'readiness', 'low'), r('readiness.no-business-identity', 'readiness', 'low'), r('readiness.unhelpful-404', 'readiness', 'low'),
  r('design.low-contrast-text', 'design', 'low'), r('design.untouched-shadcn', 'design', 'low'),
  r('ai.no-llms-txt', 'ai-visibility', 'info'),
];

test('wireFindings: per-area points add back up to exactly what scores() took off', () => {
  const s = scores(RESULTS);
  const wire = wireFindings(RESULTS);
  for (const area of AREAS) {
    const lost = wire.filter(f => f.area === area).reduce((n, f) => n + f.points, 0);
    assert.equal(100 - lost, s[area], area);
  }
  assert.equal(s.search, 60);
  assert.equal(s.readiness, 65);
  assert.equal(s.design, 88);
});

test('wireFindings: fix-plan order, effort label and headline travel with each finding', () => {
  const wire = wireFindings(RESULTS);
  assert.deepEqual(wire.map(f => f.id), fixPlan(RESULTS).map(p => p.result.id));
  const canon = wire.find(f => f.id === 'seo.canonical-to-home')!;
  assert.equal(canon.effort, 'quick');
  assert.equal(canon.effort_label, EFFORT_LABEL.quick);
  assert.equal(canon.headline, HEADLINE['seo.canonical-to-home']);
  assert.equal(wire.find(f => f.id === 'seo.long-title')!.headline, undefined);
});

test('HEADLINE: every key names a check that rules.ts can actually emit', () => {
  const src = fs.readFileSync(new URL('../../src/agents/ai-site-auditor/rules.ts', import.meta.url), 'utf8');
  for (const id of Object.keys(HEADLINE)) assert.ok(src.includes(`'${id}'`), id);
});
