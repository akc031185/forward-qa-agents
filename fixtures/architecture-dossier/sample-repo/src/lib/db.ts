import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
export const clientPromise = new MongoClient(uri).connect();

export async function dbConnect() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}
