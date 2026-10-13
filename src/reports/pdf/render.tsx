import { createHash } from 'node:crypto';
import { renderToBuffer } from '@react-pdf/renderer';
import type { ModelParams } from '@/lib/model/params';
import type { SourceRow } from '@/lib/drive/snapshot';
import type { Locale } from '@/lib/locales';
import type { ReportData } from '@/lib/report/types';
import { ReportDocument } from './ReportDocument';

export interface RenderedPdf {
  bytes: Uint8Array;
  sha256: string;
}

export async function renderReportPdf(input: {
  data: ReportData;
  locale: Locale;
  params: ModelParams;
  sources: SourceRow[];
  tokenExpiresAt: string;
  retentionDays: number;
}): Promise<RenderedPdf> {
  const buffer = await renderToBuffer(<ReportDocument {...input} />);
  const bytes = new Uint8Array(buffer);
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}
