import * as React from 'react';
import { cn } from '@/lib/cn';

export interface FieldChildProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required'?: true;
}

/**
 * Campo accesible: etiqueta visible y persistente, ayuda y error asociados por `aria-describedby`.
 * El error lleva icono + texto (no depende del color) y se anuncia con `role="alert"`.
 */
export function Field({
  id,
  label,
  help,
  error,
  required,
  requiredLabel,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  requiredLabel?: string;
  className?: string;
  children: (props: FieldChildProps) => React.ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
        {required && requiredLabel ? <span className="sr-only"> ({requiredLabel})</span> : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        ...(required ? { 'aria-required': true as const } : {}),
      })}
      {help ? (
        <p id={helpId} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-sm font-semibold text-danger">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0 fill-current">
            <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-.9 4.4h1.8v5.2H9.1V5.9Zm0 6.6h1.8v1.8H9.1v-1.8Z" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'block min-h-13 w-full rounded-md border border-line bg-surface px-4 py-3 text-lg text-fg shadow-soft placeholder:text-locked transition-[border-color,box-shadow] aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/30 hover:border-primary/60 focus:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);
