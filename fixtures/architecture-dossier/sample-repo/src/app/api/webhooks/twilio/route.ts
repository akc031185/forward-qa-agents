import { dbConnect } from '@/lib/db';
import { Contact } from '@/models/Contact';

// Inbound SMS. Deliberately missing a signature check: the fixture's unverified webhook.
export async function POST(req: Request) {
  const form = await req.formData();
  await dbConnect();
  await Contact.updateOne({ phone: String(form.get('From')) }, { $push: { tags: 'replied' } });
  return new Response('<Response/>', { headers: { 'content-type': 'text/xml' } });
}
