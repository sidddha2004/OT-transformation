import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument extends Document {
  title: string;
  content: string;
  version: number;
  operations: Array<{
    type: 'insert' | 'delete';
    position: number;
    content?: string;
    length?: number;
    userId: string;
    timestamp: Date;
  }>;
  updatedAt: Date;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  title: { type: String, required: true, default: 'Untitled' },
  content: { type: String, required: false, default: '' },
  version: { type: Number, required: true, default: 0 },
  operations: [{
    type: { type: String, enum: ['insert', 'delete'], required: true },
    position: { type: Number, required: true },
    content: { type: String },
    length: { type: Number },
    userId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

export default mongoose.model<IDocument>('Document', DocumentSchema);