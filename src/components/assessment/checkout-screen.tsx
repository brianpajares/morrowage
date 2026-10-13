'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/api-client';
import { track } from '@/lib/analytics/client';
import { useAssessment } from '@/lib/assessment/state';
import { INTL_TAG, type Locale } from '@/lib/locales';
import { useTurnstile } from '@/lib/turnstile-client';
import { emailSchema } from '@/lib/validation';

export interface PriceInfo {
  priceId: string;
  amountMinor: number;
  currency: string;
}

/** Checkout one-time (Fase 2, detrás de flag). No se carga ningún SDK de pago: se redirige a Stripe Checkout. */
export function CheckoutScreen({ price }: { price: PriceInfo | null }) {
  const t = useTranslations('checkout');
  const te = useTranslations('errors');
  const tp = useTranslations('preview');
  const locale = useLocale() as Locale;
  const { state } = useAssessment();
  const { getToken } = useTurnstile();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calc = state.calculation;

  const formatted = price
    ? new Intl.NumberFormat(INTL_TAG[locale], { style: 'currency', currency: price.currency, maximumFractionDigits: price.amountMinor % 100 === 0 ? 0 : 2 }).format(price.amountMinor / 100)
    : null;

  useEffect(() => {
    if (price) track('checkout_view', { price_id: price.priceId, currency: price.currency });
  }, [price]);

  if (!state.hydrated) return <div className="container-page py-24" aria-busy="true" />;
  if (!calc || !price) {
    return (
      <div className="container-page flex justify-center py-16">
        <Card className="w-full max-w-[720px] space-y-4 text-center">
          <p className="text-lg">{price ? tp('expiredBody') : t('priceUnavailable')}</p>
          <Button asChild>
            <Link href="/calculate">{tp('restart')}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    setEmailError(parsed.success ? null : te('email'));
    if (!parsed.success) return;
    if (!consent) return setError(t('errors.generic'));
    setBusy(true);
    const token = await getToken();
    const res = await postJson<{ checkoutUrl: string }>(
      '/api/stripe/checkout',
      { calculationId: calc.id, email: parsed.data, locale, priceId: price.priceId, serviceConsent: true },
      { locale, turnstileToken: token },
    );
    if (!res.ok) {
      setBusy(false);
      setError(res.code === 'session_mismatch' || res.code === 'calculation_not_found' ? t('errors.session') : t('errors.generic'));
      return;
    }
    window.location.assign(res.data.checkoutUrl);
  };

  return (
    <div className="container-page flex justify-center py-8 sm:py-14">
      <form onSubmit={submit} noValidate className="w-full max-w-[720px]" aria-labelledby="co-title">
        <Card className="animate-fade-up space-y-6 sm:p-10">
          <div className="space-y-2">
            <h1 id="co-title" className="text-3xl font-extrabold">
              {t('title')}
            </h1>
            <p className="text-lg text-muted">{t('value')}</p>
          </div>
          <Field id="co-email" label={t('emailLabel')} help={t('emailHelp')} error={emailError ?? undefined} required>
            {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} />}
          </Field>
          <CheckboxField id="co-consent" checked={consent} onCheckedChange={setConsent}>
            {t('consent')}
          </CheckboxField>
          {error ? <p role="alert" className="font-semibold text-danger">{error}</p> : null}
          <Button type="submit" size="lg" block loading={busy} loadingText={t('redirecting')}>
            {t('cta', { price: formatted ?? '' })}
          </Button>
          <div className="space-y-1 text-xs text-muted">
            <p className="flex items-center gap-2"><Lock className="size-3.5" aria-hidden="true" />{t('paymentNote')}</p>
            <p>
              {t('refundNote')}{' '}
              <Link href="/terms" className="font-semibold underline underline-offset-4">{t('termsLink')}</Link>
            </p>
          </div>
        </Card>
      </form>
    </div>
  );
}
