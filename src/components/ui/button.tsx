import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,box-shadow,transform,border-color] duration-150 disabled:pointer-events-none disabled:opacity-60 aria-busy:cursor-progress active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-fg shadow-soft hover:bg-primary-hover hover:shadow-card',
        secondary: 'border border-line bg-surface text-fg shadow-soft hover:bg-surface-alt',
        ghost: 'text-fg hover:bg-surface-alt',
        link: 'min-h-11 rounded-sm px-1 text-primary underline decoration-1 underline-offset-4 hover:decoration-2',
      },
      size: {
        sm: 'min-h-11 px-4 text-sm',
        md: 'min-h-12 px-5 text-base',
        lg: 'min-h-14 px-7 text-lg',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mientras es true el botón conserva su ancho y muestra `loadingText` (nunca solo un spinner). */
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, loading = false, loadingText, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
