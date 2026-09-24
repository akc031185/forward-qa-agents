import { Resend } from 'resend';
import { dbConnect } from '@/lib/db';
import { sendSms } from '@/lib/twilio';
import { Contact } from '@/models/Contact';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('no', { status: 401 });
  await dbConnect();
  const count = await Contact.countDocuments({ stage: 'new' });
  await resend.emails.send({ from: 'digest@harbor-ledger.test', to: 'owner@harbor-ledger.test', subject: 'Digest', text: `${count} new` });
  await sendSms('+15550000000', `${count} new contacts`);
  return new Response('sent');
}
