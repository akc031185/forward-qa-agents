import { dbConnect } from '@/lib/db';
import { Contact } from '@/models/Contact';

export const GET = async () => {
  await dbConnect();
  return Response.json(await Contact.find({}).limit(1000));
};
