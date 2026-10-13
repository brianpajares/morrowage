import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import vectors from '@spec/test_vectors.json';
import { getBundledModelParams } from '@/lib/model/bundled';
import { calculate } from '@/lib/model/engine';
import { loadBundledSnapshot } from '@/lib/drive/bundled';
import { buildReportData } from '@/lib/report/build';
import { LOCALES, type Locale } from '@/lib/locales';
import { renderReportPdf } from './render';
import { pdfText } from './sanitize';
import type { Inputs } from '@/lib/model/input-spec';

const params = getBundledModelParams();
const snapshot = loadBundledSnapshot(1);

async function pdfFor(vectorId: string, locale: Locale) {
  const v = vectors.vectors.find((x) => x.id === vectorId)!;
  const inputs = v.inputs as Inputs;
  const out = calculate(inputs, params);
  const data = buildReportData({
    inputs,
    output: out,
    params,
    verificationId: 'MA-26-8F3C2A',
    appVersion: '4.0.0',
    accessTier: 'validation_full',
    locale,
    generatedAt: '2026-10-07T12:00:00.000Z',
  });
  const pdf = await renderReportPdf({
    data,
    locale,
    params,
    sources: snapshot.sources,
    tokenExpiresAt: '2026-10-14T12:00:00.000Z',
    retentionDays: 30,
  });
  const doc = await getDocumentProxy(new Uint8Array(pdf.bytes));
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  // Normaliza saltos de línea del layout para comparar frases completas.
  return { out, data, pdf, text: (text as string).replace(/\s+/g, ' '), totalPages };
}

describe('AT-12 · PDF del informe', () => {
  it('es un PDF válido de 8 páginas con los bloques exigidos (ES)', async () => {
    const { pdf, text, totalPages } = await pdfFor('TC01', 'es');
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(totalPages).toBe(8);
    expect(pdf.sha256).toMatch(/^[0-9a-f]{64}$/);

    expect(text).toContain('MA-26-8F3C2A'); // Verification ID
    expect(text).toContain('Model 2.1'); // versión del modelo
    expect(text).toContain('Sensibilidad de medición');
    expect(text).toContain('No es un intervalo de confianza');
    expect(text).toContain('Qué se asocia con tu resultado'); // drivers
    expect(text).toContain('Escenarios educativos, no predicciones causales');
    expect(text).toContain('Metodología y límites'); // metodología
    expect(text).toContain('Estimación educativa poblacional'); // disclaimer
    expect(text).toContain('No es consejo médico'); // footer en cada página
    expect(text).toContain('3,8622'); // coeficiente β_log_age visible
    expect(text).toContain('47.7'); // MorrowAge de presentación (dentro de rango)
  });

  it('se genera en ES, EN y PT con la misma cifra de presentación', async () => {
    for (const locale of LOCALES) {
      const { text, totalPages } = await pdfFor('TC01', locale);
      expect(totalPages, locale).toBe(8);
      expect(text, locale).toContain('47.7');
      expect(text, locale).toContain('MA-26-8F3C2A');
    }
    const en = (await pdfFor('TC01', 'en')).text;
    expect(en).toContain('Measurement sensitivity');
    expect(en).toContain('This is not a confidence interval');
    const pt = (await pdfFor('TC01', 'pt')).text;
    expect(pt).toContain('Sensibilidade de medição');
    expect(pt).toContain('Não é um intervalo de confiança');
  });

  it('AT-08: fuera de 40–69 muestra <40 / >69 y nunca el raw exacto', async () => {
    for (const [id, display] of [['TC03', '<40'], ['TC16', '>69']] as const) {
      const { out, text } = await pdfFor(id, 'es');
      expect(text).toContain(display);
      const rawStr = String(out.morrow_age);
      expect(text).not.toContain(rawStr);
      // ni el raw redondeado a 1 decimal ni a la parte entera con decimales
      expect(text).not.toContain(out.morrow_age.toFixed(1));
      expect(text).not.toContain(out.morrow_age.toFixed(2));
      expect(text).not.toContain(String(out.delta_age));
    }
  });

  it('AT-28: no incluye riesgo absoluto a 10 años ni percentiles como valores personalizados', async () => {
    const { text } = await pdfFor('TC01', 'es');
    expect(text.toLowerCase()).not.toMatch(/mortalidad a 10 años: *\d/);
    expect(text.toLowerCase()).not.toMatch(/percentil *\d/);
    expect(text).toContain('Probabilidad absoluta de mortalidad a 10 años'); // listada como BLOQUEADA
  });

  it('el saneador de glifos transliterará caracteres fuera de WinAnsi', () => {
    expect(pdfText('β_log_age − Δ ≥ 3')).toBe('beta_log_age - Delta >= 3');
  });
});
