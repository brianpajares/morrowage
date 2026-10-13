/**
 * Validación centralizada de variables de entorno (contrato: `.env.example`).
 * - Los valores de ejemplo (`REPLACE_ME`, `YOUR_…`) se tratan como "no configurado".
 * - Los servicios opcionales se detectan en `capabilities`; /api/health las expone como booleanos.
 * - Stripe solo está activo con MONETIZATION_MODE=stripe Y STRIPE_ENABLED=true (AT-18).
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

const PLACEHOLDER = /REPLACE_ME|YOUR_[A-Z_]+|your-project|example\.invalid/i;

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  if (v === '' || PLACEHOLDER.test(v)) return undefined;
  return v;
}

const optional = z.string().optional().transform(clean);
const boolFlag = z
  .string()
  .optional()
  .transform((v) => clean(v)?.toLowerCase() === 'true');

const schema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).optional(),
  NODE_ENV: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  NEXT_PUBLIC_APP_URL: optional,
  APP_VERSION: optional,
  MODEL_VERSION: optional,
  MONETIZATION_MODE: z
    .enum(['validation', 'stripe'])
    .optional()
    .or(z.literal('').transform(() => undefined)),
  STRIPE_ENABLED: boolFlag,
  REPORT_TOKEN_TTL_HOURS: optional,
  REPORT_RETENTION_DAYS: optional,
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: optional,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: optional,
  GOOGLE_DRIVE_FOLDER_ID: optional,
  GOOGLE_DRIVE_APP_ROOT: optional,
  DRIVE_CACHE_TTL_SECONDS: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  OWNER_EMAIL: optional,
  NEXT_PUBLIC_POSTHOG_KEY: optional,
  NEXT_PUBLIC_POSTHOG_HOST: optional,
  SENTRY_DSN: optional,
  NEXT_PUBLIC_SENTRY_DSN: optional,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  TURNSTILE_SECRET_KEY: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
  STRIPE_PRICE_REPORT_USD: optional,
  // Añadidas por la implementación (ver DECISIONS.md, 2026-10-07):
  SESSION_PEPPER: optional,
  CRON_SECRET: optional,
  NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL: optional,
});

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Variable de entorno inválida: ${name}`);
  return n;
}

export interface Capabilities {
  supabase: boolean;
  drive: boolean;
  email: boolean;
  turnstile: boolean;
  rateLimitRedis: boolean;
  posthog: boolean;
  sentry: boolean;
  stripe: boolean;
}

export interface AppEnv {
  appEnv: 'development' | 'test' | 'production';
  /** true cuando corre el despliegue de producción real de Vercel (o NODE_ENV=production fuera de test). */
  isProduction: boolean;
  appUrl: string;
  appVersion: string;
  modelVersion: string;
  monetizationMode: 'validation' | 'stripe';
  /** Stripe operativo: MONETIZATION_MODE=stripe && STRIPE_ENABLED=true. */
  stripeActive: boolean;
  reportTokenTtlHours: number;
  reportRetentionDays: number;
  driveCacheTtlSeconds: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  google: { email?: string; privateKey?: string; folderId?: string; appRoot: string };
  resendApiKey?: string;
  emailFrom?: string;
  ownerEmail?: string;
  posthog: { key?: string; host: string };
  sentryDsn?: string;
  turnstile: { siteKey?: string; secretKey?: string };
  upstash: { url?: string; token?: string };
  stripe: { secretKey?: string; webhookSecret?: string; priceId?: string };
  sessionPepper: string;
  cronSecret?: string;
  privacyContactEmail?: string;
  capabilities: Capabilities;
}

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const e = schema.parse(source);

  const nodeEnv = e.NODE_ENV ?? 'development';
  const appEnv = e.APP_ENV ?? (nodeEnv === 'production' ? 'production' : 'development');
  // El modo test (adaptadores en memoria) jamás puede correr en el despliegue de producción real.
  if (appEnv === 'test' && e.VERCEL_ENV === 'production') {
    throw new Error('APP_ENV=test no está permitido en producción');
  }
  const isProduction = e.VERCEL_ENV === 'production' || (appEnv === 'production' && e.VERCEL_ENV === undefined);

  const monetizationMode = e.MONETIZATION_MODE ?? 'validation';
  const stripeActive = monetizationMode === 'stripe' && e.STRIPE_ENABLED === true;

  const appUrl = (e.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  const supabaseUrl = e.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = e.SUPABASE_SERVICE_ROLE_KEY;
  const google = {
    email: e.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: e.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    folderId: e.GOOGLE_DRIVE_FOLDER_ID,
    appRoot: e.GOOGLE_DRIVE_APP_ROOT ?? '/Apps/morrowage',
  };

  const sessionPepper =
    e.SESSION_PEPPER ??
    (serviceKey
      ? createHash('sha256').update(`morrowage:session-pepper:${serviceKey}`).digest('hex')
      : appEnv === 'production'
        ? ''
        : 'dev-only-session-pepper-not-for-production');

  const stripe = {
    secretKey: e.STRIPE_SECRET_KEY,
    webhookSecret: e.STRIPE_WEBHOOK_SECRET,
    priceId: e.STRIPE_PRICE_REPORT_USD,
  };

  return {
    appEnv,
    isProduction,
    appUrl,
    appVersion: e.APP_VERSION ?? '4.0.0',
    modelVersion: e.MODEL_VERSION ?? '2.1',
    monetizationMode,
    stripeActive,
    reportTokenTtlHours: positiveInt(e.REPORT_TOKEN_TTL_HOURS, 168, 'REPORT_TOKEN_TTL_HOURS'),
    reportRetentionDays: positiveInt(e.REPORT_RETENTION_DAYS, 30, 'REPORT_RETENTION_DAYS'),
    driveCacheTtlSeconds: positiveInt(e.DRIVE_CACHE_TTL_SECONDS, 86_400, 'DRIVE_CACHE_TTL_SECONDS'),
    supabaseUrl,
    supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: serviceKey,
    google,
    resendApiKey: e.RESEND_API_KEY,
    emailFrom: e.EMAIL_FROM,
    ownerEmail: e.OWNER_EMAIL,
    posthog: { key: e.NEXT_PUBLIC_POSTHOG_KEY, host: e.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com' },
    sentryDsn: e.SENTRY_DSN ?? e.NEXT_PUBLIC_SENTRY_DSN,
    turnstile: { siteKey: e.NEXT_PUBLIC_TURNSTILE_SITE_KEY, secretKey: e.TURNSTILE_SECRET_KEY },
    upstash: { url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN },
    stripe,
    sessionPepper,
    cronSecret: e.CRON_SECRET,
    privacyContactEmail: e.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL,
    capabilities: {
      supabase: Boolean(supabaseUrl && serviceKey),
      drive: Boolean(google.email && google.privateKey && google.folderId),
      email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
      turnstile: Boolean(e.TURNSTILE_SECRET_KEY && e.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
      rateLimitRedis: Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN),
      posthog: Boolean(e.NEXT_PUBLIC_POSTHOG_KEY),
      sentry: Boolean(e.SENTRY_DSN ?? e.NEXT_PUBLIC_SENTRY_DSN),
      stripe: Boolean(stripe.secretKey && stripe.webhookSecret && stripe.priceId),
    },
  };
}
