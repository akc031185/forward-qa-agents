import { Schema, model, models } from 'mongoose';

const ContactSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  email: { type: String, required: true, lowercase: true },
  name: String,
  phone: { type: String },
  tags: [String],
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  stage: { type: String, enum: ['new', 'contacted', 'won'], default: 'new' },
}, { timestamps: true });

ContactSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

export const Contact = models.Contact || model('Contact', ContactSchema);
