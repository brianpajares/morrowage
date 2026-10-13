import { getModelSnapshot } from '@/lib/drive/loader';
import { getEnv } from '@/lib/env';
import { isLocale } from '@/lib/locales';
import { POLICIES } from '@/lib/security/ratelimit';
import { renderReportPdf } from '@/reports/pdf/render';
import { trackServer } from '@/server/analytics';
import { ApiError, clientContext, enforceRateLimit, handler } from '@/server/http';
import { buildDataForReport, lookupReport } from '@/server/services/report';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** GET /api/report/{token}/pdf — PDF completo. Idioma: ?locale=es|en|pt (por defecto, el del cálculo). */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.report, ctx.ipKey);
  const { token } = await params;

  const found = await lookupReport(getStore(), token);
  if (found.status === 'not_found') throw new ApiError(404, 'report_not_found');
  if (found.status === 'expired') throw new ApiError(410, 'token_expired');

  const requested = new URL(req.url).searchParams.get('locale');
  const locale = isLocale(requested) ? requested : found.calc.locale;
  const data = (await buildDataForReport(found.calc, found.report, locale)) ?? found.data;
  const snapshot = await getModelSnapshot();
  const pdf = await renderReportPdf({
    data,
    locale,
    params: snapshot.params,
    sources: snapshot.sources,
    tokenExpiresAt: found.report.token_expires_at,
    retentionDays: getEnv().reportRetentionDays,
  });

  await trackServer('report_download_pdf', { access_tier: found.report.access_tier }, { locale, fallbackSessionId: found.calc.session_hash, psid: ctx.psid });

  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="MorrowAge-${data.verificationId}.pdf"`,
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
});
