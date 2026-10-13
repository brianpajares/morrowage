'use client';

import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { referrerGroup, track, type TrackProps } from '@/lib/analytics/client';
import type { EventName } from '@/lib/analytics/events';

/** Enlace que emite un evento permitido al hacer clic (p. ej. `calculate_start_click`). */
export function TrackedLink({
  event,
  props,
  withReferrer,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & { event: EventName; props?: TrackProps; withReferrer?: boolean }) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        track(event, { ...(withReferrer ? { referrer_group: referrerGroup() } : {}), ...props });
        onClick?.(e);
      }}
    />
  );
}
