import type { NextApiRequest, NextApiResponse } from 'next';
import { put } from '@vercel/blob';
import { getServerSession } from 'next-auth/next';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getServerSession(req, res, {} as never);
  if (!session) return res.status(401).end();
  const blob = await put('upload.bin', req, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
  res.json(blob);
}
