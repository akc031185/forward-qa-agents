import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import Database from 'better-sqlite3';

const db = new Database(process.env.WORKER_DB_PATH ?? 'jobs.db');
db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('export','digest')),
  status TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`);

async function requireWorkerToken(req: FastifyRequest, reply: FastifyReply) {
  if (req.headers.authorization !== `Bearer ${process.env.WORKER_TOKEN}`) return reply.code(401).send();
}

const app = Fastify();
app.get('/health', async () => ({ ok: true }));
app.post('/jobs', { preHandler: [requireWorkerToken] }, async (req) => {
  db.prepare('INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)').run(String(Date.now()), 'export', 'queued', JSON.stringify(req.body));
  return { ok: true };
});
app.route({ method: ['GET', 'DELETE'], url: '/jobs/:id', preHandler: [requireWorkerToken], handler: async (req) => db.prepare('SELECT * FROM jobs WHERE id = ?').get((req.params as { id: string }).id) });

app.listen({ port: Number(process.env.PORT ?? 8080), host: '0.0.0.0' });
