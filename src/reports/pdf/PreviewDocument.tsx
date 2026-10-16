/**
 * PDF de VISTA PREVIA (modo de pago). Garantía de diseño: este componente NO recibe el informe
 * completo, solo `PreviewSafe` (lo mismo que ya ve el usuario gratis en pantalla: MorrowAge con los
 * guardrails <40/>69, hazard relativo y la asociación principal). Todo lo bloqueado se dibuja con
 * barras y formas sintéticas de longitud FIJA (iguales para todas las personas): en PDF no existe un
 * «blur» real —el texto con opacidad sigue siendo extraíble— así que los valores bloqueados nunca se
 * escriben. Tampoco se ordenan las asociaciones por peso (el orden revelaría el ranking).
 */
import React from 'react';
import { Link, Document, Page, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { Locale } from '@/lib/locales';
import { getMessages, type Messages } from '@/messages';
import { DRIVER_FIELDS, type DriverField } from '@/lib/model/engine';
import { FULL_REPORT_PAGES } from '@/lib/report/extras';
import { formatDate, formatNumber, interp } from '@/lib/report/format';
import type { ReportData } from '@/lib/report/types';
import { PdfAgeScale } from './ReportDocument';
import { pdfText } from './sanitize';

const C = {
  primary: '#0F766E',
  primaryDark: '#115E59',
  text: '#0F172A',
  muted: '#475569',
  border: '#CBD5E1',
  surface: '#F1F5F9',
  ink: '#64748B',
  white: '#FFFFFF',
  amber: '#B45309',
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: C.text, lineHeight: 1.45 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.primary },
  badge: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.amber, borderWidth: 1, borderColor: C.amber, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  meta: { fontSize: 8.5, color: C.muted, textAlign: 'right' },
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 8, lineHeight: 1.15 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  p: { marginBottom: 6, fontSize: 10 },
  muted: { color: C.muted, fontSize: 9 },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  callout: { borderLeftWidth: 4, borderLeftColor: C.primary, backgroundColor: C.surface, padding: 10, marginVertical: 8, borderRadius: 4 },
  lockedTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 10 },
  lockedTagText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#78350F' },
  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  watermark: { position: 'absolute', top: 330, left: 20, right: 20, alignItems: 'center', transform: 'rotate(-30deg)' },
  watermarkText: { fontSize: 64, fontFamily: 'Helvetica-Bold', color: C.text, opacity: 0.07 },
  bigNumber: { fontSize: 64, fontFamily: 'Helvetica-Bold', color: C.primary, lineHeight: 1 },
  button: { backgroundColor: C.primary, color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 12.5, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 7, textDecoration: 'none' },
  bullet: { flexDirection: 'row', marginBottom: 5 },
  bulletDot: { width: 14, color: C.primary, fontFamily: 'Helvetica-Bold' },
});

/** Lo único que la vista previa conoce del informe: el contenido ya público de `free_preview`. */
export interface PreviewSafe {
  verificationId: string;
  generatedAt: string;
  locale: Locale;
  chronologicalAge: number;
  referenceRange: [number, number];
  result: ReportData['result'];
  topDriver: DriverField;
}

export function toPreviewSafe(data: ReportData): PreviewSafe {
  return {
    verificationId: data.verificationId,
    generatedAt: data.generatedAt,
    locale: data.locale,
    chronologicalAge: data.chronologicalAge,
    referenceRange: data.referenceRange,
    result: data.result,
    topDriver: data.topDriver.field,
  };
}

export interface PreviewDocumentProps {
  safe: PreviewSafe;
  locale: Locale;
  unlockUrl: string;
  /** Precio ya formateado, p. ej. `US$19`. */
  priceLabel: string;
}

const T = ({ children, style }: { children: React.ReactNode; style?: Style | Style[] }) => (
  <Text style={style}>{typeof children === 'string' ? pdfText(children) : children}</Text>
);

/** Barra «difuminada»: tres capas grises superpuestas (opacidad 0,05 / 0,08 / 0,13), sin texto. */
function Smudge({ w, h = 9 }: { w: number | string; h?: number }) {
  return (
    <View style={{ width: w, height: h, position: 'relative' }}>
      <View style={{ position: 'absolute', top: -2, left: -3, right: -3, bottom: -2, borderRadius: h, backgroundColor: C.ink, opacity: 0.05 }} />
      <View style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: h, backgroundColor: C.ink, opacity: 0.08 }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: h / 2, backgroundColor: C.ink, opacity: 0.13 }} />
    </View>
  );
}

/** Longitudes fijas, iguales para todos: no codifican ningún dato real. */
const PATTERN = [0.62, 0.46, 0.7, 0.4, 0.56, 0.66, 0.44];

function UnlockButton({ url, label }: { url: string; label: string }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Link src={url} style={s.button}>
        {pdfText(label)}
      </Link>
    </View>
  );
}

