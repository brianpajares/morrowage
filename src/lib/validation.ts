import { z } from 'zod';

/** Email normalizado (trim + minúsculas), máx. 320 caracteres, formato válido. */
export const emailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email());
