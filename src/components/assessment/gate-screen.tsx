'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api-client';
import { track } from '@/lib/analytics/client';
import { useAssessment } from '@/lib/assessment/state';
import type { Locale } from '@/lib/locales';
import { useTurnstile } from '@/lib/turnstile-client';
import { emailSchema } from '@/lib/validation';

/** Email gate de la fase `validation` (FR-08): servicio ≠ marketing; sin dark patterns; sin cobro. */
export function GateScreen() {
  const t = useTranslations('email_gate');
  const te = useTranslations('errors');
  const tp = useTranslations('preview');
  const ta = useTranslations('a11y');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { state, setDelivery } = useAssessment();
  const { getToken } = useTurnstile();
  const [email, setEmail] = useState('');
  const [service, setService] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const calc = state.calculation;

  useEffect(() => {
    if (state.hydrated && calc) track('report_gate_view', { phase: 'validation' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated, !!calc]);

  if (!state.hydrated) return <div className="container-page py-24" aria-busy="true" />;
  if (!calc) {
    return (
      <div className="container-page flex justify-center py-16">
        <Card className="w-full max-w-[720px] space-y-4 text-center">
          <h1 className="text-2xl font-extrabold">{tp('expiredTitle')}</h1>
          <p className="text-muted">{tp('expiredBody')}</p>
          <Button asChild>
            <Link href="/calculate">{tp('restart')}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = emailSchema.safeParse(email);
    setEmailError(parsed.success ? null : te('email'));
    setConsentError(service ? null : t('errors.consent'));
    if (!parsed.success || !service) {
      (document.getElementById(parsed.success ? 'f-service' : 'f-email') as HTMLElement | null)?.focus();
      return;
    }
    setBusy(true);
    const token = await getToken();
    const res = await postJson<{ leadId: string; reportUrl: string }>(
      '/api/leads',
      { calculationId: calc.id, email: parsed.data, locale, serviceConsent: true, marketingOptIn: marketing, subscriptionWaitlistOptIn: waitlist },
      { locale, turnstileToken: token },
    );
    setBusy(false);
    if (!res.ok) {
      setFormError(
        res.code === 'rate_limited' || res.status === 429
          ? t('errors.rate')
          : res.code === 'session_mismatch' || res.code === 'calculation_not_found'
            ? t('errors.session')
            : res.code === 'turnstile_failed'
              ? t('errors.turnstile')
              : res.code === 'invalid_email'
                ? te('email')
                : t('errors.generic'),
      );
      return;
    }
    setDelivery({ leadId: res.data.leadId, reportUrl: res.data.reportUrl });
    router.push('/success');
  };

  return (
    <div className="container-page flex justify-center py-8 sm:py-14">
      <form onSubmit={submit} noValidate className="w-full max-w-[720px]" aria-labelledby="gate-title">
        <Card className="animate-fade-up space-y-6 sm:p-10">
          <div className="space-y-3">
            <span className="grid size-12 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25">
              <Mail className="size-6" aria-hidden="true" />
            </span>
            <h1 id="gate-title" className="text-3xl font-extrabold">
              {t('title')}
            </h1>
            <p className="text-lg text-muted">{t('body')}</p>
          </div>

          <div className="rounded-md bg-surface-alt/70 p-4">
            <p className="text-sm font-bold">{t('benefitsTitle')}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(t.raw('benefits') as string[]).map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <Field id="f-email" label={t('email')} help={t('privacy')} error={emailError ?? undefined} required requiredLabel={ta('required')}>
            {(p) => (
              <Input {...p} type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} />
            )}
          </Field>

          <div className="space-y-4">
            <div>
              <CheckboxField id="f-service" checked={service} onCheckedChange={(v) => { setService(v); setConsentError(null); }} describedBy={consentError ? 'service-error' : undefined} invalid={Boolean(consentError)}>
                {t('consentService')}{' '}
                <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4">
                  {t('privacyLink')}
                </Link>
              </CheckboxField>
              {consentError ? (
                <p id="service-error" role="alert" className="mt-2 pl-9 text-sm font-semibold text-danger">
                  {consentError}
                </p>
              ) : null}
            </div>
            <CheckboxField id="f-marketing" checked={marketing} onCheckedChange={setMarketing}>
              {t('marketing')}
            </CheckboxField>
            <CheckboxField id="f-waitlist" checked={waitlist} onCheckedChange={setWaitlist}>
              {t('waitlist')}
            </CheckboxField>
          </div>

          <div className="space-y-2 text-xs text-muted">
            <p>{t('ownerCopy')}</p>
            <p>{t('neverShared')}</p>
          </div>

          {formError ? (
            <p role="alert" className="text-base font-semibold text-danger">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => router.push(`/preview/${calc.id}`)}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('back')}
            </Button>
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={busy} loadingText={t('submitting')}>
              {t('cta')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
