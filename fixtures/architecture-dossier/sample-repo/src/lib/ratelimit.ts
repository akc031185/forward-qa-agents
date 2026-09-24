import { Ratelimit } from '@upstash/ratelimit';

export const limiter = { limit: async (_key: string) => ({ success: true, lib: Ratelimit }) };
