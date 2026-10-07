import { z } from "zod";

const boolFromString = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .default(false);

const DEV_MAGIC_LINK_SECRET = "dev-magic-link-secret-change-me-please";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  MAGIC_LINK_SECRET: z.string().min(16).default(DEV_MAGIC_LINK_SECRET),

  DEMO_MODE: boolFromString,
  BINANCE_WS_BASE_URL: z.string().default("wss://stream.binance.com:9443"),
  COINGECKO_API_BASE_URL: z.string().default("https://api.coingecko.com/api/v3"),
  COINGECKO_API_KEY: z.string().optional(),
  TWELVE_DATA_API_KEY: z.string().optional(),
  TWELVE_DATA_POLL_INTERVAL_MS: z.coerce.number().default(120000),


  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("CoinRadar <alerts@levelpulse.app>"),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:support@levelpulse.app"),

  TELEGRAM_BOT_TOKEN: z.string().optional(),

  ENABLE_MOCK_BILLING: boolFromString,

  THROTTLE_TTL_MS: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(120),
  /** Express "trust proxy" setting (e.g. "1" behind one reverse proxy), so rate limits key on the real client IP. */
  TRUST_PROXY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Production must not boot on the placeholders from .env.example or the built-in dev default:
 * anyone who has read this repo could sign their own session or magic-link tokens.
 */
function rejectUnsafeProductionConfig(env: EnvConfig, ctx: z.RefinementCtx) {
  if (env.NODE_ENV !== "production") return;
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "MAGIC_LINK_SECRET"] as const) {
    if (env[key] === DEV_MAGIC_LINK_SECRET || env[key].startsWith("change-me")) {
      ctx.addIssue({ code: "custom", path: [key], message: `${key} is still a placeholder - set a long random value` });
    }
  }
  if (env.ENABLE_MOCK_BILLING) {
    ctx.addIssue({ code: "custom", path: ["ENABLE_MOCK_BILLING"], message: "mock billing lets any user upgrade for free - disable it in production" });
  }
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.superRefine(rejectUnsafeProductionConfig).safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
