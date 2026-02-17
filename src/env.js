import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_URL: z.string().url().optional(), // NextAuth v5 base URL
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    // Azure AD / Entra ID Authentication
    // Optional for development (can use Discord instead)
    // If provided, all three must be non-empty strings
    AZURE_AD_TENANT_ID: z.string().min(1).optional(),
    AZURE_AD_CLIENT_ID: z.string().min(1).optional(),
    AZURE_AD_CLIENT_SECRET: z.string().min(1).optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // File Upload Configuration (Story 3.1)
    UPLOAD_DIR: z.string().optional(), // Default: ./uploads
    ENABLE_MALWARE_SCAN: z.string().transform(val => val === "true").optional(), // Enable ClamAV scanning
    CLAMAV_HOST: z.string().optional(), // ClamAV server host
    CLAMAV_PORT: z.string().transform(Number).optional(), // ClamAV server port

    // Email Service Configuration (Story 4.14)
    // EMAIL_PROVIDER determines which transport to use:
    // - 'sendgrid': Use SendGrid API (requires SENDGRID_API_KEY)
    // - 'ses': Use AWS SES (requires AWS_SES_* credentials)
    // - 'console': Log emails to console (development mode)
    EMAIL_PROVIDER: z.enum(["sendgrid", "ses", "console"]).default("console"),

    // SendGrid Configuration (required if EMAIL_PROVIDER=sendgrid)
    SENDGRID_API_KEY: z.string().optional(),

    // AWS SES Configuration (required if EMAIL_PROVIDER=ses)
    AWS_SES_REGION: z.string().optional(),
    AWS_SES_ACCESS_KEY_ID: z.string().optional(),
    AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),

    // Email From Address (required if EMAIL_PROVIDER != console)
    EMAIL_FROM_ADDRESS: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().optional(),

    // Background Worker Configuration (Story 4.18)
    // WORKER_ENABLED: Enable/disable background workers (default: true)
    // WORKER_INTERVAL: Interval between worker runs in ms (default: 30000)
    WORKER_ENABLED: z.string().transform(val => val !== "false").default("true"),
    WORKER_INTERVAL: z.string().transform(Number).default("30000"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // File Upload Configuration (Story 3.1)
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    ENABLE_MALWARE_SCAN: process.env.ENABLE_MALWARE_SCAN,
    CLAMAV_HOST: process.env.CLAMAV_HOST,
    CLAMAV_PORT: process.env.CLAMAV_PORT,

    // Email Service Configuration (Story 4.14)
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    AWS_SES_ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID,
    AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,

    // Background Worker Configuration (Story 4.18)
    WORKER_ENABLED: process.env.WORKER_ENABLED,
    WORKER_INTERVAL: process.env.WORKER_INTERVAL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