function UnlockCard({ safe, msg, url, priceLabel }: { safe: PreviewSafe; msg: Messages; url: string; priceLabel: string }) {
  const p = msg.report.preview;
  return (
    <View style={[s.card, { borderColor: C.primary, borderWidth: 1.5, backgroundColor: '#F0FDFA' }]} wrap={false}>
      <T style={[s.h3, { fontSize: 13 }]}>{p.unlockTitle}</T>
      <T style={[s.p, { marginBottom: 8 }]}>{p.unlockBody}</T>
      <UnlockButton url={url} label={interp(p.unlockCta, { price: priceLabel })} />
      <T style={[s.muted, { marginTop: 8 }]}>{p.linkFallback}</T>
      <Link src={url} style={{ fontSize: 7.5, color: C.primaryDark }}>
        {pdfText(url)}
      </Link>
      <T style={[s.muted, { marginTop: 4, fontSize: 8 }]}>{`${msg.report.verification.id}: ${safe.verificationId}`}</T>
    </View>
  );
}

/** Misma regla que el informe completo: numeración estática, sin `render` (rompe el pie en react-pdf). */
const PREVIEW_PAGES = 5;

function Shell({ title, page, msg, safe, url, children }: { title: string; page: number; msg: Messages; safe: PreviewSafe; url: string; children: React.ReactNode }) {
  const p = msg.report.preview;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.watermark} fixed>
        <T style={s.watermarkText}>{p.badge}</T>
      </View>
      <View style={s.brandRow} fixed>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T style={s.brand}>MorrowAge</T>
          <T style={s.badge}>{p.badge}</T>
        </View>
        <Link src={url} style={{ fontSize: 8.5, color: C.primary, fontFamily: 'Helvetica-Bold' }}>
          {pdfText(`${msg.report.verification.id}: ${safe.verificationId}`)}
        </Link>
      </View>
      <View style={s.footer} fixed>
        <T>{`MorrowAge · ${safe.verificationId} · ${p.footer}`}</T>
        <T>{interp(msg.report.pageOf, { n: page, total: PREVIEW_PAGES })}</T>
      </View>
      <T style={s.h1}>{title}</T>
      {children}
    </Page>
  );
}

function LockedTag({ msg }: { msg: Messages }) {
  return (
    <View style={s.lockedTag}>
      <T style={s.lockedTagText}>{`${msg.report.preview.lockedTag}  ·  ${msg.report.preview.hidden}`}</T>
    </View>
  );
}

