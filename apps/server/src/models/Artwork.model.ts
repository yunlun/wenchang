import mongoose, { Document, Schema } from 'mongoose';
import type { ArtworkStatus, ArtworkCategory } from '@wenchang/shared';

export interface IArtwork extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: ArtworkCategory;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  sha256Hash: string;
  status: ArtworkStatus;
  blockchainTxHash?: string;
  certificateId?: mongoose.Types.ObjectId;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArtworkSchema = new Schema<IArtwork>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ['illustration', 'photography', 'design', 'video', 'audio', 'document', 'other'],
      required: true,
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true },
    sha256Hash: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'hashing', 'submitting', 'confirmed', 'failed'],
      default: 'pending',
    },
    blockchainTxHash: { type: String },
    certificateId: { type: Schema.Types.ObjectId, ref: 'Certificate' },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

ArtworkSchema.index({ userId: 1, createdAt: -1 });
ArtworkSchema.index({ sha256Hash: 1, userId: 1 });

export const ArtworkModel = mongoose.model<IArtwork>('Artwork', ArtworkSchema);

