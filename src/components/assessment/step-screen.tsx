'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioCards } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { bucketAttempts, bucketMs } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/client';
import { STEPS, isStepId, stepIndex, type StepId } from '@/lib/assessment/steps';
import { useAssessment } from '@/lib/assessment/state';
import type { Locale } from '@/lib/locales';
import { SRH_SPEC, rangeOf, type NumericField, type SelfRatedHealth } from '@/lib/model/input-spec';
import { alcoholToUkUnits, cmToIn, inToCm, parseDecimal, waistToHeightRatio, type AlcoholMode, type LengthUnit } from '@/lib/model/units';
import { validateField, type InputErrorCode } from '@/lib/model/validate';
import { formatNumber } from '@/lib/report/format';
import { ReactionTest } from './reaction-test';

type Err = { code: InputErrorCode | 'ratio_range' | 'alcohol_range'; min?: number; max?: number } | null;

function parseNumeric(field: NumericField, raw: string): { value?: number; error?: Err } {
  if (raw.trim() === '') return { error: { code: 'required' } };
  const n = parseDecimal(raw);
  if (n === null) return { error: { code: 'not_a_number' } };
  const code = validateField(field, n);
  if (code) {
    const [min, max] = rangeOf(field);
    return { error: { code, min, max } };
  }
  return { value: n };
}

/** Reloj aislado en una función de módulo (las reglas de pureza de React no permiten Date.now() inline en el render). */
function nowMs(): number {
  return Date.now();
}

function useErrorText() {
  const t = useTranslations();
  return useCallback(
    (e: NonNullable<Err>): string => {
      switch (e.code) {
        case 'required':
          return t('common.required');
        case 'not_a_number':
          return t('steps.errors.number');
        case 'not_integer':
          return t('steps.errors.integer');
        case 'out_of_range':
          return t('common.range', { min: e.min ?? 0, max: e.max ?? 0 });
        case 'out_of_scope':
          return t('errors.out_of_scope');
        case 'invalid_enum':
          return t('steps.errors.enum');
        case 'ratio_range':
          return t('steps.wthr.rangeError', { min: e.min ?? 0, max: e.max ?? 0 });
        case 'alcohol_range':
          return t('steps.alcohol.rangeError', { min: e.min ?? 0, max: e.max ?? 0 });
        default:
          return t('errors.generic');
      }
    },
    [t],
  );
}

