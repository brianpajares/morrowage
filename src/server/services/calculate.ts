/**
 * POST /api/calculate — valida los 8 inputs, calcula con el motor v2.1 y guarda el cálculo
 * (payload de salud con retención corta). Devuelve SOLO la vista previa segura (free_preview):
 * nada de raw fuera de 40–69, ni eta/Δlp, ni drivers completos, ni sensibilidad.
 */
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { getModelSnapshot } from '@/lib/drive/loader';
import { calculate } from '@/lib/model/engine';
import { toPreviewOutput, type PreviewOutput } from '@/lib/model/display';
import { validateInputs } from '@/lib/model/validate';
import { LOCALES, type Locale } from '@/lib/locales';
import { hashSession, newSessionId } from '@/lib/security/tokens';
import { getStore } from '@/server/store';
import { trackServer } from '@/server/analytics';
import { ApiError } from '@/server/http';

const bodySchema = z.strictObject({
  inputs: z.unknown(),
  locale: z.enum(LOCALES),
  marketHintCoarse: z.string().max(8).nullable().optional(),
  scopeAccepted: z.literal(true),
});

export interface CalculateResult {
  calculationId: string;
  output: PreviewOutput;
  expiresAt: string;
  /** Si el navegador no tenía sesión, se crea una y el handler la envía como cookie HttpOnly. */
  newSessionId?: string;
}

export async function calculateService(opts: {
  body: unknown;
  sessionId?: string;
  psid?: string;
  deviceClass?: 'mobile' | 'tablet' | 'desktop';
}): Promise<CalculateResult> {
  const parsed = bodySchema.safeParse(opts.body);
  if (!parsed.success) throw new ApiError(400, 'invalid_request');
  const { locale, scopeAccepted: _scope } = parsed.data;
  const market = /^[A-Za-z]{2}$/.test(parsed.data.marketHintCoarse ?? '')
    ? parsed.data.marketHintCoarse!.toUpperCase()
    : null;

  const ctx = { locale, psid: opts.psid, market, deviceClass: opts.deviceClass };
  await trackServer('calculation_start', {}, ctx);

  const validation = validateInputs(parsed.data.inputs);
  if (!validation.ok) {
    await trackServer('calculation_error', { error_code: 'invalid_inputs' }, ctx);
    // Solo códigos por campo; jamás los valores enviados.
    throw new ApiError(400, 'invalid_inputs', { fields: validation.errors });
  }

  const env = getEnv();
  let output;
  try {
    const snapshot = await getModelSnapshot();
    output = calculate(validation.data, snapshot.params);
  } catch (err) {
    await trackServer('calculation_error', { error_code: 'model_unavailable' }, ctx);
    throw err;
  }

  const sessionId = opts.sessionId && /^[A-Za-z0-9-]{20,80}$/.test(opts.sessionId) ? opts.sessionId : newSessionId();
  const now = new Date();
  const expires = new Date(now.getTime() + env.reportRetentionDays * 86_400_000);

  const row = await getStore().insertCalculation({
    session_hash: hashSession(sessionId, env.sessionPepper),
    locale: locale as Locale,
    market_hint_coarse: market,
    input_payload: validation.data,
    output_payload: output,
    model_version: output.model_version,
    app_version: env.appVersion,
    scope_accepted_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });

  await trackServer('calculation_success', { morrow_age_status: output.morrow_age_status }, ctx);

  return {
    calculationId: row.id,
    output: toPreviewOutput(output),
    expiresAt: row.expires_at,
    ...(sessionId !== opts.sessionId ? { newSessionId: sessionId } : {}),
  };
}
