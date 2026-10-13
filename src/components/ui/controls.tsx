'use client';

import * as React from 'react';
import { Accordion as AccordionPrimitive, Checkbox as CheckboxPrimitive, RadioGroup as RadioPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Tarjetas de opción (radio). Selección con icono + borde + texto: no depende del color. */
export function RadioCards({
  legend,
  value,
  onValueChange,
  options,
  error,
  id,
  describedBy,
}: {
  legend: string;
  value: string | undefined;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  id: string;
  describedBy?: string;
}) {
  return (
    <RadioPrimitive.Root
      value={value ?? ''}
      onValueChange={onValueChange}
      aria-label={legend}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required
      className="grid gap-3 sm:grid-cols-2"
      id={id}
    >
      {options.map((o) => {
        const itemId = `${id}-${o.value}`;
        return (
          <label
            key={o.value}
            htmlFor={itemId}
            className={cn(
              'group flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-lg font-semibold shadow-soft transition-[border-color,background-color,box-shadow] hover:border-primary/60 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/25',
              value === o.value && 'border-primary bg-primary/8 ring-2 ring-primary',
            )}
          >
            <RadioPrimitive.Item
              id={itemId}
              value={o.value}
              className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-line bg-surface outline-none data-[state=checked]:border-primary"
            >
              <RadioPrimitive.Indicator className="size-3 rounded-full bg-primary" />
            </RadioPrimitive.Item>
            <span>{o.label}</span>
          </label>
        );
      })}
    </RadioPrimitive.Root>
  );
}

export function CheckboxField({
  id,
  checked,
  onCheckedChange,
  children,
  required,
  describedBy,
  invalid,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: React.ReactNode;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm border-2 border-line bg-surface shadow-soft transition-colors hover:border-primary/70 data-[state=checked]:border-primary data-[state=checked]:bg-primary aria-[invalid=true]:border-danger"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-4 text-primary-fg" aria-hidden="true" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="min-h-6 cursor-pointer text-base leading-snug">
        {children}
      </label>
    </div>
  );
}

export function Accordion({
  items,
  type = 'single',
}: {
  items: Array<{ id: string; title: React.ReactNode; content: React.ReactNode }>;
  type?: 'single' | 'multiple';
}) {
  const props = type === 'single' ? ({ type: 'single', collapsible: true } as const) : ({ type: 'multiple' } as const);
  return (
    <AccordionPrimitive.Root {...props} className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.id} value={item.id}>
          <AccordionPrimitive.Header asChild>
            <h3>
              <AccordionPrimitive.Trigger className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold hover:bg-surface-alt">
                <span>{item.title}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              </AccordionPrimitive.Trigger>
            </h3>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden px-5 text-muted data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
            <div className="pb-5 pt-1 leading-relaxed">{item.content}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}