function StepFrame({
  index,
  title,
  help,
  error,
  children,
  onSubmit,
  onBack,
  nextDisabled,
  extra,
  visibleSummary = false,
}: {
  index: number;
  title: string;
  help?: string;
  error?: string | null;
  children: ReactNode;
  onSubmit: () => void;
  onBack: () => void;
  nextDisabled?: boolean;
  extra?: ReactNode;
  /** El resumen de error solo se ve si el paso no tiene un campo con error inline; si no, es solo para lectores de pantalla. */
  visibleSummary?: boolean;
}) {
  const t = useTranslations();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="container-page flex min-h-[calc(100dvh-4rem)] justify-center py-8 sm:py-14">
      <form onSubmit={submit} noValidate className="w-full max-w-[720px] pb-28 sm:pb-0" aria-labelledby="step-title">
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm font-semibold text-muted">
            <span>{t('common.progress', { current: index + 1 })}</span>
            <span aria-hidden="true" className="tabular">
              {index + 1}/8
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={8}
            aria-valuenow={index + 1}
            aria-label={t('steps.stepsLabel')}
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / 8) * 100}%` }} />
          </div>
        </div>

        <Card className="animate-fade-up space-y-6">
          <div className="space-y-2">
            <h1 id="step-title" ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none sm:text-3xl">
              {title}
            </h1>
            {help ? <p className="text-base text-muted">{help}</p> : null}
          </div>
          {children}
          <div aria-live="polite" className="min-h-0">
            {error ? (
              <p role="alert" className={visibleSummary ? 'flex items-start gap-2 text-base font-semibold text-danger' : 'sr-only'}>
                <span aria-hidden="true">⚠</span>
                <span>
                  <span className="sr-only">{t('steps.errorSummary')} </span>
                  {error}
                </span>
              </p>
            ) : null}
          </div>
          {extra}
        </Card>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-[720px] items-center gap-3">
            <Button type="button" variant="secondary" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('common.back')}
            </Button>
            <Button type="submit" className="flex-1 sm:flex-none sm:min-w-44" disabled={nextDisabled}>
              {t('common.next')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function StepScreen({ stepId }: { stepId: string }) {
  const id: StepId | null = isStepId(stepId) ? stepId : null;
  const router = useRouter();
  const { state } = useAssessment();

  // Sin consentimiento de alcance no se puede continuar (AT-02).
  useEffect(() => {
    if (state.hydrated && !state.scopeAcceptedAt) router.replace('/calculate');
  }, [state.hydrated, state.scopeAcceptedAt, router]);

  if (!id || !state.hydrated || !state.scopeAcceptedAt) return <div className="container-page py-24" aria-busy="true" />;
  return <StepBody key={id} id={id} />;
}

function StepBody({ id }: { id: StepId }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const errorText = useErrorText();
  const { state, setValue, setText, setUi } = useAssessment();
  const index = stepIndex(id);
  const [mountedAt] = useState(nowMs);
  const [error, setError] = useState<Err>(null);

  useEffect(() => {
    track('input_step_view', { step_id: id, step_index: index + 1 });
  }, [id, index]);

  const prev = index > 0 ? STEPS[index - 1]!.id : null;
  const next = index < STEPS.length - 1 ? STEPS[index + 1]!.id : null;

  const goBack = () => (prev ? router.push(`/calculate/${prev}`) : router.push('/calculate'));

  const complete = () => {
    track('input_step_complete', { step_id: id, elapsed_ms_bucket: bucketMs(nowMs() - mountedAt) });
    if (next) {
      router.push(`/calculate/${next}`);
    } else {
      track('assessment_complete', { total_elapsed_ms_bucket: bucketMs(nowMs() - (state.startedAt ?? mountedAt)) });
      router.push('/processing');
    }
  };

  const fail = (e: NonNullable<Err>) => {
    setError(e);
    track('input_validation_error', { step_id: id, error_code: e.code });
    if (id === 'age' && e.code === 'out_of_scope') {
      const age = parseDecimal(state.ui.text.age ?? '');
      track('scope_out_of_range', { direction_only: age !== null && age < 40 ? 'below' : 'above' });
    }
  };

  // ---- pasos numéricos simples -------------------------------------------------------------
  const simple: Partial<Record<StepId, { field: NumericField; key: 'age' | 'sleep' | 'cigs' | 'rhr'; label: string; mode: 'numeric' | 'decimal'; help?: string; unit: string }>> = {
    age: { field: 'age_years', key: 'age', label: t('steps.age.label'), mode: 'numeric', unit: t('variables.age_years.unit') },
    sleep: { field: 'sleep_hours', key: 'sleep', label: t('steps.sleep.label'), mode: 'decimal', help: t('steps.sleep.hint'), unit: t('variables.sleep_hours.unit') },
    cigs: { field: 'cigarettes_per_day', key: 'cigs', label: t('steps.cigs.label'), mode: 'numeric', unit: t('variables.cigarettes_per_day.unit') },
    rhr: { field: 'resting_hr_bpm', key: 'rhr', label: t('steps.rhr.label'), mode: 'numeric', unit: t('variables.resting_hr_bpm.unit') },
  };
  const spec = simple[id];
  const copyKey = id === 'rhr' ? 'rhr' : id;

  if (spec) {
    const text = state.ui.text[spec.key] ?? '';
    const submit = () => {
      const r = parseNumeric(spec.field, text);
      if (r.error) return fail(r.error);
      setError(null);
      setValue(spec.key, r.value);
      complete();
    };
    const outOfScope = id === 'age' && error?.code === 'out_of_scope';
    return (
      <StepFrame
        index={index}
        title={t(`steps.${copyKey}.q`)}
        help={t(`steps.${copyKey}.help`)}
        error={error ? errorText(error) : null}
        onSubmit={submit}
        onBack={goBack}
        extra={
          outOfScope ? (
            <div className="rounded-md border border-line bg-surface-alt p-4" role="note">
              <p className="font-semibold">{t('steps.age.outOfScopeTitle')}</p>
              <p className="mt-1 text-sm text-muted">{t('steps.age.outOfScopeBody')}</p>
              <Link href="/methodology" className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4">
                {t('steps.age.outOfScopeLink')}
              </Link>
            </div>
          ) : null
        }
      >
        <Field id={`f-${id}`} label={spec.label} help={spec.help} error={error ? errorText(error) : undefined} required requiredLabel={t('a11y.required')}>
          {(p) => (
            <div className="flex items-center gap-3">
              <Input
                {...p}
                inputMode={spec.mode}
                autoComplete="off"
                enterKeyHint="next"
                autoFocus
                value={text}
                onChange={(e) => {
                  setText(spec.key, e.target.value);
                  if (error) setError(null);
                }}
                className="max-w-56 text-2xl font-bold tabular"
              />
              <span className="text-lg font-semibold text-muted">{spec.unit}</span>
            </div>
          )}
        </Field>
      </StepFrame>
    );
  }

  // ---- salud autopercibida ---------------------------------------------------------------------
  if (id === 'srh') {
    const options = SRH_SPEC.values.map((v) => ({ value: v, label: SRH_SPEC.labels[locale][v] }));
    const submit = () => {
      if (!state.values.srh) return fail({ code: 'required' });
      setError(null);
      complete();
    };
    return (
      <StepFrame index={index} title={t('steps.srh.q')} error={error ? errorText(error) : null} onSubmit={submit} onBack={goBack} visibleSummary>
        <RadioCards
          id="srh"
          legend={t('steps.srh.legend')}
          value={state.values.srh}
          options={options}
          error={error ? errorText(error) : undefined}
          onValueChange={(v) => {
            setValue('srh', v as SelfRatedHealth);
            setError(null);
          }}
        />
      </StepFrame>
    );
  }

  // ---- tiempo de reacción ----------------------------------------------------------------------
  if (id === 'reaction') {
    const range = rangeOf('reaction_time_ms');
    const manualText = state.ui.text.reactionManual ?? '';
    const submit = () => {
      if (state.values.reaction === undefined) return fail({ code: 'required' });
      setError(null);
      complete();
    };
    const applyManual = (raw: string) => {
      setText('reactionManual', raw);
      const r = parseNumeric('reaction_time_ms', raw);
      if (r.error) {
        setValue('reaction', undefined);
        return r.error;
      }
      setValue('reaction', Math.round(r.value!));
      return null;
    };
    return (
      <StepFrame
        index={index}
        title={t('steps.reaction.q')}
        help={t('steps.reaction.help')}
        error={error ? errorText(error) : null}
        onSubmit={submit}
        onBack={goBack}
        nextDisabled={false}
        visibleSummary
      >
        <ReactionTest
          range={range}
          onRunStart={() => {
            const attempts = state.ui.reactionAttempts + 1;
            setUi({ reactionAttempts: attempts });
            setValue('reaction', undefined);
            track('reaction_test_start', { protocol_version: 'snap-v1' });
          }}
          onResult={(ms) => {
            setValue('reaction', ms);
            setError(null);
            track('reaction_test_complete', { protocol_version: 'snap-v1', attempt_count_bucket: bucketAttempts(Math.max(1, state.ui.reactionAttempts)) });
          }}
        />
        <details className="rounded-md border border-line bg-surface-alt/50 p-4">
          <summary className="min-h-8 cursor-pointer text-base font-semibold">{t('steps.reaction.manualSummary')}</summary>
          <div className="mt-3">
            <Field id="f-reaction-manual" label={t('steps.reaction.manualLabel')} help={t('steps.reaction.manualHelp')} error={error?.code === 'out_of_range' || error?.code === 'not_a_number' ? errorText(error) : undefined}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  autoComplete="off"
                  value={manualText}
                  onChange={(e) => {
                    const e2 = applyManual(e.target.value);
                    setError(e.target.value.trim() === '' ? null : e2);
                  }}
                  className="max-w-48 tabular"
                />
              )}
            </Field>
          </div>
        </details>
        {state.values.reaction !== undefined && manualText === '' ? <p className="sr-only" role="status">{t('steps.reaction.result', { ms: state.values.reaction })}</p> : null}
      </StepFrame>
    );
  }

  // ---- cintura / altura ---------------------------------------------------------------------------
  if (id === 'wthr') {
    const unit = state.ui.unit;
    const waistText = state.ui.text.waist ?? '';
    const heightText = state.ui.text.height ?? '';
    const waist = parseDecimal(waistText);
    const height = parseDecimal(heightText);
    const ratio = waist !== null && height !== null ? waistToHeightRatio(waist, height) : null;

    const changeUnit = (u: LengthUnit) => {
      if (u === unit) return;
      const conv = (raw: string) => {
        const n = parseDecimal(raw);
        if (n === null) return raw;
        const v = u === 'in' ? cmToIn(n) : inToCm(n);
        return String(Math.round(v * 10) / 10);
      };
      setText('waist', conv(waistText));
      setText('height', conv(heightText));
      setUi({ unit: u });
      track('unit_system_change', { unit_system: u === 'cm' ? 'metric' : 'imperial' });
    };

    const submit = () => {
      if (waistText.trim() === '' || heightText.trim() === '') return fail({ code: 'required' });
      if (ratio === null) return fail({ code: 'not_a_number' });
      const code = validateField('waist_to_height_ratio', ratio);
      if (code) {
        const [min, max] = rangeOf('waist_to_height_ratio');
        return fail({ code: 'ratio_range', min, max });
      }
      setError(null);
      setValue('wthr', ratio);
      complete();
    };

    return (
      <StepFrame index={index} title={t('steps.wthr.q')} help={t('steps.wthr.help')} error={error ? errorText(error) : null} onSubmit={submit} onBack={goBack}>
        <fieldset className="space-y-2">
          <legend className="text-base font-semibold">{t('steps.wthr.unitLabel')}</legend>
          <div className="inline-flex rounded-md border border-line bg-surface-alt p-1" role="radiogroup" aria-label={t('steps.wthr.unitLabel')}>
            {(['cm', 'in'] as const).map((u) => (
              <label
                key={u}
                className={`flex min-h-11 min-w-28 cursor-pointer items-center justify-center rounded-sm px-4 text-sm font-bold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/30 ${unit === u ? 'bg-primary text-primary-fg shadow-soft' : 'text-muted hover:text-fg'}`}
              >
                <input type="radio" name="unit" value={u} checked={unit === u} onChange={() => changeUnit(u)} className="sr-only" />
                {u === 'cm' ? t('steps.wthr.metric') : t('steps.wthr.imperial')}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="f-waist" label={`${t('steps.wthr.waist')} (${unit})`} required requiredLabel={t('a11y.required')}>
            {(p) => (
              <Input {...p} inputMode="decimal" autoComplete="off" autoFocus value={waistText} onChange={(e) => { setText('waist', e.target.value); setError(null); }} className="text-2xl font-bold tabular" />
            )}
          </Field>
          <Field id="f-height" label={`${t('steps.wthr.height')} (${unit})`} required requiredLabel={t('a11y.required')}>
            {(p) => (
              <Input {...p} inputMode="decimal" autoComplete="off" value={heightText} onChange={(e) => { setText('height', e.target.value); setError(null); }} className="text-2xl font-bold tabular" />
            )}
          </Field>
        </div>
        <p className="text-sm text-muted">{t('steps.wthr.howTo')}</p>
        <p className="rounded-md bg-surface-alt px-4 py-3 text-lg font-bold tabular" aria-live="polite">
          {ratio !== null ? t('steps.wthr.ratio', { ratio: formatNumber(locale, ratio, 3, 3) }) : <span className="font-normal text-muted">{t('steps.wthr.ratioPending')}</span>}
        </p>
      </StepFrame>
    );
  }

  // ---- alcohol --------------------------------------------------------------------------------
  const mode = state.ui.alcoholMode;
  const aText = state.ui.text.alcohol ?? '';
  const aNum = parseDecimal(aText);
  const units = aNum !== null && aNum >= 0 ? alcoholToUkUnits(aNum, mode) : null;
  const [aMin, aMax] = rangeOf('alcohol_units_week');
  const submit = () => {
    if (aText.trim() === '') return fail({ code: 'required' });
    if (aNum === null) return fail({ code: 'not_a_number' });
    const converted = alcoholToUkUnits(aNum, mode);
    const code = validateField('alcohol_units_week', converted);
    if (code) return fail({ code: 'alcohol_range', min: aMin, max: aMax });
    setError(null);
    setValue('alcohol', converted);
    complete();
  };
  return (
    <StepFrame index={index} title={t('steps.alcohol.q')} help={t('steps.alcohol.help')} error={error ? errorText(error) : null} onSubmit={submit} onBack={goBack}>
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">{t('steps.alcohol.modeLabel')}</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {(['us_drinks', 'uk_units', 'grams'] as const satisfies readonly AlcoholMode[]).map((m) => (
            <label
              key={m}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/30 ${mode === m ? 'border-primary bg-primary/8 ring-2 ring-primary' : 'border-line bg-surface hover:border-primary/60'}`}
            >
              <input
                type="radio"
                name="alcohol-mode"
                value={m}
                checked={mode === m}
                onChange={() => {
                  setUi({ alcoholMode: m });
                  setError(null);
                  track('alcohol_unit_mode_change', { unit_mode: m });
                }}
                className="sr-only"
              />
              <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${mode === m ? 'border-primary' : 'border-line'}`}>
                {mode === m ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
              {t(`steps.alcohol.modes.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="f-alcohol" label={t(`steps.alcohol.inputLabel.${mode}`)} required requiredLabel={t('a11y.required')}>
        {(p) => (
          <Input {...p} inputMode="decimal" autoComplete="off" autoFocus value={aText} onChange={(e) => { setText('alcohol', e.target.value); setError(null); }} className="max-w-56 text-2xl font-bold tabular" />
        )}
      </Field>
      <p className="rounded-md bg-surface-alt px-4 py-3 text-lg font-bold tabular" aria-live="polite">
        {units !== null ? t('steps.alcohol.equivalent', { units: formatNumber(locale, units, 0, 2) }) : <span className="font-normal text-muted">{t('steps.alcohol.note')}</span>}
      </p>
      <p className="text-sm text-muted">{t('steps.alcohol.note')}</p>
    </StepFrame>
  );
}
