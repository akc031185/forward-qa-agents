import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbConnect } from '@/lib/db';
import { Contact } from '@/models/Contact';

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  await dbConnect();
  return NextResponse.json(await Contact.findOne({ _id: params.id, workspaceId: session?.user.workspaceId }));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  await dbConnect();
  await Contact.updateOne({ _id: params.id, workspaceId: session?.user.workspaceId }, await req.json());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (session?.user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await Contact.deleteOne({ _id: params.id, workspaceId: session.user.workspaceId });
  return NextResponse.json({ ok: true });
}
