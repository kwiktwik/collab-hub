import crypto from 'crypto';
import config from './config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  // Ensure the key is exactly 32 bytes
  const key = config.encryptionKey;
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex')
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getKey();
  const ivBuffer = Buffer.from(iv, 'hex');
  
  // Extract auth tag from the end of encrypted data
  const authTag = Buffer.from(encrypted.slice(-AUTH_TAG_LENGTH * 2), 'hex');
  const encryptedData = encrypted.slice(0, -AUTH_TAG_LENGTH * 2);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
