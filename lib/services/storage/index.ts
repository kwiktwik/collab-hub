import type { StorageProvider, UploadResult } from './types';
import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import config from '@/lib/config';

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    if (config.storageType === 's3') {
      storageInstance = new S3StorageProvider();
      console.log('Using S3 storage provider');
    } else {
      storageInstance = new LocalStorageProvider();
      console.log('Using local storage provider');
    }
  }
  return storageInstance;
}

export { LocalStorageProvider, S3StorageProvider };
export type { StorageProvider, UploadResult };
