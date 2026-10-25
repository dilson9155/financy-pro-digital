import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

/**
 * Armazenamento de objetos usado pelos backups.
 *
 * Funciona com qualquer servico compativel com S3 (Cloudflare R2, AWS S3,
 * Backblaze B2, MinIO...). Se as variaveis `S3_*` nao estiverem configuradas,
 * `isObjectStorageConfigured()` devolve `false` e o chamador usa o disco local.
 */

interface ObjectStorageConfig {
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  prefix: string;
}

let cachedClient: S3Client | null = null;
let cachedConfig: ObjectStorageConfig | null = null;

function readConfig(): ObjectStorageConfig | null {
  const env = getEnv();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    accessKeyId,
    secretAccessKey,
    region: env.S3_REGION?.trim() || "auto",
    prefix: env.S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "") ?? "",
  };
}

/** `true` quando o bucket esta configurado e os backups devem ir para ele. */
export function isObjectStorageConfigured(): boolean {
  return readConfig() !== null;
}

function getClient(): { client: S3Client; config: ObjectStorageConfig } {
  if (cachedClient && cachedConfig) {
    return { client: cachedClient, config: cachedConfig };
  }

  const config = readConfig();
  if (!config) {
    throw new Error("Armazenamento de objetos nao configurado (variaveis S3_*).");
  }

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    // Necessario para endpoints proprios (R2, B2, MinIO): usa path-style.
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedConfig = config;

  return { client: cachedClient, config };
}

/** Monta a chave completa (com prefixo opcional) do objeto. */
export function objectKey(key: string): string {
  const config = readConfig();
  const prefix = config?.prefix ?? "";
  return prefix ? `${prefix}/${key}` : key;
}

export interface PutObjectResult {
  bucket: string;
  key: string;
}

/** Envia um conteudo de texto (JSON) para o bucket. */
export async function putTextObject(
  key: string,
  body: string,
  contentType = "application/json",
): Promise<PutObjectResult> {
  const { client, config } = getClient();
  const fullKey = objectKey(key);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: fullKey,
      Body: body,
      ContentType: contentType,
      ContentLength: Buffer.byteLength(body, "utf8"),
    }),
  );

  return { bucket: config.bucket, key: fullKey };
}

export interface StoredObject {
  body: ReadableStream | null;
  contentType: string | null;
  contentLength: number | null;
}

/** Le um objeto do bucket. Devolve `null` quando o objeto nao existe. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const { client, config } = getClient();

  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );

    return {
      body: (result.Body as ReadableStream | undefined) ?? null,
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
    };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

/** Remove um objeto (usado por limpezas administrativas). */
export async function deleteObject(key: string): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}
