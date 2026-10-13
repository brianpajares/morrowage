/**
 * Solicitud de borrado de datos (FR-19, AT-15). Registra la petición con estado y marca de tiempo;
 * no envía nada a analítica. El dueño recibe un aviso operacional (solo email + Verification ID, sin
 * datos de salud) y resuelve desde /admin.
 */
import { z } from 'zod';
import { emailSchema } from '@/lib/validation';
import { getEnv } from '@/lib/env';
import { LOCALES } from '@/lib/locales';
import { isVerificationId } from '@/lib/security/tokens';
import { sendEmail } from '@/server/email/send';
import { getStore } from '@/server/store';
import { ApiError } from '@/server/http';

const bodySchema = z.strictObject({
  email: emailSchema,
  locale: z.enum(LOCALES),
  verificationId: z.string().trim().max(32).nullable().optional(),
});

export async function createDeletionRequestService(
  body: unknown,
  deps: { schedule: (task: () => Promise<unknown>) => void } = { schedule: (t) => void t() },
): Promise<{ requestId: string; status: 'received' }> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'invalid_request');
  const { email, locale } = parsed.data;
  const verificationId = parsed.data.verificationId?.toUpperCase() || null;
  if (verificationId && !isVerificationId(verificationId))
    throw new ApiError(400, 'invalid_verification_id');

  const row = await getStore().insertDeletionRequest({
    email,
    locale,
    verification_id: verificationId,
  });

  const ownerEmail = getEnv().ownerEmail;
  if (ownerEmail) {
    // Aviso operacional best-effort; el registro ya está guardado aunque falle.
    deps.schedule(() =>
      sendEmail(
        {
          to: ownerEmail,
          subject: `[MorrowAge] Solicitud de borrado ${row.id.slice(0, 8)}`,
          html: `<p>Nueva solicitud de borrado de datos.</p><ul><li>Email: ${email.replace(/</g, '&lt;')}</li><li>Verification ID: ${verificationId ?? '—'}</li><li>Idioma: ${locale}</li></ul><p>Resuélvela desde /admin.</p>`,
          text: `Nueva solicitud de borrado.\nEmail: ${email}\nVerification ID: ${verificationId ?? '-'}\nIdioma: ${locale}\nResuélvela desde /admin.`,
          idempotencyKey: `ma-delete-${row.id}`,
          tag: 'owner',
        },
        { attempts: 2 },
      ),
    );
  }
  return { requestId: row.id, status: 'received' };
}
