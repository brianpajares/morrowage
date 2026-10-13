import { describe, expect, it } from 'vitest';
import { sanitizeEvent, EVENT_NAMES, bucketMs, bucketAttempts } from '@/lib/analytics/events';
import { redactDeep, redactString, sanitizeUrl } from '@/lib/observability/scrub';
import { getEnv } from '@/lib/env';
import { summarizeFunnel } from '@/lib/ops/funnel';
import { rateLimit, resetRateLimits, POLICIES } from '@/lib/security/ratelimit';
import { TEST_TURNSTILE_TOKEN, verifyTurnstile } from '@/lib/security/turnstile';
import { generateReportToken, generateVerificationId, hashToken, isPlausibleToken, isVerificationId, hashSession, safeEqual } from '@/lib/security/tokens';
import { stubEnv } from '../../tests/helpers';

const common = {
  event_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  session_id_pseudonymous: '0123456789abcdef0123456789abcdef',
  timestamp_utc: '2026-10-07T12:00:00.000Z',
  locale: 'es',
  market_hint_coarse: 'PE',
  model_version: '2.1',
  app_version: '4.0.0',
  device_class: 'mobile',
  experiment_ids: [],
};

describe('AT-25 · allowlist de analítica', () => {
  it('acepta eventos del spec con propiedades permitidas', () => {
    expect(sanitizeEvent({ name: 'landing_view', props: common }).ok).toBe(true);
    expect(sanitizeEvent({ name: 'input_step_complete', props: { ...common, step_id: 'reaction', elapsed_ms_bucket: '5_15s' } }).ok).toBe(true);
    expect(sanitizeEvent({ name: 'calculation_success', props: { ...common, morrow_age_status: 'BELOW_REFERENCE_RANGE' } }).ok).toBe(true);
    expect(sanitizeEvent({ name: 'email_submit', props: { ...common, marketing_opt_in: false } }).ok).toBe(true);
    expect(sanitizeEvent({ name: 'reaction_test_complete', props: { ...common, protocol_version: 'snap-v1', attempt_count_bucket: '2' } }).ok).toBe(true);
  });

  it('rechaza eventos y propiedades fuera del contrato', () => {
    expect(sanitizeEvent({ name: 'page_view', props: common })).toMatchObject({ ok: false, reason: 'unknown_event' });
    expect(sanitizeEvent({ name: 'landing_view', props: { ...common, extra: 'x' } })).toMatchObject({ ok: false });
    expect(sanitizeEvent({ name: 'landing_view', props: { ...common, locale: 'fr' } })).toMatchObject({ ok: false, reason: 'invalid_value' });
    expect(sanitizeEvent(null)).toMatchObject({ ok: false });
    expect(sanitizeEvent({ name: 'landing_view', props: [] })).toMatchObject({ ok: false });
  });

  it('bloquea email, inputs de salud, raw, contribuciones, tokens y URLs aunque se disfracen', () => {
    const attempts: Array<[string, Record<string, unknown>]> = [
      ['email_submit', { email: 'a@b.co', marketing_opt_in: true }],
      ['preview_view', { morrow_age_status: 'WITHIN_REFERENCE_RANGE', morrow_age: 47.7 }],
      ['reaction_test_complete', { protocol_version: 'snap-v1', reaction_time_ms: 540 }],
      ['input_step_complete', { step_id: 'age', age_years: 52 }],
      ['report_view', { access_tier: 'validation_full', report_url: 'https://x/report/abc' }],
      ['report_view', { access_tier: 'validation_full', token: 'a'.repeat(43) }],
      ['preview_view', { morrow_age_status: 'WITHIN_REFERENCE_RANGE', driver: 'sleep_hours' }],
      ['calculation_error', { error_code: 'x@y.zz' }],
      ['calculation_error', { error_code: 'A'.repeat(50) }],
      ['source_open', { source_id: 'https://evil' }],
    ];
    for (const [name, props] of attempts) {
      const r = sanitizeEvent({ name, props: { ...common, ...props } });
      expect(r.ok, `${name} ${JSON.stringify(props)}`).toBe(false);
    }
  });

  it('cada evento del spec existe y los buckets son estables', () => {
    expect(EVENT_NAMES).toHaveLength(32);
    expect(bucketMs(2_000)).toBe('lt_5s');
    expect(bucketMs(61_000)).toBe('60_90s');
    expect(bucketMs(400_000)).toBe('gte_180s');
    expect(bucketAttempts(1)).toBe('1');
    expect(bucketAttempts(9)).toBe('6_plus');
  });
});

