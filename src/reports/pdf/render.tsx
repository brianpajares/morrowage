import { createHash } from 'node:crypto';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ModelParams } from '@/lib/model/params';
import type { SourceRow } from '@/lib/drive/snapshot';
import type { Locale } from '@/lib/locales';
import type { ReportData } from '@/lib/report/types';
import { ReportDocument } from './ReportDocument';
import { PreviewDocument, toPreviewSafe } from './PreviewDocument';

export interface RenderedPdf {
  bytes: Uint8Array;
  sha256: string;
}

async function toRendered(buffer: Buffer): Promise<RenderedPdf> {
  const bytes = new Uint8Array(buffer);
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function renderReportPdf(input: {
  data: ReportData;
  locale: Locale;
  params: ModelParams;
  sources: SourceRow[];
  tokenExpiresAt: string;
  retentionDays: number;
}): Promise<RenderedPdf> {
  return toRendered(await renderToBuffer(<ReportDocument {...input} />));
}

/**
 * PDF de vista previa para el modo de pago: solo recibe el resumen gratuito (`toPreviewSafe`);
 * el resto se dibuja con barras sintéticas. Incluye enlaces de desbloqueo clicables.
 */
export async function renderPreviewPdf(input: {
  data: ReportData;
  locale: Locale;
  unlockUrl: string;
  priceLabel: string;
}): Promise<RenderedPdf> {
  const safe = toPreviewSafe(input.data);
  return toRendered(await renderToBuffer(<PreviewDocument safe={safe} locale={input.locale} unlockUrl={input.unlockUrl} priceLabel={input.priceLabel} />));
}
