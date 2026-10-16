/**
 * Informe PDF (FR-12, AT-12, AT-08, AT-27). Copia fiel del informe web — `ux/report_layout.md`:
 * 13 páginas (ver DECISIONS.md 2026-10-16), sin claims adicionales; `<40`/`>69` fuera de 40–69; "Sensibilidad de medición" con la
 * nota "No es un intervalo de confianza"; todos los gráficos con tabla/texto equivalente.
 * Fuente estándar Helvetica (sin descargas de fuentes en runtime); texto saneado a WinAnsi.
 */
import React from 'react';
import { Circle, Document, G, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { Locale } from '@/lib/locales';
import { getMessages, type Messages } from '@/messages';
import type { ReportData } from '@/lib/report/types';
import type { ModelParams } from '@/lib/model/params';
import { formatDate, formatInputValue, formatNumber, formatSigned, interp } from '@/lib/report/format';
import { buildProfileRows, FULL_REPORT_PAGES, GUIDE_FIELDS, topDriverFields, type ProfileRow } from '@/lib/report/extras';
import { pdfText } from './sanitize';
import type { SafeAge } from '@/lib/model/display';
import type { SourceRow } from '@/lib/drive/snapshot';

const C = {
  primary: '#0F766E',
  primaryDark: '#115E59',
  text: '#0F172A',
  muted: '#475569',
  border: '#CBD5E1',
  surface: '#F1F5F9',
  slate: '#334155',
  white: '#FFFFFF',
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: C.text, lineHeight: 1.45 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.primary },
  meta: { fontSize: 8.5, color: C.muted, textAlign: 'right' },
  eyebrow: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 8, lineHeight: 1.15 },
  h2: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  p: { marginBottom: 6, fontSize: 10 },
  muted: { color: C.muted, fontSize: 9 },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  callout: { borderLeftWidth: 4, borderLeftColor: C.primary, backgroundColor: C.surface, padding: 10, marginVertical: 8, borderRadius: 4 },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, color: C.primary, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 4 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.muted },
  td: { fontSize: 9 },
  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  bigNumber: { fontSize: 64, fontFamily: 'Helvetica-Bold', color: C.primary, lineHeight: 1 },
});

const T = ({ children, style }: { children: React.ReactNode; style?: Style | Style[] }) => (
  <Text style={style}>{typeof children === 'string' ? pdfText(children) : children}</Text>
);

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View>
      {items.map((it) => (
        <View key={it} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>-</Text>
          <T style={s.bulletText}>{it}</T>
        </View>
      ))}
    </View>
  );
}

/**
 * La numeración es estática (cada sección ocupa exactamente una página; el test de PDF fija el total).
 * No se usa `render` de react-pdf: dentro del pie fijo hace que el pie completo desaparezca del PDF.
 */
function PageShell({ title, page, msg, children, locale, verificationId, modelVersion, dateLabel }: {
  title: string;
  page: number;
  msg: Messages;
  children: React.ReactNode;
  locale: Locale;
  verificationId: string;
  modelVersion: string;
  dateLabel: string;
}) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.brandRow} fixed>
        <T style={s.brand}>MorrowAge</T>
        <T style={s.meta}>{`${msg.report.verification.id}: ${verificationId}\nModel ${modelVersion} · ${dateLabel} · ${locale.toUpperCase()}`}</T>
      </View>
      <View style={s.footer} fixed>
        <T>{msg.footer.notMedical}</T>
        <T>{interp(msg.report.pageOf, { n: page, total: FULL_REPORT_PAGES })}</T>
      </View>
      <T style={s.h1}>{title}</T>
      {children}
    </Page>
  );
}

// ---- Gráficos -----------------------------------------------------------------------------------
const CW = 507;
const PADX = 28;
const xOf = (v: number, range: readonly [number, number]) => PADX + ((Math.min(range[1], Math.max(range[0], v)) - range[0]) / (range[1] - range[0])) * (CW - PADX * 2);

function Ticks({ range, y }: { range: readonly [number, number]; y: number }) {
  return (
    <G>
      {[range[0], 50, 60, range[1]].map((t) => (
        <G key={t}>
          <Line x1={xOf(t, range)} x2={xOf(t, range)} y1={y + 8} y2={y + 14} stroke={C.muted} strokeWidth={1} />
          <Text x={xOf(t, range)} y={y + 26} textAnchor="middle" style={{ fontSize: 9 }} fill={C.muted}>{String(t)}</Text>
        </G>
      ))}
    </G>
  );
}