export function PreviewDocument({ safe, locale, unlockUrl, priceLabel }: PreviewDocumentProps) {
  const msg = getMessages(locale);
  const r = msg.report;
  const p = r.preview;
  const dateLabel = formatDate(locale, safe.generatedAt);
  const within = safe.result.value !== undefined;
  const hr = formatNumber(locale, safe.result.relativeHazard, 2, 2);
  const shell = { msg, safe, url: unlockUrl };
  const sentence =
    safe.result.status === 'WITHIN_REFERENCE_RANGE' ? interp(msg.preview.within, { age: safe.result.display }) : safe.result.status === 'BELOW_REFERENCE_RANGE' ? msg.preview.below : msg.preview.above;
  const dataForScale = { referenceRange: safe.referenceRange, chronologicalAge: safe.chronologicalAge, result: safe.result };

  return (
    <Document
      title={pdfText(`${p.title} ${safe.verificationId}`)}
      author="MorrowAge"
      subject={pdfText(msg.meta.description)}
      creator="MorrowAge"
      producer="MorrowAge"
      language={locale}
    >
      {/* 1 · Lo que ya ves gratis + desbloqueo */}
      <Page size="A4" style={s.page}>
        <View style={s.watermark} fixed>
          <T style={s.watermarkText}>{p.badge}</T>
        </View>
        <View style={s.brandRow} fixed>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={s.brand}>MorrowAge</T>
            <T style={s.badge}>{p.badge}</T>
          </View>
          <T style={s.meta}>{`${r.verification.id}: ${safe.verificationId}\n${dateLabel} · ${locale.toUpperCase()}`}</T>
        </View>
        <View style={s.footer} fixed>
          <T>{`MorrowAge · ${safe.verificationId} · ${p.footer}`}</T>
          <T>{interp(r.pageOf, { n: 1, total: PREVIEW_PAGES })}</T>
        </View>
        <T style={s.h1}>{p.title}</T>
        <T style={[s.p, { marginBottom: 10 }]}>{p.page1Intro}</T>
        <View style={s.card}>
          <T style={s.muted}>{`${r.chronological}: ${safe.chronologicalAge}`}</T>
          <T style={s.bigNumber}>{safe.result.display}</T>
          <T style={[s.p, { marginTop: 6, fontFamily: 'Helvetica-Bold' }]}>{sentence}</T>
          {!within ? <T style={s.muted}>{msg.preview.boundaryNote}</T> : null}
        </View>
        <PdfAgeScale data={dataForScale} msg={msg} />
        <View style={s.callout}>
          <T style={s.p}>{msg.preview.not_bio}</T>
          <T style={s.muted}>{interp(r.hazardLine, { hr })}</T>
        </View>
        <View style={[s.card, { marginBottom: 12 }]}>
          <T style={s.h3}>{msg.preview.driverTitle}</T>
          <T style={s.p}>{interp(msg.preview.driver, { driver: msg.variables[safe.topDriver].driver })}</T>
          <T style={s.muted}>{msg.preview.driverNote}</T>
        </View>
        <UnlockCard safe={safe} msg={msg} url={unlockUrl} priceLabel={priceLabel} />
      </Page>

      {/* 2 · Sensibilidad (bloqueada) */}
      <Shell {...shell} page={2} title={r.sensitivity}>
        <LockedTag msg={msg} />
        <T style={s.p}>{p.sensitivityBody}</T>
        <View style={s.card}>
          <Svg width={507} height={64} viewBox="0 0 507 64">
            <Rect x={28} y={30} width={451} height={8} rx={4} fill={C.surface} stroke={C.border} strokeWidth={0.8} />
            <Rect x={150} y={29} width={200} height={10} rx={5} fill={C.ink} fillOpacity={0.12} />
            <Rect x={140} y={24} width={20} height={20} rx={10} fill={C.ink} fillOpacity={0.1} />
            <Rect x={244} y={22} width={24} height={24} rx={12} fill={C.ink} fillOpacity={0.13} />
            <Rect x={340} y={24} width={20} height={20} rx={10} fill={C.ink} fillOpacity={0.1} />
          </Svg>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Smudge w={90} />
            <Smudge w={70} />
            <Smudge w={90} />
          </View>
        </View>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
            <View style={{ width: '38%' }}>
              <T style={{ fontSize: 9 }}>{msg.variables[DRIVER_FIELDS[i]!].label}</T>
            </View>
            <View style={{ width: '20%' }}><Smudge w={40} /></View>
            <View style={{ width: '20%' }}><Smudge w={34} /></View>
            <View style={{ width: '20%' }}><Smudge w={34} /></View>
          </View>
        ))}
        <View style={{ marginTop: 14 }}>
          <UnlockButton url={unlockUrl} label={interp(p.unlockCta, { price: priceLabel })} />
        </View>
      </Shell>

      {/* 3 · Asociaciones (bloqueadas, sin orden por peso) */}
      <Shell {...shell} page={3} title={r.drivers}>
        <LockedTag msg={msg} />
        <T style={s.p}>{p.driversBody}</T>
        <View style={s.card}>
          {DRIVER_FIELDS.map((f, i) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
              <View style={{ width: '34%' }}>
                <T style={{ fontSize: 9 }}>{msg.variables[f].label}</T>
              </View>
              <View style={{ width: '66%', alignItems: 'flex-start' }}>
                <Smudge w={`${Math.round(PATTERN[i]! * 100)}%`} h={12} />
              </View>
            </View>
          ))}
        </View>
        {DRIVER_FIELDS.map((f, i) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
            <View style={{ width: '34%' }}>
              <T style={{ fontSize: 9 }}>{msg.variables[f].label}</T>
            </View>
            <View style={{ width: '22%' }}><Smudge w={30 + (i % 3) * 8} /></View>
            <View style={{ width: '22%' }}><Smudge w={34 + (i % 2) * 10} /></View>
            <View style={{ width: '22%' }}><Smudge w={28} /></View>
          </View>
        ))}
        <View style={{ marginTop: 14 }}>
          <UnlockButton url={unlockUrl} label={interp(p.unlockCta, { price: priceLabel })} />
        </View>
      </Shell>

      {/* 4 · Escenarios (bloqueados) */}
      <Shell {...shell} page={4} title={r.scenarios.title}>
        <LockedTag msg={msg} />
        <T style={s.p}>{p.scenariosBody}</T>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.card} wrap={false}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              <Smudge w={120} h={11} />
              <Smudge w={50} h={11} />
              <Smudge w={50} h={11} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[r.scenarios.baseline, r.scenarios.scenario, r.scenarios.difference].map((l) => (
                <View key={l} style={{ flex: 1 }}>
                  <T style={s.muted}>{l}</T>
                  <View style={{ marginTop: 5 }}>
                    <Smudge w={54} h={16} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={s.callout}>
          <T style={s.p}>{r.scenarios.disclaimer}</T>
        </View>
      </Shell>

      {/* 5 · Qué incluye el informe completo + desbloqueo final */}
      <Shell {...shell} page={5} title={`${p.includesTitle} (${interp(p.includesPages, { pages: FULL_REPORT_PAGES })})`}>
        <View style={s.card}>
          {p.includes.map((it) => (
            <View key={it} style={s.bullet} wrap={false}>
              <T style={s.bulletDot}>+</T>
              <T style={{ flex: 1 }}>{it}</T>
            </View>
          ))}
        </View>
        <UnlockCard safe={safe} msg={msg} url={unlockUrl} priceLabel={priceLabel} />
        <View style={s.callout}>
          <T style={s.p}>{msg.report.disclaimer}</T>
        </View>
      </Shell>
    </Document>
  );
}
