// Bearer-token check for the standalone worker endpoints (`src/api/worker.ts`). Pure and
// dependency-free so it is trivial to unit test: no Fastify, no config import, just strings in.
import { timingSafeEqual } from 'node:crypto';

/**
 * True only when `token` is non-empty and `header` is exactly `Bearer <token>`. A missing or
 * empty token always fails closed — callers must refuse rather than fall back to "no auth
 * required" when the operator has not configured one.
 */
export function isBearerAuthorized(header: string | string[] | undefined, token: string): boolean {
  if (!token) return false;
  if (typeof header !== 'string') return false;
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqualString(match[1]!, token);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch; pad rather than short-circuit on `.length` so an
  // attacker cannot learn the token length from response timing either.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // burn roughly the same time as the real comparison below
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
