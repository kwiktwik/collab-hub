import type { StorageProvider, UploadResult } from './types.js';
import { LocalStorageProvider } from './local.js';
import { S3StorageProvider } from './s3.js';
import config from '../../config/index.js';

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