export function PdfAgeScale({ data, msg }: { data: Pick<ReportData, 'referenceRange' | 'chronologicalAge' | 'result'>; msg: Messages }) {
  const range = data.referenceRange;
  const Y = 46;
  const within = data.result.value !== undefined;
  const cx = xOf(data.chronologicalAge, range);
  const mx = within ? xOf(data.result.value!, range) : data.result.status === 'BELOW_REFERENCE_RANGE' ? xOf(range[0], range) : xOf(range[1], range);
  return (
    <Svg width={CW} height={96} viewBox={`0 0 ${CW} 96`}>
      <Rect x={PADX} y={Y - 5} width={CW - PADX * 2} height={10} rx={5} fill={C.surface} stroke={C.border} strokeWidth={0.8} />
      <Line x1={Math.min(cx, mx)} x2={Math.max(cx, mx)} y1={Y} y2={Y} stroke={C.primary} strokeWidth={5} strokeOpacity={0.45} />
      <Circle cx={cx} cy={Y} r={9} fill={C.white} stroke={C.text} strokeWidth={3} />
      {within ? (
        <Circle cx={mx} cy={Y} r={11} fill={C.primary} />
      ) : (
        <Path
          d={data.result.status === 'BELOW_REFERENCE_RANGE' ? `M ${mx + 3} ${Y - 11} L ${mx - 10} ${Y} L ${mx + 3} ${Y + 11} Z` : `M ${mx - 3} ${Y - 11} L ${mx + 10} ${Y} L ${mx - 3} ${Y + 11} Z`}
          fill={C.primary}
        />
      )}
      <Text x={cx} y={Y - 18} textAnchor="middle" style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }} fill={C.text}>
        {pdfText(`${msg.report.chronological}: ${data.chronologicalAge}`)}
      </Text>
      <Text x={Math.min(Math.max(mx, PADX + 50), CW - PADX - 50)} y={Y + 36} textAnchor="middle" style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }} fill={C.primary}>
        {pdfText(`${msg.report.morrowAge}: ${data.result.display}`)}
      </Text>
      <Ticks range={range} y={Y + 12} />
    </Svg>
  );
}

function PdfRangePlot({ data, msg }: { data: ReportData; msg: Messages }) {
  const range = data.referenceRange;
  const Y = 40;
  const pts: Array<{ label: string; age: SafeAge }> = [
    { label: msg.report.sens.low, age: data.sensitivity.low },
    { label: msg.report.sens.base, age: data.sensitivity.base },
    { label: msg.report.sens.high, age: data.sensitivity.high },
  ];
  const xs = pts.map((p) => (p.age.value !== undefined ? xOf(p.age.value, range) : p.age.status === 'BELOW_REFERENCE_RANGE' ? xOf(range[0], range) : xOf(range[1], range)));
  return (
    <Svg width={CW} height={96} viewBox={`0 0 ${CW} 96`}>
      <Rect x={PADX} y={Y - 4} width={CW - PADX * 2} height={8} rx={4} fill={C.surface} stroke={C.border} strokeWidth={0.8} />
      <Line x1={Math.min(...xs)} x2={Math.max(...xs)} y1={Y} y2={Y} stroke={C.primary} strokeWidth={4} strokeOpacity={0.5} />
      {pts.map((p, i) => (
        <G key={p.label}>
          {p.age.value !== undefined ? (
            <Circle cx={xs[i]!} cy={Y} r={i === 1 ? 9 : 7} fill={i === 1 ? C.primary : C.white} stroke={C.primary} strokeWidth={2.5} />
          ) : (
            <Path
              d={p.age.status === 'BELOW_REFERENCE_RANGE' ? `M ${xs[i]! + 3} ${Y - 9} L ${xs[i]! - 8} ${Y} L ${xs[i]! + 3} ${Y + 9} Z` : `M ${xs[i]! - 3} ${Y - 9} L ${xs[i]! + 8} ${Y} L ${xs[i]! - 3} ${Y + 9} Z`}
              fill={C.primary}
            />
          )}
          <Text x={i === 1 ? Math.min(Math.max(xs[i]!, PADX + 28), CW - PADX - 28) : i === 0 ? Math.max(xs[i]! + 10, PADX + 90) : Math.min(xs[i]! - 10, CW - PADX - 90)} y={i === 1 ? Y - 16 : Y + 34} textAnchor={i === 1 ? 'middle' : i === 0 ? 'end' : 'start'} style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }} fill={C.text}>
            {pdfText(`${p.label}: ${p.age.display}`)}
          </Text>
        </G>
      ))}
      <Ticks range={range} y={Y + 6} />
    </Svg>
  );
}

