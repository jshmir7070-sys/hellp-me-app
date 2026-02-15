import type { Express } from "express";
import type { Server } from "http";

export class ObjectStorageService {
  private static instance: ObjectStorageService | null = null;

  static getInstance(): ObjectStorageService {
    if (!ObjectStorageService.instance) {
      ObjectStorageService.instance = new ObjectStorageService();
    }
    return ObjectStorageService.instance;
  }

  async uploadFile(_filename: string, _buffer: Buffer, _contentType?: string): Promise<string> {
    throw new Error("Object storage not configured");
  }

  async downloadFile(_filename: string): Promise<Buffer> {
    throw new Error("Object storage not configured");
  }

  async deleteFile(_filename: string): Promise<void> {
    throw new Error("Object storage not configured");
  }

  async listFiles(_prefix?: string): Promise<string[]> {
    return [];
  }

  getPublicUrl(_filename: string): string {
    return "";
  }
}

export function registerObjectStorageRoutes(_httpServer: Server, _app: Express): void {
}
