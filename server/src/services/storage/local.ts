import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { StorageProvider, UploadResult } from './types.js';
import config from '../../config/index.js';

/**
 * Local storage provider - simulates S3-like storage for development/testing
 */
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || config.localStoragePath;
    this.ensureBasePath();
  }

  private ensureBasePath(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private getFullPath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\//, '');
    return path.join(this.basePath, sanitizedKey);
  }

  private ensureDirectory(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    const fullPath = this.getFullPath(key);
    this.ensureDirectory(fullPath);
    
    await fs.promises.writeFile(fullPath, buffer);
    
    // Store metadata in a sidecar file
    const metadataPath = `${fullPath}.meta.json`;
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      mimeType,
      size: buffer.length,
      uploadedAt: new Date().toISOString()
    }));

    return {
      key,
      size: buffer.length,
      mimeType
    };
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    
    return fs.promises.readFile(fullPath);
  }

  async getStream(key: string): Promise<Readable> {
    const fullPath = this.getFullPath(key);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    
    return fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    const metadataPath = `${fullPath}.meta.json`;
    
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
    
    if (fs.existsSync(metadataPath)) {
      await fs.promises.unlink(metadataPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    return fs.existsSync(fullPath);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, we return a path that can be served by the API
    // In production with S3, this would be a pre-signed URL
    const token = Buffer.from(JSON.stringify({
      key,
      expires: Date.now() + (expiresIn * 1000)
    })).toString('base64url');
    
    return `/api/files/download/${encodeURIComponent(key)}?token=${token}`;
  }

  async getMetadata(key: string): Promise<{ mimeType: string; size: number } | null> {
    const fullPath = this.getFullPath(key);
    const metadataPath = `${fullPath}.meta.json`;
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  }
}

export default LocalStorageProvider;
