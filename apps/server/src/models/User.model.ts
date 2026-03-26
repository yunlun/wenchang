import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PLAN_LIMITS } from '@wenchang/shared';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  studioName?: string;
  plan: 'free' | 'pro' | 'enterprise';
  usageCount: number;
  usageLimit: number;
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    studioName: { type: String, trim: true },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: PLAN_LIMITS.free },
  },
  { timestamps: true }
);

// Hash 密码
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const UserModel = mongoose.model<IUser>('User', UserSchema);

