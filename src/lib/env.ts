import { z } from "zod";

/**
 * Validacao e leitura tipada de variaveis de ambiente.
 * Falha rapido em runtime se algo essencial estiver ausente.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL e obrigatoria"),
  DIRECT_URL: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Financy Pro Digital"),
  AUTH_SECRET: z.string().min(16).default("dev-insecure-secret-change-me-please"),
  AUTH_COOKIE_NAME: z.string().default("financy_session"),
  SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  BACKUP_DIR: z.string().default("./storage/backups"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variaveis de ambiente invalidas:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";
