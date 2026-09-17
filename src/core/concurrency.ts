// A browser is memory-hungry (see docs/DEPLOYING-THE-WORKER.md's memory section): letting every
// `POST /worker/audits` launch its own Chromium instance immediately, with no limit, is exactly
// what OOM-kills a container under a burst of submissions. `Gate` is the smallest thing that
// fixes that for a single worker process: a counting semaphore with a FIFO wait queue. It answers
// "how many audits may run their browser right now" — it does not touch the HTTP response (the
// worker still replies 202 immediately; see src/api/worker.ts) and it does not survive a restart
// or coordinate across replicas. Horizontal scaling (more replicas, each with its own Gate) and a
// durable cross-process queue are a deliberately later rung on the ladder — see
// docs/ANALYZER-ARCHITECTURE.md ("Orchestration") for why this is enough before that.
export class Gate {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(public readonly limit: number) {
    if (limit < 1) throw new Error(`Gate limit must be at least 1, got ${limit}`);
  }

  /** Audits currently allowed to run their browser. */
  get activeCount(): number { return this.active; }
  /** Audits that have been submitted but are waiting for a free slot. */
  get queuedCount(): number { return this.waiting.length; }

  /** Runs `fn` once a slot is free; queues in submission order (FIFO) otherwise. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.waiting.push(() => { this.active++; resolve(); });
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}
