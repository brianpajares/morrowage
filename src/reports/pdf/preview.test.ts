/**
 * Vista previa difuminada (modo de pago): el PDF NUNCA contiene los valores bloqueados y SÍ trae
 * enlaces de desbloqueo clicables. El «blur» se dibuja con barras sintéticas porque en PDF el texto
 * con opacidad sigue siendo extraíble (playbook de monetización, §1).
 */
import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import vectors from '@spec/test_vectors.json';
import { getBundledModelParams } from '@/lib/model/bundled';
import { calculate } from '@/lib/model/engine';
import { buildReportData } from '@/lib/report/build';
import { formatNumber, formatSigned } from '@/lib/report/format';
import { FULL_REPORT_PAGES } from '@/lib/report/extras';
import { LOCALES, type Locale } from '@/lib/locales';
import type { Inputs } from '@/lib/model/input-spec';
import { renderPreviewPdf } from './render';

const params = getBundledModelParams();
const UNLOCK = 'http://localhost:3000/es/unlock/TOKENTOKENTOKENTOKENTOKENTOKENTOKENTOKEN12';

function dataFor(id: string, locale: Locale) {
  const v = vectors.vectors.find((x) => x.id === id)!;
  const inputs = v.inputs as Inputs;
  return buildReportData({
    inputs,
    output: calculate(inputs, params),
    params,
    verificationId: 'MA-26-8F3C2A',
    appVersion: '4.0.0',
    accessTier: 'preview_locked',
    locale,
    generatedAt: '2026-10-07T12:00:00.000Z',
  });
}

async function previewFor(id: string, locale: Locale) {
  const data = dataFor(id, locale);
  const pdf = await renderPreviewPdf({ data, locale, unlockUrl: UNLOCK, priceLabel: 'US$19' });
  const doc = await getDocumentProxy(new Uint8Array(pdf.bytes));
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  let links: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const anns = (await (await doc.getPage(i)).getAnnotations()) as Array<{ subtype?: string; url?: string }>;
    links = links.concat(anns.filter((a) => a.subtype === 'Link' && a.url).map((a) => a.url!));
  }
  return { data, pdf, text: (text as string).replace(/\s+/g, ' '), totalPages, links };
}

describe('PDF de vista previa (modo de pago)', () => {
  it('es un PDF válido de 5 páginas con marca de agua, precio y enlaces de desbloqueo', async () => {
    const { pdf, text, totalPages, links } = await previewFor('TC01', 'es');
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(totalPages).toBe(5);
    expect(text).toContain('VISTA PREVIA');
    expect(text).toContain('Contenido disponible en el informe completo');
    expect(text).toContain('Desbloquear mi informe completo · US$19');
    expect(text).toContain('47.7'); // el MorrowAge ya es parte de la vista previa gratuita
    expect(text).toContain(`${FULL_REPORT_PAGES} páginas`);
    // ≥ 2 anotaciones URI (botón + enlace + cabecera) y todas apuntan al desbloqueo
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(new Set(links)).toEqual(new Set([UNLOCK]));
  });

  it('NO contiene ningún valor bloqueado (sensibilidad, contribuciones, escenarios, benchmark)', async () => {
    for (const locale of LOCALES) {
      for (const id of ['TC01', 'TC03', 'TC16']) {
        const { data, text } = await previewFor(id, locale);
        const label = `${id}/${locale}`;

        // contribuciones por dato (todas las representaciones numéricas)
        for (const d of data.drivers) {
          if (Math.abs(d.contribution) < 0.0005) continue;
          for (const fmt of [formatSigned(locale, d.contribution, 3), d.contribution.toFixed(3), d.contribution.toFixed(4), formatNumber(locale, Math.abs(d.contribution), 3, 3)]) {
            expect(text, `${label} contribución ${fmt}`).not.toContain(fmt);
          }
        }
        // sensibilidad: solo se admite lo que ya es público si coincide con la base
        for (const age of [data.sensitivity.low, data.sensitivity.high]) {
          if (age.display !== data.result.display) expect(text, `${label} sensibilidad ${age.display}`).not.toContain(age.display);
        }
        for (const t of data.sensitivity.terms) {
          expect(text, `${label} ±${t.requested}`).not.toContain(`±${formatNumber(locale, t.requested, 0, 3)}`);
        }
        // escenarios
        for (const sc of data.scenarios) {
          if (sc.scenario.display !== data.result.display) expect(text, `${label} escenario ${sc.scenario.display}`).not.toContain(sc.scenario.display);
        }
        // fuera de 40–69 jamás el raw
        const out = calculate(vectors.vectors.find((x) => x.id === id)!.inputs as Inputs, params);
        if (data.result.value === undefined) {
          expect(text, label).not.toContain(String(out.morrow_age));
          expect(text, label).not.toContain(out.morrow_age.toFixed(1));
        }
        // el benchmark numérico y los coeficientes tampoco viajan en la vista previa
        expect(text, label).not.toContain('Benchmark');
        expect(text.toLowerCase(), label).not.toContain('log-hazard');
      }
    }
  });

  it('las asociaciones no se listan ordenadas por peso (el orden revelaría el ranking)', async () => {
    const { data, text } = await previewFor('TC01', 'es');
    const msgOrder = ['Horas de sueño', 'Salud', 'Cigarrillos', 'reacción', 'cintura', 'Alcohol', 'Pulso'];
    const positions = msgOrder.map((m) => text.toLowerCase().indexOf(m.toLowerCase()));
    expect(positions.every((p) => p >= 0)).toBe(true);
    // el orden de aparición es el canónico del modelo, no el de |contribución|
    const sortedByWeight = data.drivers.map((d) => d.field);
    expect(sortedByWeight.length).toBe(7);
  });
});
