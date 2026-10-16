/**
 * Integración del funnel `validation` de punta a punta con Store y buzón en memoria:
 * calculate → leads → entrega (PDF + emails) → informe por token → admin → borrado.
 * Cubre AT-09, AT-10, AT-11, AT-13, AT-15, AT-16, AT-17, AT-25 (parcial), AT-26, AT-27, AT-32.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextServer from 'next/server';
import { POST as calculatePost } from '@/app/api/calculate/route';
import { POST as leadsPost } from '@/app/api/leads/route';
import { GET as reportGet } from '@/app/api/report/[token]/route';
import { GET as pdfGet } from '@/app/api/report/[token]/pdf/route';
import { POST as deletePost } from '@/app/api/privacy/delete-request/route';
import { GET as adminLeadsGet } from '@/app/api/admin/leads/route';
import { GET as adminFunnelGet } from '@/app/api/admin/funnel/route';
import { POST as resendPost } from '@/app/api/admin/reports/[id]/resend/route';
import { POST as resolveDeletionPost } from '@/app/api/admin/deletion/[id]/route';
import { GET as healthGet } from '@/app/api/health/route';
import { calculateService } from '@/server/services/calculate';
import { createLeadService } from '@/server/services/leads';
import { lookupReport } from '@/server/services/report';
import { cleanupJob } from '@/server/services/cron';
import { testMailbox } from '@/server/email/send';
import { TEST_TURNSTILE_TOKEN } from '@/lib/security/turnstile';
import { hashToken } from '@/lib/security/tokens';
import { isVerificationId } from '@/lib/security/tokens';
import { estimateReportCostUsd, VALIDATION_COST_TARGET_USD } from '@/lib/ops/cost';
import { getBundledModelParams } from '@/lib/model/bundled';
import { calculate } from '@/lib/model/engine';
import { freshEnv, getReq, jsonReq, sessionFrom, silenceLogs, stubEnv, TC01, TC03, type TestEnv } from '../../tests/helpers';
import { extractText, getDocumentProxy } from 'unpdf';

// `after()` solo existe dentro de una petición de Next: en tests se captura para ejecutarlo a mano.
const scheduledByRoutes: Array<() => Promise<unknown>> = [];
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof NextServer>()),
  after: (task: () => Promise<unknown>) => void scheduledByRoutes.push(task),
}));

const EMAIL = 'persona.sintetica@morrowage.test';
let t: TestEnv;

async function runRoutes() {
  while (scheduledByRoutes.length) await scheduledByRoutes.shift()!();
}

async function calc(inputs: object = TC01, locale: 'es' | 'en' | 'pt' = 'es') {
  const res = await calculatePost(jsonReq('/api/calculate', { inputs, locale, scopeAccepted: true }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { calculationId: string; output: Record<string, unknown> };
  return { ...body, sid: sessionFrom(res), res };
}

async function requestLead(c: { calculationId: string; sid: string }, extra: object = {}, locale = 'es') {
  const res = await leadsPost(
    jsonReq(
      '/api/leads',
      { calculationId: c.calculationId, email: EMAIL, locale, serviceConsent: true, ...extra },
      { cookie: `ma_sid=${c.sid}` },
    ),
  );
  return res;
}

beforeEach(() => {
  t = freshEnv();
  scheduledByRoutes.length = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/calculate (AT-03, AT-07, AT-08)', () => {
  it('devuelve solo la vista previa segura y crea la sesión HttpOnly', async () => {
    const c = await calc();
    expect(c.res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(c.res.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
    expect(c.output.morrow_age_display).toBe('47.7');
    expect(Object.keys(c.output).sort()).toEqual(
      [
        'absolute_mortality_10y',
        'absolute_mortality_10y_status',
        'delta_age',
        'model_version',
        'morrow_age',
        'morrow_age_display',
        'morrow_age_reference_range',
        'morrow_age_status',
        'relative_hazard',
        'top_driver',
      ].sort(),
    );
    for (const locked of ['drivers', 'measurement_sensitivity', 'eta_nonage', 'delta_lp']) {
      expect(c.output).not.toHaveProperty(locked);
    }
    // El payload de salud solo vive en el store (retención corta), nunca en la respuesta.
    expect(JSON.stringify(c.output)).not.toContain('reaction_time_ms');
  });

  it('AT-08: fuera de 40–69 no hay raw, delta ni cifra exacta en la respuesta', async () => {
    const raw = calculate(TC03, getBundledModelParams());
    expect(raw.morrow_age_status).toBe('BELOW_REFERENCE_RANGE');
    const c = await calc(TC03);
    expect(c.output.morrow_age_display).toBe('<40');
    expect(c.output).not.toHaveProperty('morrow_age');
    expect(c.output).not.toHaveProperty('delta_age');
    const body = JSON.stringify(c.output);
    expect(body).not.toContain(String(raw.morrow_age));
    expect(body).not.toContain(raw.morrow_age.toFixed(1));
  });

  it('AT-03: rechaza entradas inválidas con códigos por campo y sin eco de valores', async () => {
    const res = await calculatePost(
      jsonReq('/api/calculate', { inputs: { ...TC01, age_years: 33, sleep_hours: 99.5 }, locale: 'en', scopeAccepted: true }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('invalid_inputs');
    expect(body.fields).toMatchObject({ age_years: 'out_of_scope', sleep_hours: 'out_of_range' });
    expect(JSON.stringify(body)).not.toContain('99.5');
  });

  it('AT-02: exige scopeAccepted=true', async () => {
    const res = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'es', scopeAccepted: false }));
    expect(res.status).toBe(400);
  });

  it('rechaza cuerpos que no son JSON, demasiado grandes o de otro origen', async () => {
    const wrongType = await calculatePost(new Request(`${'http://localhost:3000'}/api/calculate`, { method: 'POST', headers: { 'content-type': 'text/plain', origin: 'http://localhost:3000' }, body: '{}' }));
    expect(wrongType.status).toBe(415);
    const big = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'es', scopeAccepted: true, pad: 'x'.repeat(9000) }));
    expect(big.status).toBe(413);
    const evil = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'es', scopeAccepted: true }, { origin: 'https://evil.example' }));
    expect(evil.status).toBe(403);
  });

  it('AT-20: el cálculo es idéntico en es/en/pt para el mismo input canónico', async () => {
    const outs = [];
    for (const l of ['es', 'en', 'pt'] as const) outs.push((await calc(TC01, l)).output);
    expect(outs[1]).toEqual(outs[0]);
    expect(outs[2]).toEqual(outs[0]);
  });
});

describe('POST /api/leads → entrega (AT-09, AT-10, AT-13, AT-26, AT-27)', () => {
  it('crea el lead con consentimientos separados y entrega usuario + dueño con PDF', async () => {
    const c = await calc();
    const res = await requestLead(c, { marketingOptIn: false, subscriptionWaitlistOptIn: true });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { leadId: string; status: string; reportUrl: string };
    expect(body.status).toBe('accepted');
    expect(body.reportUrl).toMatch(/^http:\/\/localhost:3000\/es\/report\/[A-Za-z0-9_-]{43}$/);

    const [lead] = [...t.store.leads.values()];
    expect(lead).toMatchObject({ email: EMAIL, marketing_opt_in: false, marketing_consent_at: null, subscription_waitlist_opt_in: true, status: 'requested' });
    expect(lead!.service_consent_at).toBeTruthy();

    await runRoutes();

    // --- usuario (AT-10): enlace expirable, sin datos de salud, sin cobro
    const [toUser] = testMailbox.to(EMAIL);
    expect(toUser).toBeDefined();
    expect(toUser!.subject).toBe('Tu informe de MorrowAge está listo');
    expect(toUser!.html).toContain(body.reportUrl);
    expect(toUser!.text).toMatch(/caduca en 7 días/);
    for (const forbidden of ['reaction_time', '540', '47.7', 'cigarettes', 'self_rated_health']) {
      expect(toUser!.html + toUser!.text).not.toContain(forbidden);
    }
    expect(toUser!.attachments).toBeUndefined();

    // --- dueño (AT-13): asunto exacto, inputs, resultados y PDF completo
    const owner = testMailbox.to('owner@morrowage.test')[0]!;
    const verification = /MA-\d{2}-[0-9A-F]{6}/.exec(owner.subject)![0];
    expect(isVerificationId(verification)).toBe(true);
    expect(owner.subject).toBe(`[MorrowAge] Solicitud de informe ${verification}`);
    expect(owner.replyTo).toBe(EMAIL);
    for (const must of ['age_years', 'resting_hr_bpm', 'morrow_age (RAW', 'relative_hazard', '47.698551', EMAIL, 'sensibilidad']) {
      expect(owner.html + owner.text).toContain(must);
    }
    const pdf = owner.attachments?.find((a) => a.contentType === 'application/pdf');
    expect(pdf).toBeDefined();
    expect(Buffer.from(pdf!.content.slice(0, 5)).toString()).toBe('%PDF-');

    // --- el lead queda entregado y el informe registra el envío y el checksum del PDF
    const delivered = t.store.leads.get(body.leadId)!;
    expect(delivered.status).toBe('delivered');
    const report = [...t.store.reports.values()][0]!;
    expect(report.delivered_at).toBeTruthy();
    expect(report.last_sent_at).toBeTruthy();
    expect(report.pdf_checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.verification_id).toBe(verification);
    expect(report.access_tier).toBe('validation_full');
  });

  it('AT-10: sin cobro — no se crea ningún pedido en validation', async () => {
    const c = await calc();
    await requestLead(c);
    await runRoutes();
    expect(t.store.orders.size).toBe(0);
  });

  it('el token solo se guarda hasheado y expira según REPORT_TOKEN_TTL_HOURS (AT-11, FR-13)', async () => {
    const c = await calc();
    const res = await requestLead(c);
    const { reportUrl } = (await res.json()) as { reportUrl: string };
    const token = reportUrl.split('/').pop()!;
    const [report] = [...t.store.reports.values()];
    expect(report!.token_hash).toBe(hashToken(token));
    expect(JSON.stringify([...t.store.reports.values()])).not.toContain(token);
    const ttl = new Date(report!.token_expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(167 * 3_600_000);
    expect(ttl).toBeLessThanOrEqual(168 * 3_600_000);
  });

  it('validaciones: email inválido 400, consentimiento ausente 400, sesión ajena 403, cálculo inexistente 404', async () => {
    const c = await calc();
    const badEmail = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: 'no-es-email', locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${c.sid}` }));
    expect(badEmail.status).toBe(400);
    expect((await badEmail.json()).code).toBe('invalid_email');

    const noConsent = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: EMAIL, locale: 'es', serviceConsent: false }, { cookie: `ma_sid=${c.sid}` }));
    expect(noConsent.status).toBe(400);
    expect((await noConsent.json()).code).toBe('consent_required');

    const foreign = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: EMAIL, locale: 'es', serviceConsent: true }, { cookie: 'ma_sid=otra-sesion-distinta-0000' }));
    expect(foreign.status).toBe(403);
    const noCookie = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: EMAIL, locale: 'es', serviceConsent: true }));
    expect(noCookie.status).toBe(403);

    const missing = await leadsPost(jsonReq('/api/leads', { calculationId: crypto.randomUUID(), email: EMAIL, locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${c.sid}` }));
    expect(missing.status).toBe(404);
    expect(t.store.leads.size).toBe(0);
  });

  it('repetir la solicitud con el mismo email es idempotente (un lead) y rota el enlace', async () => {
    const c = await calc();
    const first = (await (await requestLead(c)).json()) as { reportUrl: string; leadId: string };
    const second = (await (await requestLead(c)).json()) as { reportUrl: string; leadId: string };
    expect(second.leadId).toBe(first.leadId);
    expect(second.reportUrl).not.toBe(first.reportUrl);
    expect(t.store.leads.size).toBe(1);
    expect(t.store.reports.size).toBe(1);
    const old = await lookupReport(t.store, first.reportUrl.split('/').pop()!);
    expect(old.status).toBe('not_found');
    // Otro email para el mismo cálculo: conflicto.
    const other = await leadsPost(jsonReq('/api/leads', { calculationId: c.calculationId, email: 'otra@morrowage.test', locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${c.sid}` }));
    expect(other.status).toBe(409);
  });

  it('AT-26: límite de peticiones (429 con Retry-After) y Turnstile cuando hay clave', async () => {
    const c = await calc();
    let limited = 0;
    for (let i = 0; i < 8; i++) {
      const r = await requestLead(c, {}, 'es');
      if (r.status === 429) {
        limited++;
        expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
      }
    }
    expect(limited).toBeGreaterThan(0);

    freshEnv();
    const restore = stubEnv({ TURNSTILE_SECRET_KEY: 'secret-test', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-test' });
    try {
      const c2 = await (async () => {
        const res = await calculatePost(jsonReq('/api/calculate', { inputs: TC01, locale: 'es', scopeAccepted: true }, { 'x-turnstile-token': TEST_TURNSTILE_TOKEN }));
        return { ...(await res.json()), sid: sessionFrom(res) } as { calculationId: string; sid: string };
      })();
      const without = await leadsPost(jsonReq('/api/leads', { calculationId: c2.calculationId, email: EMAIL, locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${c2.sid}` }));
      expect(without.status).toBe(403);
      expect((await without.json()).code).toBe('turnstile_failed');
      const withToken = await leadsPost(jsonReq('/api/leads', { calculationId: c2.calculationId, email: EMAIL, locale: 'es', serviceConsent: true }, { cookie: `ma_sid=${c2.sid}`, 'x-turnstile-token': TEST_TURNSTILE_TOKEN }));
      expect(withToken.status).toBe(201);
    } finally {
      restore();
    }
  });

  it('un fallo del proveedor de email deja el lead "failed" sin perder el informe web y el reintento lo entrega', async () => {
    const c = await calc();
    testMailbox.failNext('resend_domain_not_verified', { tag: 'user' });
    const res = await requestLead(c);
    const { reportUrl, leadId } = (await res.json()) as { reportUrl: string; leadId: string };
    await runRoutes();
    expect(t.store.leads.get(leadId)!.status).toBe('failed');
    expect(t.store.leads.get(leadId)!.delivery_error_class).toBe('resend_domain_not_verified');
    // El informe web sigue accesible con el enlace devuelto al usuario.
    expect((await lookupReport(t.store, reportUrl.split('/').pop()!)).status).toBe('ok');

    // Cron: reintento controlado de entregas no completadas (más de 10 minutos).
    const lead = t.store.leads.get(leadId)!;
    lead.created_at = new Date(Date.now() - 30 * 60_000).toISOString();
    const out = await cleanupJob();
    expect(out.retried).toBe(1);
    expect(t.store.leads.get(leadId)!.status).toBe('delivered');
    expect(testMailbox.to(EMAIL)).toHaveLength(1);
  });
});

describe('Informe por token (AT-11, AT-12, AT-27)', () => {
  async function issued(locale: 'es' | 'en' | 'pt' = 'es', inputs: object = TC01) {
    const c = await calc(inputs, locale);
    const { reportUrl } = (await (await requestLead(c, {}, locale)).json()) as { reportUrl: string };
    await runRoutes();
    return { token: reportUrl.split('/').pop()!, c };
  }
  const params = (token: string) => ({ params: Promise.resolve({ token }) });

  it('token válido abre el informe estructurado con ID de verificación y versiones', async () => {
    const { token } = await issued();
    const res = await reportGet(getReq(`/api/report/${token}`), params(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verificationId).toMatch(/^MA-\d{2}-[0-9A-F]{6}$/);
    expect(body.modelVersion).toBe('2.1');
    expect(body.accessTier).toBe('validation_full');
    expect(body.data.appVersion).toBe('4.0.0');
    expect(body.data.packageVersion).toBe('4.0');
    expect(body.data.drivers).toHaveLength(7);
    expect(body.data.sensitivity.base.display).toBe('47.7');
    expect(body.data.scenarios.length).toBeLessThanOrEqual(3);
    // AT-28: nunca valores personalizados de las funciones bloqueadas
    expect(JSON.stringify(body)).not.toMatch(/country_percentile|mortality_risk_10y/);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('AT-27: el Verification ID es aleatorio, único y no se deriva de email ni de datos de salud', async () => {
    await issued();
    const first = [...t.store.reports.values()][0]!;
    expect(first.verification_id).toMatch(/^MA-\d{2}-[0-9A-F]{6}$/);
    expect(first.verification_id.toLowerCase()).not.toContain('persona');
    // Mismo email y mismos datos en otro cálculo → otro ID distinto (no determinista).
    await issued();
    const ids = [...t.store.reports.values()].map((r) => r.verification_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
  });

  it('AT-11: token inexistente → 404 y token expirado → 410', async () => {
    const { token } = await issued();
    const bogus = 'x'.repeat(43);
    expect((await reportGet(getReq(`/api/report/${bogus}`), params(bogus))).status).toBe(404);
    const short = 'abc';
    expect((await reportGet(getReq(`/api/report/${short}`), params(short))).status).toBe(404);

    const [report] = [...t.store.reports.values()];
    report!.token_expires_at = new Date(Date.now() - 1000).toISOString();
    const expired = await reportGet(getReq(`/api/report/${token}`), params(token));
    expect(expired.status).toBe(410);
    expect((await expired.json()).code).toBe('token_expired');
    expect((await pdfGet(getReq(`/api/report/${token}/pdf`), params(token))).status).toBe(410);
  });

  it('AT-12 + AT-08: el PDF descargable tiene 13 páginas y censura el raw fuera de rango', async () => {
    const { token } = await issued('es', TC03);
    const res = await pdfGet(getReq(`/api/report/${token}/pdf`), params(token));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/MorrowAge-MA-\d{2}-[0-9A-F]{6}\.pdf/);
    const doc = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text, totalPages } = await extractText(doc, { mergePages: true });
    expect(totalPages).toBe(13);
    const flat = (text as string).replace(/\s+/g, ' ');
    expect(flat).toContain('<40');
    const raw = calculate(TC03, getBundledModelParams()).morrow_age;
    expect(flat).not.toContain(raw.toFixed(1));
    expect(flat).not.toContain(String(raw));
  });

  it('el PDF respeta ?locale= (en/pt) sin cambiar el resultado', async () => {
    const { token } = await issued('es');
    const res = await pdfGet(getReq(`/api/report/${token}/pdf?locale=en`), params(token));
    const doc = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(doc, { mergePages: true });
    expect(text as string).toContain('Measurement sensitivity');
    expect(text as string).toContain('47.7');
  });
});

describe('Admin (AT-16, AT-17) y borrado (AT-15)', () => {
  const ADMIN = '11111111-1111-4111-8111-111111111111';
  const USER = '22222222-2222-4222-8222-222222222222';

  async function seedLead() {
    const c = await calc();
    const { reportUrl } = (await (await requestLead(c)).json()) as { reportUrl: string };
    await runRoutes();
    return reportUrl.split('/').pop()!;
  }

  it('AT-16: sin sesión 401, usuario no admin 403', async () => {
    await seedLead();
    expect((await adminLeadsGet(getReq('/api/admin/leads'))).status).toBe(401);
    expect((await adminFunnelGet(getReq('/api/admin/funnel'))).status).toBe(401);
    const nonAdmin = await adminLeadsGet(getReq('/api/admin/leads', { 'x-test-user': USER }));
    expect(nonAdmin.status).toBe(403);
    const resend = await resendPost(jsonReq('/api/admin/reports/' + crypto.randomUUID() + '/resend', {}, { 'x-test-user': USER }), { params: Promise.resolve({ id: crypto.randomUUID() }) });
    expect(resend.status).toBe(403);
  });

  it('AT-17: el admin ve leads y funnel sin inputs, resultados crudos, tokens ni URLs', async () => {
    const token = await seedLead();
    t.store.admins.add(ADMIN);
    const res = await adminLeadsGet(getReq('/api/admin/leads', { 'x-test-user': ADMIN }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['createdAt', 'email', 'id', 'lastSentAt', 'locale', 'marketingOptIn', 'reportId', 'status', 'subscriptionWaitlistOptIn', 'verificationId'].sort(),
    );
    const serialized = JSON.stringify(body);
    for (const forbidden of ['age_years', 'reaction_time', '47.69', 'morrow_age', 'token', 'http://', token, 'input_payload']) {
      expect(serialized).not.toContain(forbidden);
    }
    const filtered = await adminLeadsGet(getReq('/api/admin/leads?status=failed', { 'x-test-user': ADMIN }));
    expect((await filtered.json()).items).toHaveLength(0);
    expect((await adminLeadsGet(getReq('/api/admin/leads?status=hack', { 'x-test-user': ADMIN }))).status).toBe(400);

    const funnel = await adminFunnelGet(getReq('/api/admin/funnel', { 'x-test-user': ADMIN }));
    expect(funnel.status).toBe(200);
    const f = await funnel.json();
    expect(f.leads.total).toBe(1);
    expect(f.cost.reports).toBe(1);
    expect(f.cost.avgUsdPerReport).toBeLessThanOrEqual(VALIDATION_COST_TARGET_USD);
    expect(JSON.stringify(f)).not.toContain(EMAIL);
  });

  it('reenvío admin: rota el token, entrega de nuevo y registra auditoría + last_sent_at', async () => {
    const token = await seedLead();
    t.store.admins.add(ADMIN);
    const [report] = [...t.store.reports.values()];
    const before = report!.last_sent_at;
    const res = await resendPost(jsonReq(`/api/admin/reports/${report!.id}/resend`, {}, { 'x-test-user': ADMIN }), { params: Promise.resolve({ id: report!.id }) });
    expect(res.status).toBe(202);
    await runRoutes();
    expect(testMailbox.to(EMAIL)).toHaveLength(2);
    // el enlace anterior ya no funciona
    expect((await lookupReport(t.store, token)).status).toBe('not_found');
    expect(t.store.reports.get(report!.id)!.last_sent_at).not.toBe(before);
    expect(t.store.auditLog.at(-1)).toMatchObject({ action: 'report.resend', admin_user_id: ADMIN });
    // el reenvío no vuelve a notificar al dueño con los datos sensibles
    expect(testMailbox.to('owner@morrowage.test')).toHaveLength(1);
  });

  it('AT-15: la solicitud de borrado queda registrada con estado y marca de tiempo, y el admin la resuelve', async () => {
    const token = await seedLead();
    const res = await deletePost(jsonReq('/api/privacy/delete-request', { email: EMAIL.toUpperCase(), locale: 'es', verificationId: null }));
    expect(res.status).toBe(202);
    const { requestId, status } = await res.json();
    expect(status).toBe('received');
    const row = t.store.deletionRequests[0]!;
    expect(row).toMatchObject({ id: requestId, email: EMAIL, status: 'received' });
    expect(row.created_at).toBeTruthy();

    const bad = await deletePost(jsonReq('/api/privacy/delete-request', { email: 'x@y.zz', locale: 'es', verificationId: 'no-valido' }));
    expect(bad.status).toBe(400);

    t.store.admins.add(ADMIN);
    const resolved = await resolveDeletionPost(jsonReq(`/api/admin/deletion/${requestId}`, {}, { 'x-test-user': ADMIN }), { params: Promise.resolve({ id: requestId }) });
    expect(resolved.status).toBe(200);
    expect((await resolved.json()).status).toBe('completed');
    expect(t.store.calculations.size).toBe(0);
    expect(t.store.leads.size).toBe(0);
    expect((await lookupReport(t.store, token)).status).toBe('not_found');
  });
});

describe('AT-25 · AT-32 · AT-34 · salud', () => {
  it('AT-25/AT-13: PostHog solo recibe eventos de la allowlist, sin email, inputs, raw ni token', async () => {
    const restore = stubEnv({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test_key' });
    const captured: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (String(url).includes('/capture/')) captured.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: 200 });
      }),
    );
    try {
      const c = await calc();
      const { reportUrl } = (await (await requestLead(c)).json()) as { reportUrl: string };
      await runRoutes();
      expect(captured.length).toBeGreaterThanOrEqual(4);
      const names = captured.map((e) => e.event);
      expect(names).toEqual(expect.arrayContaining(['calculation_start', 'calculation_success', 'email_submit', 'report_delivery_success']));
      const blob = JSON.stringify(captured);
      const token = reportUrl.split('/').pop()!;
      for (const forbidden of [EMAIL, 'persona.sintetica', token, '47.69', 'reaction_time', 'age_years', 'drivers', 'owner@', 'report/']) {
        expect(blob).not.toContain(forbidden);
      }
    } finally {
      vi.unstubAllGlobals();
      restore();
    }
  });

  it('AT-32: los logs de todo el flujo no contienen email, inputs de salud, token ni raw', async () => {
    const logs = silenceLogs();
    vi.stubEnv('LOG_LEVEL', 'debug');
    try {
      const c = await calc(TC03);
      testMailbox.failNext('resend_transient', { tag: 'user', times: 1 });
      const { reportUrl } = (await (await requestLead(c)).json()) as { reportUrl: string };
      await runRoutes();
      await healthGet(getReq('/api/health'));
      const raw = calculate(TC03, getBundledModelParams()).morrow_age;
      const joined = logs.calls.join('\n') + JSON.stringify(t.reports);
      const token = reportUrl.split('/').pop()!;
      for (const forbidden of [EMAIL, 'persona.sintetica', token, String(raw), raw.toFixed(1), 'reaction_time_ms', '"age_years"']) {
        expect(joined, forbidden).not.toContain(forbidden);
      }
    } finally {
      logs.restore();
      vi.unstubAllEnvs();
    }
  });

  it('AT-34: coste estimado por informe ≤ US$0.05 en validation', () => {
    expect(estimateReportCostUsd({ emails: 2 })).toBeLessThanOrEqual(VALIDATION_COST_TARGET_USD);
    expect(estimateReportCostUsd({ emails: 2 })).toBeCloseTo(0.0018, 6);
  });

  it('/api/health expone solo lo mínimo sin credencial y capacidades con CRON_SECRET', async () => {
    const anon = await healthGet(getReq('/api/health'));
    expect(anon.status).toBe(200);
    const body = await anon.json();
    expect(body).toMatchObject({ ok: true, appVersion: '4.0.0', modelVersion: '2.1', driveSnapshotStatus: 'valid' });
    expect(body).not.toHaveProperty('capabilities');

    const restore = stubEnv({ CRON_SECRET: 'cron-secret-test-0000' });
    try {
      const priv = await healthGet(getReq('/api/health', { authorization: 'Bearer cron-secret-test-0000' }));
      const pb = await priv.json();
      expect(pb.capabilities).toMatchObject({ supabase: false, email: false });
      expect(pb.monetization).toEqual({ mode: 'validation', stripeActive: false, paypalActive: false });
      const wrong = await healthGet(getReq('/api/health', { authorization: 'Bearer nope' }));
      expect(await wrong.json()).not.toHaveProperty('capabilities');
    } finally {
      restore();
    }
  });

  it('servicios sin ruta: calculateService y createLeadService son reutilizables', async () => {
    const r = await calculateService({ body: { inputs: TC01, locale: 'pt', scopeAccepted: true } });
    expect(r.newSessionId).toBeTruthy();
    const tasks: Array<() => Promise<unknown>> = [];
    const lead = await createLeadService(
      { body: { calculationId: r.calculationId, email: EMAIL, locale: 'pt', serviceConsent: true }, sessionId: r.newSessionId },
      { schedule: (x) => void tasks.push(x) },
    );
    expect(lead.mode).toBe('report');
    expect('reportUrl' in lead && lead.reportUrl).toContain('/pt/report/');
    for (const task of tasks) await task();
    expect(testMailbox.to(EMAIL)[0]!.subject).toBe('Seu relatório do MorrowAge está pronto');
  });
});
