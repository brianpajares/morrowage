import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { StepScreen } from '@/components/assessment/step-screen';
import { STEP_IDS, isStepId } from '@/lib/assessment/steps';
import { LOCALES, type Locale } from '@/lib/locales';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => STEP_IDS.map((step) => ({ locale, step })));
}

export default async function StepPage({ params }: { params: Promise<{ locale: Locale; step: string }> }) {
  const { locale, step } = await params;
  setRequestLocale(locale);
  if (!isStepId(step)) notFound();
  return <StepScreen stepId={step} />;
}
