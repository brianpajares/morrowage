/**
 * Rate limiting server-side (FR-23, AT-26).
 * Referencia: Upstash Redis (sliding window). Sin Redis configurado cae a una ventana en memoria
 * por instancia (mejor esfuerzo; /api/health expone `capabilities.rateLimitRedis`).
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getEnv } from '@/lib/env';

export interface RateLimitPolicy {
  /** Nombre lógico (prefijo de clave). */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const POLICIES = {
  calculate: { name: 'calculate', limit: 30, windowSeconds: 60 },
  leads: { name: 'leads', limit: 5, windowSeconds: 600 },
  leadsPerEmail: { name: 'leads-email', limit: 3, windowSeconds: 3600 },
  deleteRequest: { name: 'delete-request', limit: 3, windowSeconds: 3600 },
  report: { name: 'report', limit: 60, windowSeconds: 60 },
  events: { name: 'events', limit: 240, windowSeconds: 60 },
  checkout: { name: 'checkout', limit: 10, windowSeconds: 600 },
  adminLogin: { name: 'admin-login', limit: 8, windowSeconds: 600 },
  admin: { name: 'admin', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

// --- memoria (fallback) -------------------------------------------------------------------------
const memory = new Map<string, number[]>();

function memoryLimit(key: string, policy: RateLimitPolicy, now: number): RateLimitResult {
  const windowMs = policy.windowSeconds * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= policy.limit) {
    const oldest = hits[0] ?? now;
    memory.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  memory.set(key, hits);
  // Limpieza oportunista para no crecer sin límite.
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.length === 0 || now - (v.at(-1) ?? 0) > windowMs) memory.delete(k);
  }
  return { allowed: true, remaining: policy.limit - hits.length, retryAfterSeconds: 0 };
}

/** Solo tests. */
export function resetRateLimits(): void {
  memory.clear();
}

// --- Upstash -------------------------------------------------------------------------------------
const limiters = new Map<string, Ratelimit>();

function upstashLimiter(policy: RateLimitPolicy, url: string, token: string): Ratelimit {
  const id = `${policy.name}:${policy.limit}:${policy.windowSeconds}`;
  let rl = limiters.get(id);
  if (!rl) {
    rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
      prefix: `morrowage:rl:${policy.name}`,
      analytics: false,
    });
    limiters.set(id, rl);
  }
  return rl;
}

export async function rateLimit(
  policy: RateLimitPolicy,
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const env = getEnv();
  const { url, token } = env.upstash;
  if (url && token) {
    try {
      const res = await upstashLimiter(policy, url, token).limit(identifier);
      return {
        allowed: res.success,
        remaining: res.remaining,
        retryAfterSeconds: res.success ? 0 : Math.max(1, Math.ceil((res.reset - now) / 1000)),
      };
    } catch {
      // Redis caído: degradamos a memoria en lugar de abrir o romper el endpoint.
    }
  }
  return memoryLimit(`${policy.name}:${identifier}`, policy, now);
}

/** IP del cliente tras el proxy de Vercel. No se persiste en claro: se hashea para las claves. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || headers.get('x-real-ip') || 'unknown';
}
