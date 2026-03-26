import mongoose, { Document, Schema } from 'mongoose';

export interface ICertificate extends Document {
  artworkId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  certNo: string;
  ownerName: string;
  studioName?: string;
  artworkTitle: string;
  artworkHash: string;
  blockchainNetwork: string;
  txHash: string;
  blockHeight?: number;
  issuedAt: Date;
  pdfKey?: string;
  verifyUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateSchema = new Schema<ICertificate>(
  {
    artworkId: { type: Schema.Types.ObjectId, ref: 'Artwork', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    certNo: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    studioName: { type: String },
    artworkTitle: { type: String, required: true },
    artworkHash: { type: String, required: true },
    blockchainNetwork: { type: String, required: true },
    txHash: { type: String, required: true, unique: true },
    blockHeight: { type: Number },
    issuedAt: { type: Date, required: true },
    pdfKey: { type: String },
    verifyUrl: { type: String, required: true },
  },
  { timestamps: true }
);

export const CertificateModel = mongoose.model<ICertificate>('Certificate', CertificateSchema);

