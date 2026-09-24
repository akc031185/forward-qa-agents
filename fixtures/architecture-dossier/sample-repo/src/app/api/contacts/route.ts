import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { dbConnect } from '@/lib/db';
import { limiter } from '@/lib/ratelimit';
import { upsertGhlContact } from '@/lib/ghl';
import { Contact } from '@/models/Contact';

const Body = z.object({ email: z.string().email(), name: z.string().min(1) });

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  await dbConnect();
  const items = await Contact.find({ workspaceId: session.user.workspaceId });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const { success } = await limiter.limit(session.user.id);
  if (!success) return NextResponse.json({ error: 'slow down' }, { status: 429 });
  const body = Body.parse(await req.json());
  await dbConnect();
  const created = await Contact.create({ ...body, workspaceId: session.user.workspaceId });
  await upsertGhlContact(body);
  return NextResponse.json(created, { status: 201 });
}
