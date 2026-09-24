import Stripe from 'stripe';
import { dbConnect } from '@/lib/db';
import { Workspace } from '@/models/Workspace';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  const event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  await dbConnect();
  if (event.type === 'customer.subscription.updated') {
    await Workspace.updateOne({ stripeCustomerId: String(event.data.object.customer) }, { plan: 'pro', lastEventId: event.id });
  }
  return new Response('ok');
}
