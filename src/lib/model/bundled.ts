/**
 * Parámetros del modelo empaquetados con la app (snapshot "bootstrap" verificado por SHA-256
 * en `src/lib/drive/bundled.ts`). El runtime normal obtiene los parámetros desde el loader de
 * Drive (`getModelSnapshot`), que cae a este snapshot como último recurso.
 */
import coefficients from '@drive/model/model_coefficients_v2.json';
import { parseModelParams, type ModelParams } from './params';

let cached: ModelParams | undefined;

export function getBundledModelParams(): ModelParams {
  cached ??= parseModelParams(coefficients);
  return cached;
}