function PdfDriversChart({ data, locale, msg }: { data: ReportData; locale: Locale; msg: Messages }) {
  const rowH = 24;
  const labelW = 150;
  const valueW = 58;
  const barW = CW - labelW - valueW - 10;
  const max = Math.max(0.0001, ...data.drivers.map((d) => Math.abs(d.contribution)));
  const mid = labelW + barW / 2;
  const H = data.drivers.length * rowH + 8;
  return (
    <Svg width={CW} height={H} viewBox={`0 0 ${CW} ${H}`}>
      <Line x1={mid} x2={mid} y1={0} y2={H} stroke={C.muted} strokeWidth={0.8} />
      {data.drivers.map((d, i) => {
        const y = i * rowH + 4;
        const w = (Math.abs(d.contribution) / max) * (barW / 2 - 4);
        const x = d.contribution >= 0 ? mid : mid - w;
        return (
          <G key={d.field}>
            <Text x={0} y={y + 14} style={{ fontSize: 9 }} fill={C.text}>{pdfText(msg.variables[d.field].label)}</Text>
            <Rect x={x} y={y + 3} width={Math.max(w, 1.5)} height={14} rx={2} fill={d.contribution >= 0 ? C.slate : C.primary} />
            <Text x={CW} y={y + 14} textAnchor="end" style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }} fill={C.text}>{pdfText(formatSigned(locale, d.contribution, 3))}</Text>
          </G>
        );
      })}
    </Svg>
  );
}

