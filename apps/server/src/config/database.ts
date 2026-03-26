import mongoose from 'mongoose';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  mongoose.connection.on('connected', () =>
    logger.info('MongoDB connected successfully')
  );
  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB connection error:', err)
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'wenchang',
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}

