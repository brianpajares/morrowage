'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api-client';
import { STEPS, stepForField } from '@/lib/assessment/steps';
import { toCanonicalInputs, useAssessment } from '@/lib/assessment/state';
import type { Locale } from '@/lib/locales';
import type { PreviewOutput } from '@/lib/model/display';
import type { InputField } from '@/lib/model/input-spec';
import { useTurnstile } from '@/lib/turnstile-client';

interface CalculateResponse {
  calculationId: string;
  output: PreviewOutput;
  expiresAt: string;
}

type Stage = 0 | 1 | 2 | 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transición honesta: validar → calcular → preparar contexto. Sin porcentajes falsos ni teatro de "IA". */
export function ProcessingScreen() {
  const t = useTranslations('processing');
  const te = useTranslations('errors');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, setCalculation } = useAssessment();
  const { getToken } = useTurnstile();
  const [stage, setStage] = useState<Stage>(0);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ message: string; reviewStep: string; retryable: boolean } | null>(null);
  const started = useRef(false);
  const labels = t.raw('steps') as string[];

  useEffect(() => {
    if (!state.hydrated || started.current) return;
    started.current = true;

    const inputs = toCanonicalInputs(state.values);
    const missing = STEPS.find((s) => (inputs as Record<string, unknown>)[s.field] === undefined);
    if (!state.scopeAcceptedAt || missing) {
      router.replace(missing && state.scopeAcceptedAt ? `/calculate/${missing.id}` : '/calculate');
      return;
    }

    void (async () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pause = (ms: number) => (reduce ? Promise.resolve() : sleep(ms));
      setStage(1);
      await pause(350);
      setStage(2);
      const token = await getToken();
      const region = /-([A-Za-z]{2})\b/.exec(navigator.language)?.[1]?.toUpperCase() ?? null;
      const res = await postJson<CalculateResponse>(
        '/api/calculate',
        { inputs, locale, marketHintCoarse: region, scopeAccepted: true },
        { locale, turnstileToken: token },
      );
      if (!res.ok) {
        const firstField = res.fields ? (Object.keys(res.fields).find((k) => k !== '_root') as InputField | undefined) : undefined;
        setFailure({
          message: res.status === 400 ? te('generic') : res.status === 429 ? te('generic') : t('unavailable'),
          reviewStep: firstField ? stepForField(firstField) : 'age',
          retryable: res.status !== 400,
        });
        return;
      }
      setStage(3);
      await pause(350);
      setCalculation({ id: res.data.calculationId, output: res.data.output, expiresAt: res.data.expiresAt, chronological: state.values.age! });
      router.replace(`/preview/${res.data.calculationId}`);
    })();
  }, [attempt, state.hydrated, state.values, state.scopeAcceptedAt, locale, router, setCalculation, getToken, t, te]);

  if (failure) {
    return (
      <div className="container-page flex justify-center py-16">
        <Card className="w-full max-w-[720px] space-y-5" role="alert">
          <AlertTriangle className="size-8 text-danger" aria-hidden="true" />
          <h1 className="text-2xl font-extrabold">{t('errorTitle')}</h1>
          <p className="text-base">{failure.message}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/calculate/${failure.reviewStep}`}>{t('review')}</Link>
            </Button>
            {failure.retryable ? (
              <Button
                variant="secondary"
                onClick={() => {
                  started.current = false;
                  setFailure(null);
                  setStage(0);
                  setAttempt((n) => n + 1);
                }}
              >
                {t('retry')}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <Card className="w-full max-w-[720px] space-y-6">
        <h1 className="text-3xl font-extrabold">{t('title')}</h1>
        <p className="text-base text-muted">{t('privacy')}</p>
        <ol className="space-y-3" aria-live="polite">
          {labels.map((label, i) => {
            const done = stage > i + 1 || stage === 3;
            const active = stage === i + 1 && stage < 3;
            return (
              <li key={label} className={`flex items-center gap-3 rounded-md px-4 py-3 text-base font-semibold ${done ? 'bg-primary/8 text-fg' : active ? 'bg-surface-alt text-fg' : 'text-muted'}`}>
                <span className="grid size-6 shrink-0 place-items-center">
                  {done ? <Check className="size-5 text-primary" strokeWidth={3} aria-hidden="true" /> : active ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <span className="size-2 rounded-full bg-line" aria-hidden="true" />}
                </span>
                <span>{label}</span>
                <span className="sr-only">{done ? ' ✓' : active ? ` (${t('working')})` : ''}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