describe('redacción (AT-32, AT-23)', () => {
  it('redacta emails, tokens, JWT, Bearer y rutas /report/', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    const out = redactString(`a ana@example.test b Bearer eyJabcdefgh.ijklmnopqr.stuvwxyz12 /es/report/${token}?x=1 ${token}`);
    expect(out).not.toContain('ana@');
    expect(out).not.toContain(token);
    expect(out).not.toContain('eyJabc');
    expect(out).toContain('/es/report/[token]');
  });

  it('redactDeep oculta claves sensibles y de salud y soporta ciclos', () => {
    const obj: Record<string, unknown> = { email: 'x@y.zz', nested: { age_years: 52, ok: 'bien', inputs: { a: 1 } }, list: [{ password: 'p' }] };
    obj.self = obj;
    const out = JSON.stringify(redactDeep(obj));
    expect(out).not.toContain('x@y.zz');
    expect(out).not.toContain('52');
    expect(out).toContain('bien');
    expect(out).toContain('[circular]');
  });

  it('sanitizeUrl descarta query y fragmento y enmascara tokens', () => {
    expect(sanitizeUrl('https://morrowage.test/es/report/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG?a=1#x')).toBe('https://morrowage.test/es/report/[token]');
  });
});

describe('env (placeholders, flags y modo test)', () => {
  it('los valores de ejemplo de .env.example cuentan como "no configurado"', () => {
    const restore = stubEnv({ RESEND_API_KEY: 're_REPLACE_ME', EMAIL_FROM: 'MorrowAge <reports@YOUR_DOMAIN>', NEXT_PUBLIC_SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'YOUR_SUPABASE_SERVICE_ROLE_KEY' });
    try {
      const e = getEnv();
      expect(e.resendApiKey).toBeUndefined();
      expect(e.capabilities).toMatchObject({ email: false, supabase: false });
    } finally {
      restore();
    }
  });

  it('Stripe exige MONETIZATION_MODE=stripe Y STRIPE_ENABLED=true', () => {
    for (const [mode, flag, expected] of [['validation', 'true', false], ['stripe', 'false', false], ['stripe', 'true', true], ['validation', 'false', false]] as const) {
      const restore = stubEnv({ MONETIZATION_MODE: mode, STRIPE_ENABLED: flag });
      try {
        expect(getEnv().stripeActive, `${mode}/${flag}`).toBe(expected);
      } finally {
        restore();
      }
    }
  });

  it('APP_ENV=test está prohibido en producción real de Vercel', () => {
    const restore = stubEnv({ APP_ENV: 'test', VERCEL_ENV: 'production' });
    try {
      expect(() => getEnv()).toThrow(/no está permitido/);
    } finally {
      restore();
    }
  });

  it('valida números y rechaza un modo de monetización desconocido', () => {
    let restore = stubEnv({ REPORT_TOKEN_TTL_HOURS: 'abc' });
    try {
      expect(() => getEnv()).toThrow();
    } finally {
      restore();
    }
    restore = stubEnv({ MONETIZATION_MODE: 'free' });
    try {
      expect(() => getEnv()).toThrow();
    } finally {
      restore();
    }
  });

  it('por defecto validation + Stripe apagado y TTL de 168 h', () => {
    const e = getEnv();
    expect(e.monetizationMode).toBe('validation');
    expect(e.stripeActive).toBe(false);
    expect(e.reportTokenTtlHours).toBe(168);
    expect(e.reportRetentionDays).toBe(30);
  });
});

