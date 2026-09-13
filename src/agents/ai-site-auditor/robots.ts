// robots.txt parsing and matching per RFC 9309: group selection by the most specific user-agent,
// longest matching rule wins, `allow` wins a tie, `*` and `$` wildcards. Pure.

export interface RobotsRule { allow: boolean; path: string }
export interface RobotsGroup { agents: string[]; rules: RobotsRule[] }
export interface Robots { groups: RobotsGroup[]; sitemaps: string[] }

export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | undefined;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'user-agent') {
      // consecutive user-agent lines share one group
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      // "Disallow:" with an empty path allows everything; it adds no rule
      if (value) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return { groups, sitemaps };
}

/** The group that applies to a crawler: an exact token match, else `*`, else none. */
export function groupFor(robots: Robots, token: string): RobotsGroup | undefined {
  const t = token.toLowerCase();
  const exact = robots.groups.filter(g => g.agents.includes(t));
  if (exact.length) return { agents: [t], rules: exact.flatMap(g => g.rules) };
  const star = robots.groups.filter(g => g.agents.includes('*'));
  if (star.length) return { agents: ['*'], rules: star.flatMap(g => g.rules) };
  return undefined;
}

function ruleRegex(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export interface AccessDecision { allowed: boolean; matchedBy: 'exact' | 'star' | 'none'; rule?: RobotsRule }

/** Whether `token` may fetch `path` (path + query), and which group and rule decided it. */
export function isAllowed(robots: Robots, token: string, path: string): AccessDecision {
  const group = groupFor(robots, token);
  if (!group) return { allowed: true, matchedBy: 'none' };
  const matchedBy = group.agents[0] === '*' ? 'star' : 'exact';
  let best: RobotsRule | undefined;
  for (const r of group.rules) {
    if (!ruleRegex(r.path).test(path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  return { allowed: best ? best.allow : true, matchedBy, rule: best };
}
