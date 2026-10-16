import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages as getIntlMessages, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Download, Printer, ShieldCheck, Trash2 } from 'lucide-react';
import { AgeScale } from '@/components/charts/age-scale';
import { DriversChart } from '@/components/charts/drivers-chart';
import { RangePlot } from '@/components/charts/range-plot';
import { TrackOnView } from '@/components/analytics/track-on-view';
import { SourceLink, TrackSectionViews } from '@/components/analytics/track-section-view';
import { ScenarioExplorer } from '@/components/report/scenario-explorer';
import { PrintButton } from '@/components/report/print-button';
import { Badge, Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { getEnv } from '@/lib/env';
import { getModelSnapshot } from '@/lib/drive/loader';
import type { Locale } from '@/lib/locales';
import { buildProfileRows, GUIDE_FIELDS, topDriverFields, type ProfileRow } from '@/lib/report/extras';
import { formatDate, formatInputValue, formatNumber, formatSigned, interp } from '@/lib/report/format';
import type { ReportData } from '@/lib/report/types';
import { getMessages, type Messages } from '@/messages';
import { pickNamespaces } from '@/messages/util';
import { lookupReport, type ReportLookup } from '@/server/services/report';
import { getStore } from '@/server/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: getMessages(locale).report.metaTitle,
    robots: { index: false, follow: false, nocache: true, noarchive: true },
    referrer: 'no-referrer',
  };
}

const SECTION_IDS = ['summary', 'meaning', 'profile', 'sensitivity', 'drivers', 'scenarios', 'guide', 'plan', 'followup', 'questions', 'glossary', 'method', 'sources'] as const;

