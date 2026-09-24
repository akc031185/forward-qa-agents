import { Schema, model, models } from 'mongoose';

const WorkspaceSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  stripeCustomerId: String,
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  lastEventId: String,
}, { collection: 'tenants' });

export const Workspace = models.Workspace || model('Workspace', WorkspaceSchema);