function ProfileLine({ row, locale, msg }: { row: ProfileRow; locale: Locale; msg: Messages }) {
  const p = msg.report.profile;
  const userText = formatInputValue(locale, row.field, row.userValue, msg);
  const benchText =
    row.benchmarkValue === null ? msg.variables.benchmarkWeighted : row.field === 'cigarettes_per_day' ? msg.variables.benchmarkNever : formatInputValue(locale, row.field, row.benchmarkValue, msg);
  const posText = row.position === 'category' ? p.category : row.position === 'above' ? p.above : row.position === 'below' ? p.below : p.near;
  const W = 150;
  const px = (f: number) => 4 + f * (W - 8);
  return (
    <View style={[s.tr, { alignItems: 'center', paddingVertical: 8 }]} wrap={false}>
      <T style={[s.td, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>{msg.variables[row.field].label}</T>
      <View style={{ width: '33%' }}>
        {row.userFrac !== undefined && row.benchFrac !== undefined ? (
          <Svg width={W} height={22} viewBox={`0 0 ${W} 22`}>
            <Rect x={0} y={8} width={W} height={6} rx={3} fill={C.surface} stroke={C.border} strokeWidth={0.6} />
            <Line x1={px(row.benchFrac)} x2={px(row.benchFrac)} y1={3} y2={19} stroke={C.slate} strokeWidth={1.6} />
            <Circle cx={px(row.userFrac)} cy={11} r={5.5} fill={C.primary} />
          </Svg>
        ) : (
          <T style={s.muted}>{p.srhNote}</T>
        )}
      </View>
      <View style={{ width: '42%' }}>
        <T style={s.td}>{`${p.yourValue}: ${userText}`}</T>
        <T style={s.muted}>{`${p.benchmark}: ${benchText}`}</T>
        <T style={[s.muted, { color: C.primary, fontFamily: 'Helvetica-Bold' }]}>{posText}</T>
      </View>
    </View>
  );
}

function LabeledLine({ label, text }: { label: string; text: string }) {
  return (
    <Text style={{ fontSize: 8.6, marginBottom: 1, lineHeight: 1.35 }}>
      <Text style={{ fontFamily: 'Helvetica-Bold', color: C.primaryDark }}>{pdfText(`${label}: `)}</Text>
      {pdfText(text)}
    </Text>
  );
}

const LOG_WIDTHS = [14, 7, 8, 9, 8, 11, 10, 10, 8, 15];

function LogTable({ msg }: { msg: Messages }) {
  const c = msg.report.followup.logColumns;
  const heads = [c.date, c.age, c.sleep, c.health, c.cigs, c.reaction, c.wthr, c.alcohol, c.rhr, c.result];
  return (
    <View style={{ borderWidth: 0.8, borderColor: C.muted, marginTop: 6 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.surface }}>
        {heads.map((h, i) => (
          <T key={h} style={[s.th, { width: `${LOG_WIDTHS[i]}%`, padding: 4, borderRightWidth: i === heads.length - 1 ? 0 : 0.5, borderRightColor: C.border }]}>{h}</T>
        ))}
      </View>
      {Array.from({ length: 8 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', height: 24, borderTopWidth: 0.5, borderTopColor: C.border }}>
          {LOG_WIDTHS.map((w, i) => (
            <View key={i} style={{ width: `${w}%`, borderRightWidth: i === LOG_WIDTHS.length - 1 ? 0 : 0.5, borderRightColor: C.border }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ---- Documento ----------------------------------------------------------------------------------
export interface ReportDocumentProps {
  data: ReportData;
  locale: Locale;
  params: ModelParams;
  sources: SourceRow[];
  /** ISO de expiración del enlace web. */
  tokenExpiresAt: string;
  retentionDays: number;
}

const SOURCE_IDS = ['S01', 'S02', 'S09', 'S10'] as const;

function TableRow({ cells, widths, head }: { cells: string[]; widths: number[]; head?: boolean }) {
  return (
    <View style={s.tr} wrap={false}>
      {cells.map((c, i) => (
        <T key={i} style={[head ? s.th : s.td, { width: `${widths[i]}%` }]}>{c}</T>
      ))}
    </View>
  );
}

export function ReportDocument({ data, locale, params, sources, tokenExpiresAt, retentionDays }: ReportDocumentProps) {
  const msg = getMessages(locale);
  const r = msg.report;
  const dateLabel = formatDate(locale, data.generatedAt);
  const shell = { msg, locale, verificationId: data.verificationId, modelVersion: data.modelVersion, dateLabel };
  const within = data.result.value !== undefined;
  const hr = formatNumber(locale, data.result.relativeHazard, 2, 2);
  const pct = (n: number) => formatNumber(locale, n, 0, 4);

  const deltaText = (() => {
    if (data.result.delta === undefined) return data.result.status === 'BELOW_REFERENCE_RANGE' ? r.rangeBelow : r.rangeAbove;
    const d = data.result.delta;
    const years = formatNumber(locale, Math.abs(d), 1, 1);
    if (Math.abs(d) < 0.05) return msg.preview.deltaSame;
    return d < 0 ? interp(msg.preview.deltaLower, { years }) : interp(msg.preview.deltaHigher, { years });
  })();

  return (
    <Document
      title={pdfText(`${r.pdfTitle} ${data.verificationId}`)}
      author="MorrowAge"
      subject={pdfText(msg.meta.description)}
      creator="MorrowAge"
      producer="MorrowAge"
      language={locale}
    >
      {/* 1 · Resumen */}
      <PageShell {...shell} page={1} title={r.pdfSummaryPage}>
        <T style={s.eyebrow}>{msg.preview.eyebrow}</T>
        <View style={s.card}>
          <T style={s.muted}>{`${r.chronological}: ${data.chronologicalAge}`}</T>
          <T style={s.bigNumber}>{data.result.display}</T>
          <T style={[s.p, { marginTop: 6, fontFamily: 'Helvetica-Bold' }]}>{r.summaryMessage}</T>
          <T style={s.muted}>{deltaText}</T>
          {!within ? <T style={[s.muted, { marginTop: 4 }]}>{msg.preview.boundaryNote}</T> : null}
        </View>
        <PdfAgeScale data={data} msg={msg} />
        <View style={s.callout}>
          <T style={s.p}>{msg.preview.not_bio}</T>
          <T style={s.muted}>{interp(r.hazardLine, { hr })}</T>
        </View>
        <T style={s.h3}>{r.verification.title}</T>
        <T style={s.muted}>{`${r.verification.id}: ${data.verificationId}`}</T>
        <T style={s.muted}>{interp(r.verification.versions, { model: data.modelVersion, app: data.appVersion, pkg: data.packageVersion })}</T>
      </PageShell>

      {/* 2 · Qué significa */}
      <PageShell {...shell} page={2} title={r.pdfMeaningPage}>
        <View style={s.row2}>
          <View style={[s.card, s.col]}>
            <T style={s.h3}>{r.meaning.yesTitle}</T>
            <Bullets items={r.meaning.yes} />
          </View>
          <View style={[s.card, s.col]}>
            <T style={s.h3}>{r.meaning.noTitle}</T>
            <Bullets items={r.meaning.no} />
          </View>
        </View>
        <View style={s.callout}>
          <T style={s.p}>{r.meaning.calibration}</T>
        </View>
        <T style={s.muted}>{msg.report.disclaimer}</T>
      </PageShell>

      {/* 3 · Perfil frente al benchmark */}
      <PageShell {...shell} page={3} title={r.pdfProfilePage}>
        <T style={s.p}>{r.profile.intro}</T>
        {buildProfileRows(data).map((row) => (
          <ProfileLine key={row.field} row={row} locale={locale} msg={msg} />
        ))}
        <View style={s.callout}>
          <T style={s.p}>{r.profile.note}</T>
        </View>
      </PageShell>

      {/* 4 · Sensibilidad */}
      <PageShell {...shell} page={4} title={msg.report.sensitivity}>
        <View style={s.callout}>
          <T style={[s.p, { fontFamily: 'Helvetica-Bold' }]}>{msg.report.sensitivity_note}</T>
        </View>
        <PdfRangePlot data={data} msg={msg} />
        <T style={s.muted}>{interp(r.sens.chartSummary, { low: data.sensitivity.low.display, base: data.sensitivity.base.display, high: data.sensitivity.high.display })}</T>
        <T style={s.muted}>{r.sens.outOfRange}</T>
        <T style={s.h2}>{r.sens.tableTitle}</T>
        <TableRow head widths={[34, 18, 16, 16, 16]} cells={[r.sens.variable, r.sens.requested, r.sens.down, r.sens.up, r.sens.clipped]} />
        {data.sensitivity.terms.map((t) => (
          <TableRow
            key={t.field}
            widths={[34, 18, 16, 16, 16]}
            cells={[
              msg.variables[t.field].label,
              `±${formatNumber(locale, t.requested, 0, 3)}`,
              `-${formatNumber(locale, t.down, 0, 3)}`,
              `+${formatNumber(locale, t.up, 0, 3)}`,
              t.clipped ? r.sens.yes : r.sens.no,
            ]}
          />
        ))}
      </PageShell>

      {/* 4 · Drivers */}
      <PageShell {...shell} page={5} title={msg.report.drivers}>
        <T style={s.muted}>{r.driversSection.note}</T>
        <View style={{ marginVertical: 10 }}>
          <PdfDriversChart data={data} locale={locale} msg={msg} />
        </View>
        <T style={s.h3}>{r.driversSection.caption}</T>
        <TableRow head widths={[30, 22, 22, 14, 12]} cells={[r.driversSection.variable, r.driversSection.yourValue, r.driversSection.benchmark, r.driversSection.contribution, '']} />
        {data.drivers.map((d) => (
          <TableRow
            key={d.field}
            widths={[30, 22, 22, 14, 12]}
            cells={[
              msg.variables[d.field].label,
              formatInputValue(locale, d.field, d.userValue, msg),
              d.benchmarkValue === null ? msg.variables.benchmarkWeighted : d.field === 'cigarettes_per_day' ? msg.variables.benchmarkNever : formatInputValue(locale, d.field, d.benchmarkValue, msg),
              formatSigned(locale, d.contribution, 3),
              r.driversSection.association,
            ]}
          />
        ))}
      </PageShell>

      {/* 5 · Escenarios */}
      <PageShell {...shell} page={6} title={r.scenarios.title}>
        <T style={s.p}>{r.scenarios.pdfIntro}</T>
        {data.scenarios.length === 0 ? <T style={s.muted}>{r.scenarios.none}</T> : null}
        {data.scenarios.map((sc) => (
          <View key={sc.field} style={s.card} wrap={false}>
            <T style={s.h3}>
              {interp(r.scenarios.change, {
                variable: msg.variables[sc.field].label,
                from: formatInputValue(locale, sc.field, sc.from, msg),
                to: formatInputValue(locale, sc.field, sc.to, msg),
              })}
            </T>
            <View style={s.row2}>
              <View style={s.col}>
                <T style={s.muted}>{r.scenarios.baseline}</T>
                <T style={{ fontSize: 18, fontFamily: 'Helvetica-Bold' }}>{sc.baseline.display}</T>
              </View>
              <View style={s.col}>
                <T style={s.muted}>{r.scenarios.scenario}</T>
                <T style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.primary }}>{sc.scenario.display}</T>
              </View>
              <View style={s.col}>
                <T style={s.muted}>{r.scenarios.difference}</T>
                <T style={{ fontSize: 12 }}>{sc.difference !== undefined ? interp(r.scenarios.years, { years: formatSigned(locale, sc.difference, 1) }) : r.scenarios.differenceHidden}</T>
              </View>
            </View>
          </View>
        ))}
        <View style={s.callout}>
          <T style={s.p}>{r.scenarios.disclaimer}</T>
        </View>
      </PageShell>

      {/* 7 · Guía de medición */}
      <PageShell {...shell} page={7} title={r.pdfGuidePage}>
        <T style={s.p}>{r.guide.intro}</T>
        {GUIDE_FIELDS.map((field) => {
          const g = r.guide.items[field];
          return (
            <View key={field} style={[s.card, { padding: 6, marginBottom: 4 }]} wrap={false}>
              <T style={[s.h3, { marginBottom: 1, fontSize: 10 }]}>{msg.variables[field].label}</T>
              <LabeledLine label={r.guide.what} text={g.what} />
              <LabeledLine label={r.guide.how} text={g.how} />
              <LabeledLine label={r.guide.avoid} text={g.avoid} />
            </View>
          );
        })}
      </PageShell>

      {/* 8 · Próximos pasos */}
      <PageShell {...shell} page={8} title={r.plan.title}>
        <Bullets items={r.plan.items} />
        <View style={s.callout}>
          <T style={s.p}>{r.plan.note}</T>
        </View>
      </PageShell>

      {/* 9 · Seguimiento y registro */}
      <PageShell {...shell} page={9} title={r.pdfFollowupPage}>
        <T style={s.p}>{r.followup.intro}</T>
        <T style={s.h3}>{r.followup.stepsTitle}</T>
        <Bullets items={r.followup.steps} />
        <T style={[s.h2, { marginTop: 10 }]}>{r.followup.logTitle}</T>
        <T style={s.muted}>{r.followup.logIntro}</T>
        <LogTable msg={msg} />
        <T style={[s.muted, { marginTop: 6 }]}>{r.followup.logNote}</T>
      </PageShell>

      {/* 10 · Preguntas para un profesional */}
      <PageShell {...shell} page={10} title={r.pdfQuestionsPage}>
        <T style={s.p}>{r.questions.intro}</T>
        <View style={s.card}>
          {r.questions.items.map((q, i) => (
            <View key={q} style={s.bullet} wrap={false}>
              <T style={[s.bulletDot, { width: 16 }]}>{`${i + 1}.`}</T>
              <T style={s.bulletText}>{q}</T>
            </View>
          ))}
        </View>
        <T style={s.h2}>{r.questions.topTitle}</T>
        <T style={s.muted}>{r.questions.topIntro}</T>
        <View style={[s.card, { marginTop: 6 }]}>
          {topDriverFields(data).map((f) => (
            <View key={f} style={s.bullet} wrap={false}>
              <T style={s.bulletDot}>-</T>
              <T style={s.bulletText}>{interp(r.questions.topItem, { variable: msg.variables[f].label })}</T>
            </View>
          ))}
        </View>
        <View style={s.callout}>
          <T style={s.p}>{r.questions.note}</T>
        </View>
      </PageShell>

      {/* 11 · Glosario y preguntas frecuentes */}
      <PageShell {...shell} page={11} title={r.pdfGlossaryPage}>
        <T style={s.h2}>{r.glossary.termsTitle}</T>
        {r.glossary.terms.map((t) => (
          <View key={t.term} style={{ marginBottom: 5 }} wrap={false}>
            <T style={[s.td, { fontFamily: 'Helvetica-Bold' }]}>{t.term}</T>
            <T style={s.muted}>{t.def}</T>
          </View>
        ))}
        <T style={s.h2}>{r.glossary.faqTitle}</T>
        {r.glossary.faq.map((f) => (
          <View key={f.q} style={{ marginBottom: 5 }} wrap={false}>
            <T style={[s.td, { fontFamily: 'Helvetica-Bold' }]}>{f.q}</T>
            <T style={s.muted}>{f.a}</T>
          </View>
        ))}
      </PageShell>

      {/* 12 · Supuestos y metodología */}
      <PageShell {...shell} page={12} title={msg.methodology.title}>
        <T style={s.p}>{msg.methodology.sections[1]?.body[0] ?? ''}</T>
        <T style={s.h3}>{msg.methodology.formulaTitle}</T>
        <View style={s.callout}><T style={{ fontFamily: 'Courier', fontSize: 9.5 }}>{msg.methodology.formula}</T></View>
        <TableRow head widths={[38, 62]} cells={[msg.methodology.coefficient, msg.methodology.value]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_log_age, pct(params.beta.logAge)]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_sleep, pct(params.beta.sleep)]} />
        <TableRow widths={[38, 62]} cells={[`${msg.coefficientNames.beta_srh_good} / ${msg.coefficientNames.beta_srh_fair} / ${msg.coefficientNames.beta_srh_poor}`, `${pct(params.beta.srh.good)} / ${pct(params.beta.srh.fair)} / ${pct(params.beta.srh.poor)}`]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_cigs, pct(params.beta.cigs)]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_reaction, pct(params.beta.reaction)]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_wthr, pct(params.beta.wthr)]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_alcohol, pct(params.beta.alcohol)]} />
        <TableRow widths={[38, 62]} cells={[msg.coefficientNames.beta_rhr, pct(params.beta.rhr)]} />
        <T style={[s.h3, { marginTop: 10 }]}>{msg.methodology.benchmarkTitle}</T>
        <T style={s.muted}>{msg.methodology.benchmarkNote}</T>
        <T style={[s.p, { marginTop: 6 }]}>{msg.methodology.sections[2]?.body[0] ?? ''}</T>
        <T style={s.muted}>{`${msg.methodology.lockedTitle}: ${msg.methodology.lockedItems.join(' · ')}. ${msg.methodology.lockedRisk}`}</T>
      </PageShell>

      {/* 13 · Fuentes, privacidad, descargo */}
      <PageShell {...shell} page={13} title={r.pdfSourcesPage}>
        <T style={s.h2}>{r.sources.title}</T>
        {SOURCE_IDS.map((id) => {
          const row = sources.find((x) => x.id === id);
          if (!row) return null;
          return (
            <View key={id} style={{ marginBottom: 6 }} wrap={false}>
              <T style={s.td}>{`${id} · ${msg.sourceTitles[id]}`}</T>
              <T style={s.muted}>{`${row.url}  (${interp(r.sources.verifiedOn, { date: row.fecha })})`}</T>
            </View>
          );
        })}
        <T style={s.h2}>{r.privacy.title}</T>
        <T style={s.p}>{interp(r.privacy.body, { date: formatDate(locale, tokenExpiresAt), days: retentionDays })}</T>
        <T style={s.h2}>{r.limits.title}</T>
        <Bullets items={r.limits.items} />
        <View style={s.callout}>
          <T style={s.p}>{msg.report.disclaimer}</T>
        </View>
        <T style={s.muted}>{`${r.verification.id}: ${data.verificationId}`}</T>
        <T style={s.muted}>{interp(r.verification.versions, { model: data.modelVersion, app: data.appVersion, pkg: data.packageVersion })}</T>
        <T style={s.muted}>{interp(r.verification.checksum, { checksum: data.checksum })}</T>
      </PageShell>
    </Document>
  );
}
