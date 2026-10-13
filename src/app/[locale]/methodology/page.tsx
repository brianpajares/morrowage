import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ContentPage, Sections } from '@/components/site/content';
import { Markdown } from '@/components/site/markdown';
import { SourceLink } from '@/components/analytics/track-section-view';
import { TrackOnView } from '@/components/analytics/track-on-view';
import { Card } from '@/components/ui/card';
import { getModelSnapshot } from '@/lib/drive/loader';
import type { Locale } from '@/lib/locales';
import { formatDate, formatNumber, interp } from '@/lib/report/format';
import { pageMetadata } from '@/lib/seo';
import { getMessages } from '@/messages';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = getMessages(locale).methodology;
  return pageMetadata({ locale, path: '/methodology', title: m.metaTitle, description: m.metaDescription, index: true });
}

const COEFFICIENTS = [
  ['beta_log_age', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.logAge],
  ['beta_sleep', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.sleep],
  ['beta_srh_excellent', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.srh.excellent],
  ['beta_srh_good', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.srh.good],
  ['beta_srh_fair', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.srh.fair],
  ['beta_srh_poor', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.srh.poor],
  ['beta_cigs', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.cigs],
  ['beta_reaction', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.reaction],
  ['beta_wthr', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.wthr],
  ['beta_alcohol', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.alcohol],
  ['beta_rhr', (p: Awaited<ReturnType<typeof getModelSnapshot>>['params']) => p.beta.rhr],
] as const;

export default async function MethodologyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const msg = getMessages(locale);
  const m = msg.methodology;
  const snap = await getModelSnapshot();
  const model = snap.params.version;
  const sourceIds = ['S01', 'S02', 'S09', 'S10'] as const;
  const sources = sourceIds.map((id) => snap.sources.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const latest = sources.map((s) => s.fecha).sort().at(-1) ?? '2026-10-06';
  const benchNames = msg.benchmarkNames as Record<string, string>;

  return (
    <ContentPage
      eyebrow={`MorrowAge v${model}`}
      title={m.title}
      lede={interp(m.lede, { model })}
      meta={interp(m.updated, { model, date: formatDate(locale, latest) })}
      wide
    >
      <TrackOnView event="methodology_open" props={{ origin_screen: 'direct' }} />
      <div className="reading">
        <Sections sections={m.sections.map((s) => ({ id: s.id, title: s.title, body: s.body }))} render={(t) => interp(t, { model })} />
      </div>

      <section className="mt-14 space-y-3" aria-labelledby="m-formula">
        <h2 id="m-formula" className="text-2xl font-bold">
          {m.formulaTitle}
        </h2>
        <Card className="font-mono text-base">{m.formula}</Card>
      </section>

      <section className="mt-14 space-y-3" aria-labelledby="m-params">
        <h2 id="m-params" className="text-2xl font-bold">
          {m.paramsTitle}
        </h2>
        <p className="text-sm text-muted">{m.paramsNote}</p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[22rem] text-sm">
            <caption className="sr-only">{m.paramsTitle}</caption>
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-bold">{m.coefficient}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.value}</th>
              </tr>
            </thead>
            <tbody>
              {COEFFICIENTS.map(([key, get]) => (
                <tr key={key} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">{msg.coefficientNames[key]}</th>
                  <td className="px-4 py-2 font-mono tabular">{formatNumber(locale, get(snap.params), 0, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 space-y-3" aria-labelledby="m-bench">
        <h2 id="m-bench" className="text-2xl font-bold">
          {m.benchmarkTitle}
        </h2>
        <p className="text-sm text-muted">{m.benchmarkNote}</p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">{m.benchmarkTitle}</caption>
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-bold">{m.benchmarkVariable}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.value}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.benchmarkUnit}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.benchmarkStatus}</th>
              </tr>
            </thead>
            <tbody>
              {snap.benchmark.map((row) => (
                <tr key={row.variable} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">{benchNames[row.variable] ?? row.variable}</th>
                  <td className="px-4 py-2 font-mono tabular">{row.valor}</td>
                  <td className="px-4 py-2 text-muted">{row.unidad}</td>
                  <td className="px-4 py-2 text-muted">{row.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 space-y-3" aria-labelledby="m-locked">
        <h2 id="m-locked" className="text-2xl font-bold">
          {m.lockedTitle}
        </h2>
        <ul className="space-y-2">
          {m.lockedItems.map((i) => (
            <li key={i} className="flex gap-3 font-semibold">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-locked" />
              {i}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{m.lockedRisk}</p>
      </section>

      <section className="mt-14 space-y-3" aria-labelledby="m-sources">
        <h2 id="m-sources" className="text-2xl font-bold">
          {m.sourcesTitle}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{m.sourcesTitle}</caption>
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-bold">{m.sourceId}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.sourceDescription}</th>
                <th scope="col" className="px-4 py-2 font-bold">{m.sourceDate}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 text-left font-bold tabular">{s.id}</th>
                  <td className="px-4 py-3">
                    <p>{msg.sourceTitles[s.id as keyof typeof msg.sourceTitles]}</p>
                    <SourceLink href={s.url} sourceId={s.id} className="break-all text-xs text-primary underline underline-offset-4">
                      {s.url}
                    </SourceLink>
                  </td>
                  <td className="px-4 py-3 text-muted tabular">{s.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="group mt-14 rounded-lg border border-line bg-surface p-5">
        <summary className="cursor-pointer text-lg font-bold">{m.modelCardTitle}</summary>
        <p className="mt-2 text-sm text-muted">{m.modelCardNote}</p>
        <div className="mt-4 max-w-[720px]">
          <Markdown source={snap.modelCard} />
        </div>
      </details>
    </ContentPage>
  );
}
