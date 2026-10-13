'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { postJson } from '@/lib/api-client';
import { track } from '@/lib/analytics/client';
import type { Locale } from '@/lib/locales';
import { isVerificationId } from '@/lib/security/tokens-client';
import { useTurnstile } from '@/lib/turnstile-client';
import { emailSchema } from '@/lib/validation';

export function DeleteRequestForm({ initialVerificationId }: { initialVerificationId: string }) {
  const t = useTranslations('deleteRequest');
  const te = useTranslations('errors');
  const ta = useTranslations('a11y');
  const locale = useLocale() as Locale;
  const { getToken } = useTurnstile();
  const [email, setEmail] = useState('');
  const [vid, setVid] = useState(initialVerificationId);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [vidError, setVidError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    track('delete_data_request', { origin_screen: initialVerificationId ? 'report' : 'footer' });
  }, [initialVerificationId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = emailSchema.safeParse(email);
    const cleanVid = vid.trim().toUpperCase();
    const vidOk = cleanVid === '' || isVerificationId(cleanVid);
    setEmailError(parsed.success ? null : te('email'));
    setVidError(vidOk ? null : t('errors.vid'));
    if (!parsed.success || !vidOk) return;

    setBusy(true);
    const token = await getToken();
    const res = await postJson<{ requestId: string }>(
      '/api/privacy/delete-request',
      { email: parsed.data, locale, verificationId: cleanVid || null },
      { locale, turnstileToken: token },
    );
    setBusy(false);
    if (!res.ok) {
      setFormError(res.status === 429 ? t('errors.rate') : res.code === 'turnstile_failed' ? t('errors.turnstile') : t('errors.generic'));
      return;
    }
    setDoneId(res.data.requestId.slice(0, 8).toUpperCase());
  };

  if (doneId) {
    return (
      <Card className="space-y-3" role="status">
        <CheckCircle2 className="size-9 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-extrabold">{t('successTitle')}</h2>
        <p>{t('successBody', { id: doneId })}</p>
        <p className="text-sm text-muted">{t('note')}</p>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5">
        <Field id="del-email" label={t('emailLabel')} error={emailError ?? undefined} required requiredLabel={ta('required')}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} />}
        </Field>
        <Field id="del-vid" label={t('vidLabel')} help={t('vidHelp')} error={vidError ?? undefined}>
          {(p) => <Input {...p} autoComplete="off" value={vid} onChange={(e) => { setVid(e.target.value); setVidError(null); }} className="max-w-64 font-mono uppercase" />}
        </Field>
        {formError ? <p role="alert" className="font-semibold text-danger">{formError}</p> : null}
        <Button type="submit" size="lg" loading={busy} loadingText={t('submitting')}>
          {t('submit')}
        </Button>
        <p className="text-xs text-muted">{t('note')}</p>
      </Card>
    </form>
  );
}