export default async function ReportPage({ params }: { params: Promise<{ locale: Locale; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const msg = getMessages(locale);

  let found: ReportLookup | 'unavailable';
  try {
    found = await lookupReport(getStore(), token);
  } catch {
    found = 'unavailable';
  }

  // Informe bloqueado (modo de pago, sin pagar): ni un dato del informe; se lleva al desbloqueo.
  if (found !== 'unavailable' && found.status === 'locked') redirect(`/${locale}/unlock/${token}`);

  if (found === 'unavailable' || found.status !== 'ok') {
    const state = found === 'unavailable' ? 'notFound' : found.status === 'expired' ? 'expired' : 'notFound';
    const copy = state === 'expired' ? msg.report.expired : msg.report.notFound;
    return (
      <div className="container-page flex justify-center py-16">
        <Card className="w-full max-w-[720px] space-y-4 text-center" role="status">
          <h1 className="text-3xl font-extrabold">{copy.title}</h1>
          <p className="text-lg text-muted">{copy.body}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/calculate" className={buttonVariants()}>
              {msg.report.restart}
            </Link>
            <Link href="/privacy/delete-request" className={buttonVariants({ variant: 'secondary' })}>
              {msg.report.actions.deleteData}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { data, report, expiresAt } = found;
  const snapshot = await getModelSnapshot();
  const env = getEnv();
  const r = msg.report;
  const r2 = (n: number, d = 3) => formatNumber(locale, n, d, d);
  const label = (f: ReportData['drivers'][number]['field']) => msg.variables[f].label;
  const intlMessages = await getIntlMessages();
  const clientMessages = pickNamespaces(intlMessages as unknown as Messages, ['report', 'variables', 'a11y']);

  const delta = data.result.delta;
  const deltaText =
    delta === undefined
      ? data.result.status === 'BELOW_REFERENCE_RANGE'
        ? r.rangeBelow
        : r.rangeAbove
      : Math.abs(delta) < 0.05
        ? msg.preview.deltaSame
        : interp(delta < 0 ? msg.preview.deltaLower : msg.preview.deltaHigher, { years: formatNumber(locale, Math.abs(delta), 1, 1) });

  const sourceRows = (['S01', 'S02', 'S09', 'S10'] as const)
    .map((id) => snapshot.sources.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const nav: Array<[(typeof SECTION_IDS)[number], string]> = [
    ['summary', msg.preview.eyebrow],
    ['meaning', r.meaning.title],
    ['profile', r.profile.title],
    ['sensitivity', msg.report.sensitivity],
    ['drivers', msg.report.drivers],
    ['scenarios', r.scenarios.title],
    ['guide', r.guide.title],
    ['plan', r.plan.title],
    ['followup', r.followup.title],
    ['questions', r.questions.title],
    ['glossary', r.glossary.title],
    ['method', msg.report.method],
    ['sources', r.sources.title],
  ];

  const sectionTitle = 'text-2xl font-extrabold sm:text-3xl';

  return (
    <div className="container-page py-8 sm:py-12">
      <TrackOnView event="report_view" props={{ access_tier: data.accessTier, morrow_age_status: data.result.status }} />
      <TrackSectionViews ids={SECTION_IDS} />

      <header className="mx-auto max-w-[1000px] space-y-3 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{r.eyebrow}</p>
          <Badge tone="primary">{data.accessTier === 'paid_full' ? r.tierPaid : r.tierValidation}</Badge>
        </div>
        <h1 className="text-4xl font-extrabold sm:text-5xl">{r.heroTitle}</h1>
        <p className="text-sm text-muted tabular">
          {r.verification.id}: <strong className="text-fg">{data.verificationId}</strong> · {r.date}: {formatDate(locale, data.generatedAt)} · {r.modelLabel} {data.modelVersion}
        </p>
        <div className="no-print flex flex-wrap gap-3 pt-2">
          <a href={`/api/report/${token}/pdf?locale=${locale}`} download className={cn(buttonVariants({ size: 'lg' }), 'group')}>
            <Download className="size-5" aria-hidden="true" />
            {r.actions.downloadPdf}
          </a>
          <PrintButton label={r.actions.print} icon={<Printer className="size-5" aria-hidden="true" />} />
          <Link href={{ pathname: '/privacy/delete-request', query: { vid: data.verificationId } }} className={buttonVariants({ variant: 'ghost' })}>
            <Trash2 className="size-5" aria-hidden="true" />
            {r.actions.deleteData}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1000px] gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={r.heroTitle} className="no-print hidden lg:block">
          <ol className="sticky top-24 space-y-1 text-sm">
            {nav.map(([id, text]) => (
              <li key={id}>
                <a href={`#sec-${id}`} className="block rounded-md px-3 py-2 font-semibold text-muted hover:bg-surface-alt hover:text-fg">
                  {text}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-8">
          {/* 1 · Resumen */}
          <section id="sec-summary" aria-labelledby="h-summary" className="scroll-mt-24">
            <Card className="space-y-2 sm:p-10">
              <h2 id="h-summary" className="eyebrow">
                {msg.preview.eyebrow}
              </h2>
              <p className="text-[clamp(4.5rem,16vw,7rem)] font-extrabold leading-none tracking-tight text-primary tabular" data-testid="report-morrow-age">
                {data.result.display}
              </p>
              <p className="text-lg font-semibold">{r.summaryMessage}</p>
              <p className="text-base text-muted">
                {r.chronological}: <strong className="text-fg tabular">{data.chronologicalAge}</strong> · {deltaText}
              </p>
              <AgeScale
                className="pt-3"
                chronological={data.chronologicalAge}
                morrow={data.result.value}
                status={data.result.status}
                display={data.result.display}
                range={data.referenceRange}
                labels={{
                  chronological: msg.preview.chronological,
                  morrow: msg.preview.morrowLabel,
                  title: msg.preview.chartTitle,
                  summary: interp(msg.preview.chartSummary, { chrono: data.chronologicalAge, morrow: data.result.display }),
                  boundary: data.result.value === undefined ? msg.preview.boundaryNote : undefined,
                }}
              />
              <p className="border-t border-line pt-4 text-sm font-semibold">{msg.preview.not_bio}</p>
              <p className="text-sm text-muted">{interp(r.hazardLine, { hr: r2(data.result.relativeHazard, 2) })}</p>
            </Card>
          </section>

          {/* 2 · Qué significa */}
          <section id="sec-meaning" aria-labelledby="h-meaning" className="scroll-mt-24 space-y-4">
            <h2 id="h-meaning" className={sectionTitle}>
              {r.meaning.title}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="space-y-2 p-6">
                <h3 className="text-lg font-bold">{r.meaning.yesTitle}</h3>
                <ul className="space-y-2">
                  {r.meaning.yes.map((i) => (
                    <li key={i} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {i}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="space-y-2 p-6">
                <h3 className="text-lg font-bold">{r.meaning.noTitle}</h3>
                <ul className="space-y-2">
                  {r.meaning.no.map((i) => (
                    <li key={i} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                      {i}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <p className="rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 text-sm">{r.meaning.calibration}</p>
          </section>

          {/* 2b · Perfil frente al benchmark */}
          <section id="sec-profile" aria-labelledby="h-profile" className="scroll-mt-24 space-y-4">
            <h2 id="h-profile" className={sectionTitle}>
              {r.profile.title}
            </h2>
            <p className="text-muted">{r.profile.intro}</p>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {[r.driversSection.variable, r.profile.position, r.profile.yourValue, r.profile.benchmark].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildProfileRows(data).map((row) => (
                    <ProfileRowView key={row.field} row={row} locale={locale} msg={msg} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 text-sm">{r.profile.note}</p>
          </section>

          {/* 3 · Sensibilidad de medición */}
          <section id="sec-sensitivity" aria-labelledby="h-sensitivity" className="scroll-mt-24 space-y-4">
            <h2 id="h-sensitivity" className={sectionTitle}>
              {msg.report.sensitivity}
            </h2>
            <p className="rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 font-semibold">{msg.report.sensitivity_note}</p>
            <Card className="space-y-4 p-6">
              <RangePlot
                title={msg.report.sensitivity}
                summary={interp(r.sens.chartSummary, { low: data.sensitivity.low.display, base: data.sensitivity.base.display, high: data.sensitivity.high.display })}
                range={data.referenceRange}
                points={[
                  { label: r.sens.low, age: data.sensitivity.low },
                  { label: r.sens.base, age: data.sensitivity.base },
                  { label: r.sens.high, age: data.sensitivity.high },
                ]}
              />
              <p className="text-sm text-muted">{r.sens.tooltip}</p>
              <p className="text-sm text-muted">{r.sens.outOfRange}</p>
            </Card>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="px-4 py-3 text-left font-bold">{r.sens.tableTitle}</caption>
                <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {[r.sens.variable, r.sens.requested, r.sens.down, r.sens.up, r.sens.clipped].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sensitivity.terms.map((tm) => (
                    <tr key={tm.field} className="border-t border-line">
                      <th scope="row" className="px-4 py-2 text-left font-semibold">
                        {label(tm.field)}
                      </th>
                      <td className="px-4 py-2 tabular">±{formatNumber(locale, tm.requested, 0, 3)}</td>
                      <td className="px-4 py-2 tabular">-{formatNumber(locale, tm.down, 0, 3)}</td>
                      <td className="px-4 py-2 tabular">+{formatNumber(locale, tm.up, 0, 3)}</td>
                      <td className="px-4 py-2">{tm.clipped ? r.sens.yes : r.sens.no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 · Drivers */}
          <section id="sec-drivers" aria-labelledby="h-drivers" className="scroll-mt-24 space-y-4">
            <h2 id="h-drivers" className={sectionTitle}>
              {msg.report.drivers}
            </h2>
            <p className="text-muted">{r.driversSection.note}</p>
            <Card className="p-6">
              <DriversChart rows={data.drivers} labelFor={label} formatContribution={(n) => formatSigned(locale, n, 3)} ariaLabel={r.driversSection.chartSummary} />
            </Card>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="px-4 py-3 text-left font-bold">{r.driversSection.caption}</caption>
                <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {[r.driversSection.variable, r.driversSection.yourValue, r.driversSection.benchmark, r.driversSection.contribution, ''].map((h, i) => (
                      <th key={i} scope="col" className="px-4 py-2 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.map((d) => (
                    <tr key={d.field} className="border-t border-line">
                      <th scope="row" className="px-4 py-2 text-left font-semibold">
                        {label(d.field)}
                      </th>
                      <td className="px-4 py-2 tabular">{formatInputValue(locale, d.field, d.userValue, msg)}</td>
                      <td className="px-4 py-2 tabular">
                        {d.benchmarkValue === null ? msg.variables.benchmarkWeighted : d.field === 'cigarettes_per_day' ? msg.variables.benchmarkNever : formatInputValue(locale, d.field, d.benchmarkValue, msg)}
                      </td>
                      <td className="px-4 py-2 font-bold tabular">{formatSigned(locale, d.contribution, 3)}</td>
                      <td className="px-4 py-2 text-xs text-muted">{r.driversSection.association}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5 · Escenarios */}
          <section id="sec-scenarios" aria-labelledby="h-scenarios" className="scroll-mt-24 space-y-4">
            <h2 id="h-scenarios" className={sectionTitle}>
              {r.scenarios.title}
            </h2>
            <p className="text-muted">{r.scenarios.intro}</p>
            <NextIntlClientProvider locale={locale} messages={clientMessages}>
              <ScenarioExplorer whatIf={data.whatIf} initial={data.scenarios.map((s) => ({ field: s.field, to: s.to }))} />
            </NextIntlClientProvider>
          </section>

          {/* 5b · Guía de medición */}
          <section id="sec-guide" aria-labelledby="h-guide" className="scroll-mt-24 space-y-4">
            <h2 id="h-guide" className={sectionTitle}>
              {r.guide.title}
            </h2>
            <p className="text-muted">{r.guide.intro}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {GUIDE_FIELDS.map((field) => {
                const g = r.guide.items[field];
                return (
                  <Card key={field} className="space-y-2 p-5">
                    <h3 className="text-lg font-bold">{label(field)}</h3>
                    <dl className="space-y-2 text-sm">
                      {(
                        [
                          [r.guide.what, g.what],
                          [r.guide.how, g.how],
                          [r.guide.avoid, g.avoid],
                        ] as const
                      ).map(([term, text]) => (
                        <div key={term}>
                          <dt className="font-bold text-primary">{term}</dt>
                          <dd>{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* 6 · Próximos pasos */}
          <section id="sec-plan" aria-labelledby="h-plan" className="scroll-mt-24 space-y-4">
            <h2 id="h-plan" className={sectionTitle}>
              {r.plan.title}
            </h2>
            <Card className="space-y-3 p-6">
              <ol className="list-decimal space-y-3 pl-5">
                {r.plan.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ol>
              <p className="text-sm text-muted">{r.plan.note}</p>
            </Card>
          </section>

          {/* 6b · Seguimiento y registro */}
          <section id="sec-followup" aria-labelledby="h-followup" className="scroll-mt-24 space-y-4">
            <h2 id="h-followup" className={sectionTitle}>
              {r.followup.title}
            </h2>
            <p className="text-muted">{r.followup.intro}</p>
            <Card className="space-y-3 p-6">
              <h3 className="text-lg font-bold">{r.followup.stepsTitle}</h3>
              <ul className="space-y-2">
                {r.followup.steps.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {i}
                  </li>
                ))}
              </ul>
            </Card>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="px-4 py-3 text-left">
                  <span className="block font-bold">{r.followup.logTitle}</span>
                  <span className="block text-xs font-normal text-muted">{r.followup.logIntro}</span>
                </caption>
                <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {Object.values(r.followup.logColumns).map((h) => (
                      <th key={h} scope="col" className="border-r border-line px-2 py-2 font-bold last:border-r-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, row) => (
                    <tr key={row} className="h-10 border-t border-line">
                      {Object.keys(r.followup.logColumns).map((k) => (
                        <td key={k} className="border-r border-line last:border-r-0" />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">{r.followup.logNote}</p>
          </section>

          <section id="sec-questions" aria-labelledby="h-questions" className="scroll-mt-24 space-y-4">
            <h2 id="h-questions" className={sectionTitle}>
              {r.questions.title}
            </h2>
            <p className="text-muted">{r.questions.intro}</p>
            <Card className="space-y-3 p-6">
              <ol className="list-decimal space-y-3 pl-5">
                {r.questions.items.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </Card>
            <Card className="space-y-3 p-6">
              <h3 className="text-lg font-bold">{r.questions.topTitle}</h3>
              <p className="text-sm text-muted">{r.questions.topIntro}</p>
              <ul className="space-y-2">
                {topDriverFields(data).map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {interp(r.questions.topItem, { variable: label(f) })}
                  </li>
                ))}
              </ul>
            </Card>
            <p className="rounded-md border-l-4 border-primary bg-surface-alt px-4 py-3 text-sm">{r.questions.note}</p>
          </section>

          <section id="sec-glossary" aria-labelledby="h-glossary" className="scroll-mt-24 space-y-4">
            <h2 id="h-glossary" className={sectionTitle}>
              {r.glossary.title}
            </h2>
            <Card className="space-y-4 p-6">
              <h3 className="text-lg font-bold">{r.glossary.termsTitle}</h3>
              <dl className="space-y-3">
                {r.glossary.terms.map((t) => (
                  <div key={t.term}>
                    <dt className="font-bold">{t.term}</dt>
                    <dd className="text-sm text-muted">{t.def}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card className="space-y-4 p-6">
              <h3 className="text-lg font-bold">{r.glossary.faqTitle}</h3>
              <dl className="space-y-3">
                {r.glossary.faq.map((f) => (
                  <div key={f.q}>
                    <dt className="font-bold">{f.q}</dt>
                    <dd className="text-sm text-muted">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          {/* 7 · Metodología */}
          <section id="sec-method" aria-labelledby="h-method" className="scroll-mt-24 space-y-4">
            <h2 id="h-method" className={sectionTitle}>
              {msg.report.method}
            </h2>
            <Card className="space-y-3 p-6">
              {[1, 2].map((i) => (
                <p key={i}>{msg.methodology.sections[i]?.body[0]}</p>
              ))}
              <p className="rounded-md bg-surface-alt px-4 py-3 font-mono text-sm">{msg.methodology.formula}</p>
              <p className="text-sm text-muted">
                {msg.methodology.lockedTitle}: {msg.methodology.lockedItems.join(' · ')}. {msg.methodology.lockedRisk}
              </p>
              <Link href="/methodology" className={cn(buttonVariants({ variant: 'link' }), 'group')}>
                {r.actions.methodology}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Card>
          </section>

          {/* 8 · Fuentes, límites, privacidad, verificación */}
          <section id="sec-sources" aria-labelledby="h-sources" className="scroll-mt-24 space-y-4">
            <h2 id="h-sources" className={sectionTitle}>
              {r.sources.title}
            </h2>
            <Card className="space-y-4 p-6">
              <ul className="space-y-3">
                {sourceRows.map((s) => (
                  <li key={s.id}>
                    <p className="font-semibold">
                      {s.id} · {msg.sourceTitles[s.id as keyof typeof msg.sourceTitles]}
                    </p>
                    <SourceLink href={s.url} sourceId={s.id} className="break-all text-sm text-primary underline underline-offset-4">
                      {s.url}
                    </SourceLink>
                    <span className="text-xs text-muted"> ({interp(r.sources.verifiedOn, { date: s.fecha })})</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="space-y-3 p-6">
              <h3 className="text-lg font-bold">{r.limits.title}</h3>
              <ul className="space-y-2 text-sm">
                {r.limits.items.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                    {i}
                  </li>
                ))}
              </ul>
              <p className="border-t border-line pt-3 text-sm font-semibold">{msg.report.disclaimer}</p>
            </Card>
            <Card className="space-y-2 p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                {r.privacy.title}
              </h3>
              <p className="text-sm">{interp(r.privacy.body, { date: formatDate(locale, expiresAt), days: env.reportRetentionDays })}</p>
            </Card>
            <Card className="space-y-1 p-6 text-sm tabular">
              <h3 className="text-lg font-bold">{r.verification.title}</h3>
              <p>
                {r.verification.id}: <strong>{data.verificationId}</strong>
              </p>
              <p className="text-muted">{interp(r.verification.versions, { model: data.modelVersion, app: data.appVersion, pkg: data.packageVersion })}</p>
              <p className="text-muted">{interp(r.verification.checksum, { checksum: data.checksum })}</p>
              <p className="text-muted">{report.pdf_checksum_sha256 ? `PDF SHA-256: ${report.pdf_checksum_sha256.slice(0, 16)}…` : null}</p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Fila de «Tu perfil frente al benchmark»: círculo = tu valor, marca vertical = benchmark (con equivalente textual). */
function ProfileRowView({ row, locale, msg }: { row: ProfileRow; locale: Locale; msg: Messages }) {
  const p = msg.report.profile;
  const userText = formatInputValue(locale, row.field, row.userValue, msg);
  const benchText =
    row.benchmarkValue === null ? msg.variables.benchmarkWeighted : row.field === 'cigarettes_per_day' ? msg.variables.benchmarkNever : formatInputValue(locale, row.field, row.benchmarkValue, msg);
  const posText = row.position === 'category' ? p.category : row.position === 'above' ? p.above : row.position === 'below' ? p.below : p.near;
  return (
    <tr className="border-t border-line align-middle">
      <th scope="row" className="px-4 py-3 text-left font-semibold">
        {msg.variables[row.field].label}
      </th>
      <td className="px-4 py-3">
        {row.userFrac !== undefined && row.benchFrac !== undefined ? (
          <div className="relative h-5 w-44" role="img" aria-label={interp(p.scaleSummary, { min: row.min ?? 0, max: row.max ?? 0, value: userText, benchmark: benchText })}>
            <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-surface-alt ring-1 ring-line" />
            <div className="absolute top-0.5 h-4 w-0.5 bg-fg/70" style={{ left: `${row.benchFrac * 100}%` }} />
            <div className="absolute top-0.5 size-4 -translate-x-1/2 rounded-full bg-primary ring-2 ring-surface" style={{ left: `${row.userFrac * 100}%` }} />
          </div>
        ) : (
          <span className="text-xs text-muted">{p.srhNote}</span>
        )}
        <p className="mt-1 text-xs font-semibold text-primary">{posText}</p>
      </td>
      <td className="px-4 py-3 tabular">{userText}</td>
      <td className="px-4 py-3 tabular">{benchText}</td>
    </tr>
  );
}
