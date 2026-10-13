'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import {
  MATCH_TIMEOUT_MS,
  NON_MATCH_WINDOW_MS,
  PRACTICE_ROUNDS,
  PROTOCOL_VERSION,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
  planRounds,
  summarize,
  type Round,
  type Summary,
  type Symbol,
} from '@/lib/reaction/protocol';

type Phase = 'idle' | 'wait' | 'stimulus' | 'feedback' | 'done';

function Shape({ symbol }: { symbol: Symbol }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="size-24 text-primary sm:size-28">
      {symbol === 'circle' && <circle cx="50" cy="50" r="36" fill="currentColor" />}
      {symbol === 'square' && <rect x="16" y="16" width="68" height="68" rx="6" fill="currentColor" />}
      {symbol === 'triangle' && <polygon points="50,12 90,86 10,86" fill="currentColor" />}
      {symbol === 'diamond' && <polygon points="50,8 92,50 50,92 8,50" fill="currentColor" />}
    </svg>
  );
}

/**
 * Prueba de reacción integrada (protocolo `snap-v1`, preliminar). Mide desde el primer pintado del
 * estímulo (rAF tras el commit). Accesible por teclado (Espacio/Enter) y táctil (pointerdown);
 * la alternativa de entrada manual vive en el paso. Respeta reduced-motion: no hay animaciones.
 */
export function ReactionTest({
  range,
  onResult,
  onRunStart,
}: {
  range: readonly [number, number];
  onResult: (ms: number) => void;
  onRunStart: () => void;
}) {
  const t = useTranslations('steps.reaction');
  const [phase, setPhase] = useState<Phase>('idle');
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<Summary | null>(null);

  const [plan, setPlan] = useState<Round[]>([]);
  const rounds = useRef<Round[]>([]);
  const phaseRef = useRef<Phase>('idle');
  const indexRef = useRef(0);
  const t0 = useRef<number | null>(null);
  const responses = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const surface = useRef<HTMLButtonElement>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);
  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    const s = summarize(responses.current, range);
    setResult(s);
    go('done');
    if (s.status === 'ok') onResult(s.ms);
  }, [clearTimers, go, onResult, range]);

  const startRound = useCallback(
    (i: number) => {
      if (i >= rounds.current.length) return finish();
      indexRef.current = i;
      setIndex(i);
      setNote('');
      go('wait');
      const delay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
      timers.current.push(window.setTimeout(() => go('stimulus'), delay));
    },
    [finish, go],
  );

  const endRound = useCallback(
    (message: string) => {
      clearTimers();
      const i = indexRef.current;
      setNote(i === PRACTICE_ROUNDS - 1 && !message ? t('practiceDone') : message);
      go('feedback');
      timers.current.push(window.setTimeout(() => startRound(i + 1), 650));
    },
    [clearTimers, go, startRound, t],
  );

  // El cronómetro y la ventana de respuesta arrancan tras el primer pintado del estímulo.
  useEffect(() => {
    if (phase !== 'stimulus') return;
    t0.current = null;
    const round = rounds.current[indexRef.current];
    if (!round) return;
    const raf = requestAnimationFrame(() => {
      t0.current = performance.now();
      timers.current.push(
        window.setTimeout(
          () => endRound(round.match && round.kind === 'measure' ? t('missed') : ''),
          round.match ? MATCH_TIMEOUT_MS : NON_MATCH_WINDOW_MS,
        ),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, index, endRound, t]);

  const press = useCallback(() => {
    if (phaseRef.current !== 'stimulus' || t0.current === null) return;
    const rt = performance.now() - t0.current;
    const round = rounds.current[indexRef.current];
    if (!round) return;
    if (round.match) {
      if (rt < 150) return; // anticipación: se ignora y se sigue esperando
      if (round.kind === 'measure') responses.current.push(rt);
      endRound('');
    } else {
      endRound(t('falsePress'));
    }
  }, [endRound, t]);

  function begin() {
    onRunStart();
    const planned = planRounds();
    rounds.current = planned;
    setPlan(planned);
    responses.current = [];
    setResult(null);
    startRound(0);
    requestAnimationFrame(() => surface.current?.focus());
  }

  const round = plan[index];
  const practice = round?.kind === 'practice';
  const total = plan.length || PRACTICE_ROUNDS + 10;
  const progressLabel = round
    ? practice
      ? t('practice', { current: index + 1, total: PRACTICE_ROUNDS })
      : t('measure', { current: index - PRACTICE_ROUNDS + 1, total: total - PRACTICE_ROUNDS })
    : '';
  const running = phase === 'wait' || phase === 'stimulus' || phase === 'feedback';

  return (
    <div className="space-y-5" role="group" aria-label={t('surface')}>
      <Badge tone="locked">{t('protocolBadge', { version: PROTOCOL_VERSION })}</Badge>

      {phase === 'idle' || phase === 'done' ? (
        <div className="space-y-4">
          {phase === 'idle' ? (
            <>
              <p className="text-base text-muted">{t('intro')}</p>
              <p className="text-sm text-muted">{t('keyboardHint')}</p>
            </>
          ) : null}
          {result?.status === 'ok' ? (
            <div role="status" className="rounded-md border border-primary/40 bg-primary/8 p-5">
              <p className="text-2xl font-extrabold tabular">{t('result', { ms: result.ms })}</p>
              <p className="mt-1 text-sm text-muted">{t('resultNote')}</p>
            </div>
          ) : null}
          {result?.status === 'too_few' ? (
            <p role="alert" className="text-base font-semibold text-danger">
              {t('tooFewValid')}
            </p>
          ) : null}
          {result?.status === 'invalid_range' ? (
            <p role="alert" className="text-base font-semibold text-danger">
              {t('invalid', { min: range[0], max: range[1] })}
            </p>
          ) : null}
          <Button type="button" variant="secondary" size="lg" onClick={begin}>
            {phase === 'idle' ? t('startNow') : t('retake')}
          </Button>
        </div>
      ) : null}

      {running ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-muted">
            <span aria-live="polite">{progressLabel}</span>
            <span className="tabular">
              {index + 1}/{total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <button
            ref={surface}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              press();
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!e.repeat) press();
              }
            }}
            onClick={(e) => e.preventDefault()}
            aria-label={
              phase === 'stimulus' && round
                ? `${t(`symbols.${round.left}`)}, ${t(`symbols.${round.right}`)}`
                : phase === 'wait'
                  ? t('wait')
                  : note || t('wait')
            }
            className={cn(
              'flex min-h-72 w-full touch-none select-none flex-col items-center justify-center gap-5 rounded-lg border-2 bg-surface px-4 py-8 text-center shadow-card transition-colors',
              phase === 'stimulus' ? 'border-primary' : 'border-dashed border-line',
            )}
          >
            {phase === 'stimulus' && round ? (
              <>
                <div className="flex items-center justify-center gap-6">
                  <div className="grid size-36 place-items-center rounded-lg border border-line bg-surface-alt sm:size-40">
                    <Shape symbol={round.left} />
                  </div>
                  <div className="grid size-36 place-items-center rounded-lg border border-line bg-surface-alt sm:size-40">
                    <Shape symbol={round.right} />
                  </div>
                </div>
                <p className="text-base font-semibold text-muted">{t('same')}&nbsp;·&nbsp;{t('different')}</p>
              </>
            ) : (
              <p className="text-xl font-semibold text-muted" aria-live="polite">
                {phase === 'wait' ? t('wait') : note || ' '}
              </p>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