describe('tokens y sesión (FR-13, AT-27)', () => {
  it('tokens de ≥256 bits, únicos, y hash SHA-256 estable', () => {
    const a = generateReportToken();
    const b = generateReportToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(43);
    expect(isPlausibleToken(a)).toBe(true);
    expect(isPlausibleToken('corto')).toBe(false);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toContain(a);
  });

  it('Verification ID con formato MA-YY-XXXXXX', () => {
    const id = generateVerificationId(new Date('2026-10-07T00:00:00Z'));
    expect(id).toMatch(/^MA-26-[0-9A-F]{6}$/);
    expect(isVerificationId(id)).toBe(true);
    expect(isVerificationId('MA-26-ZZZZZZ')).toBe(false);
  });

  it('hash de sesión dependiente del pepper y comparación en tiempo constante', () => {
    expect(hashSession('sid', 'p1')).not.toBe(hashSession('sid', 'p2'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('rate limit y Turnstile (AT-26)', () => {
  it('ventana deslizante en memoria: bloquea al superar el límite y devuelve retry-after', async () => {
    resetRateLimits();
    const policy = { name: 't', limit: 3, windowSeconds: 60 };
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect((await rateLimit(policy, 'ip1', now + i)).allowed).toBe(true);
    const blocked = await rateLimit(policy, 'ip1', now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit(policy, 'ip2', now + 10)).allowed).toBe(true); // otro cliente no se ve afectado
    expect((await rateLimit(policy, 'ip1', now + 61_000)).allowed).toBe(true); // la ventana expira
    expect(POLICIES.leads.limit).toBeLessThanOrEqual(5);
  });

  it('Turnstile: con clave exige token válido; el token mock solo existe en APP_ENV=test', async () => {
    const restore = stubEnv({ TURNSTILE_SECRET_KEY: 'secret-test' });
    try {
      expect(await verifyTurnstile(null)).toEqual({ ok: false, reason: 'missing_token' });
      expect(await verifyTurnstile(TEST_TURNSTILE_TOKEN)).toEqual({ ok: true, skipped: false });
      const rejecting = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
      expect(await verifyTurnstile('token-real', '1.2.3.4', rejecting as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rejected' });
      const accepting = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
      expect(await verifyTurnstile('token-real', '1.2.3.4', accepting as unknown as typeof fetch)).toEqual({ ok: true, skipped: false });
      const down = async () => {
        throw new Error('network');
      };
      expect(await verifyTurnstile('token-real', undefined, down as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unavailable' });
    } finally {
      restore();
    }
    // En producción real un token con el valor mock no se acepta (el entorno test está prohibido).
    const prod = stubEnv({ APP_ENV: 'production', VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret-test' });
    try {
      const rejecting = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
      expect(await verifyTurnstile(TEST_TURNSTILE_TOKEN, undefined, rejecting as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rejected' });
    } finally {
      prod();
    }
  });
});

describe('funnel agregado (FR-14, AT-17)', () => {
  const rows = (event: string, dim: string, count: number, locale: 'es' | 'en' | 'pt' = 'es') => ({ day: '2026-10-07', locale, event, dim, count });

  it('calcula conversiones, mediana de tiempo, coste y umbrales sin tocar PII', () => {
    const counters = [
      rows('landing_view', '', 1000),
      rows('calculate_start_click', 'direct', 600),
      rows('assessment_complete', '30_60s', 300),
      rows('assessment_complete', '60_90s', 120),
      rows('assessment_complete', 'gte_180s', 30),
      rows('calculation_start', '', 450),
      rows('calculation_error', 'x', 2),
      rows('preview_view', 'WITHIN_REFERENCE_RANGE', 400),
      rows('preview_view', 'BELOW_REFERENCE_RANGE', 50, 'en'),
      rows('email_submit', 'true', 120),
      rows('report_delivery_success', '', 118),
      rows('report_delivery_fail', 'x', 2),
      rows('report_view', 'validation_full', 60),
      rows('input_step_view', 'age', 600),
      rows('input_step_complete', 'age', 590),
      rows('ops_reports_generated', 'initial', 118),
      rows('ops_report_cost_micro_usd', 'initial', 118 * 1800),
    ];
    const s = summarizeFunnel(counters, { total: 120, byStatus: { delivered: 118, failed: 2 }, byLocale: { es: 100, en: 20 }, marketingOptIns: 40, waitlistOptIns: 10 }, 14);
    expect(s.conversions.visitToStart).toBe(0.6);
    expect(s.conversions.previewToGate).toBeCloseTo(120 / 450, 3);
    expect(s.conversions.reportOpenRate).toBeCloseTo(60 / 118, 3);
    expect(s.conversions.deliveryFailRate).toBeCloseTo(2 / 120, 3);
    expect(s.medianTimeBucket).toBe('30_60s');
    expect(s.outOfRangeRate).toBeCloseTo(50 / 450, 3);
    expect(s.cost.reports).toBe(118);
    expect(s.cost.avgUsdPerReport).toBe(0.0018);
    expect(s.stepFunnel[0]).toEqual({ stepId: 'age', views: 600, completes: 590 });
    expect(s.byLocale).toEqual({ es: 400, en: 50 });
    const gate = s.thresholds.find((x) => x.metric === 'email_gate_conversion')!;
    expect(gate.status).toBe('met'); // 26.7 % sobre 450 vistas
    expect(s.thresholds.find((x) => x.metric === 'calculator_completion_rate')!.status).toBe('met');
    expect(s.thresholds.find((x) => x.metric === 'full_report_open_rate')!.status).toBe('met');
    expect(s.thresholds.find((x) => x.metric === 'purchase_intent_or_WTP_USD19')!.status).toBe('not_measured');
  });

  it('con muestra insuficiente no declara umbrales cumplidos y no divide por cero', () => {
    const s = summarizeFunnel([], { total: 0, byStatus: {}, byLocale: {}, marketingOptIns: 0, waitlistOptIns: 0 }, 14);
    expect(s.conversions.visitToStart).toBeNull();
    expect(s.thresholds.every((x) => x.status === 'insufficient_sample' || x.status === 'not_measured')).toBe(true);
    expect(s.cost.avgUsdPerReport).toBeNull();
  });
});
