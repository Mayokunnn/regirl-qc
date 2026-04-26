import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(8).default('dev-super-secret'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string().min(1).default('postgresql://regirl:regirl@localhost:5432/regirl_qc'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  STORAGE_PROVIDER: z.enum(['s3', 'local']).default('local'),
  STORAGE_BUCKET: z.string().default('regirl-qc'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  LOCAL_STORAGE_PATH: z.string().default('.local-storage'),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),

  AI_PROVIDER: z.enum(['mock', 'gemini', 'openai', 'auto']).default('mock'),
  AI_FALLBACK_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  AI_MOCK_SEED: z.string().default('2026'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  WORKER_CONCURRENCY: z.coerce.number().default(2)
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export const getEnv = (): AppEnv => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
};
