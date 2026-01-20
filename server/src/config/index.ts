import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Session
  sessionSecret: process.env.SESSION_SECRET || 'super-secret-session-key-change-in-production',
  
  // Storage
  storageType: process.env.STORAGE_TYPE || 'local', // 'local' or 's3'
  localStoragePath: process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'uploads'),
  
  // S3 Configuration
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'collab-hub',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
  },
  
  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || 'default-32-byte-encryption-key!', // 32 bytes for AES-256
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Allow all origins in development
  get corsOptions() {
    return {
      origin: this.nodeEnv === 'development' ? true : this.corsOrigin,
      credentials: true
    };
  }
};

export default config;
