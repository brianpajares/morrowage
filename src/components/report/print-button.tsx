'use client';

import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';

export function PrintButton({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonVariants({ variant: 'secondary', size: 'md' })}>
      {icon}
      {label}
    </button>
  );
}
