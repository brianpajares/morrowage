import { cn } from '@/lib/cn';

/** Marca: una escala de edad (arco) con dos puntos —cronológica y equivalente—. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8', className)}>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M6.5 22 C11 11.5 21 11.5 25.5 22" fill="none" stroke="var(--primary-text)" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
      <circle cx="11.2" cy="17.2" r="3.1" fill="none" stroke="var(--primary-text)" strokeWidth="2" />
      <circle cx="21" cy="15.4" r="3.6" fill="var(--primary-text)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight', className)}>
      <LogoMark />
      <span>
        Morrow<span className="text-primary">Age</span>
      </span>
    </span>
  );
}
