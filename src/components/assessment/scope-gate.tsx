'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics/client';
import { useAssessment } from '@/lib/assessment/state';

/** Aceptar el alcance es obligatorio para continuar (AT-02): sin clic no hay pasos ni cálculo. */
export function ScopeGate() {
  const t = useTranslations('scope');
  const tc = useTranslations('common');
  const router = useRouter();
  const { acceptScope } = useAssessment();
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Button variant="secondary" asChild>
        <Link href="/">{tc('back')}</Link>
      </Button>
      <Button
        className="flex-1 sm:flex-none"
        onClick={() => {
          acceptScope();
          track('scope_accept');
          router.push('/calculate/age');
        }}
      >
        {t('cta')}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
