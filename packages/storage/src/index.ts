import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getEnv } from '@regirl/config';

export interface StorageAdapter {
  createUploadUrl(objectKeyPrefix: string): Promise<{ objectKey: string; uploadUrl: string }>;
  createReadUrl(objectKey: string): Promise<string>;
  putObject(objectKey: string, buffer: Buffer): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly basePath: string) {}

  async createUploadUrl(objectKeyPrefix: string) {
    const objectKey = `${objectKeyPrefix}/${randomUUID()}.jpg`;
    const absPath = join(this.basePath, objectKey);
    await mkdir(join(absPath, '..'), { recursive: true });
    await writeFile(absPath, Buffer.from('placeholder'));
    return { objectKey, uploadUrl: `file://${absPath}` };
  }

  async createReadUrl(objectKey: string) {
    return `file://${join(this.basePath, objectKey)}`;
  }

  async putObject(objectKey: string, buffer: Buffer) {
    const absPath = join(this.basePath, objectKey);
    await mkdir(join(absPath, '..'), { recursive: true });
    await writeFile(absPath, buffer);
  }
}

class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  constructor(private readonly bucket: string) {
    const env = getEnv();
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      credentials:
        env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY
          ? { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY }
          : undefined,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
    });
  }

  async createUploadUrl(objectKeyPrefix: string) {
    const env = getEnv();
    const objectKey = `${objectKeyPrefix}/${randomUUID()}.jpg`;
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: env.SIGNED_URL_TTL_SECONDS });
    return { objectKey, uploadUrl };
  }

  async createReadUrl(objectKey: string) {
    const env = getEnv();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.client, command, { expiresIn: env.SIGNED_URL_TTL_SECONDS });
  }

  async putObject(objectKey: string, buffer: Buffer) {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: buffer });
    await this.client.send(command);
  }
}

let storage: StorageAdapter | null = null;

export const getStorage = (): StorageAdapter => {
  if (storage) return storage;
  const env = getEnv();

  storage =
    env.STORAGE_PROVIDER === 's3'
      ? new S3StorageAdapter(env.STORAGE_BUCKET)
      : new LocalStorageAdapter(env.LOCAL_STORAGE_PATH);
  return storage;
};
