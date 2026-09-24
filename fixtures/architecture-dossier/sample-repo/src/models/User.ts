import { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true });

export const User = models.User || model('User', UserSchema);
