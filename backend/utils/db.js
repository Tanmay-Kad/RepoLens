import mongoose from 'mongoose';
import config from './config.js';

const connectDB = async () => {
  const primaryUri = config.mongoUri;
  const fallbackUri = 'mongodb://127.0.0.1:27017/repolens';

  try {
    const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Primary MongoDB connection error: ${error.message}`);
    if (primaryUri !== fallbackUri) {
      console.log('Attempting fallback connection to local MongoDB (mongodb://127.0.0.1:27017/repolens)...');
      try {
        const conn = await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 5000 });
        console.log(`MongoDB Connected (Local Fallback): ${conn.connection.host}`);
        return;
      } catch (fallbackErr) {
        console.error(`Fallback connection error: ${fallbackErr.message}`);
      }
    }
    console.error('Database connection failed. Exiting...');
    process.exit(1);
  }
};

export default connectDB;
