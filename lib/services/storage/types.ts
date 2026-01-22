import { Readable } from 'stream';

export interface UploadResult {
  key: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
