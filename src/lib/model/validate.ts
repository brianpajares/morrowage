import {
  INPUT_FIELDS,
  NUMERIC_FIELDS,
  NUMERIC_SPEC,
  SRH_VALUES,
  type InputField,
  type Inputs,
  type NumericField,
} from './input-spec';

/** Códigos estables (también usados como `error_code` de analítica; nunca contienen valores). */
export type InputErrorCode =
  | 'required'
  | 'not_a_number'
  | 'not_integer'
  | 'out_of_range'
  | 'out_of_scope'
  | 'invalid_enum'
  | 'unexpected_field';

export type InputErrors = Partial<Record<InputField | '_root', InputErrorCode>>;

export type ValidationResult =
  | { ok: true; data: Inputs }
  | { ok: false; errors: InputErrors };

/**
 * Valida un payload desconocido contra `spec/inputs.schema.json` (required, rango, integer, enum,
 * additionalProperties=false). Rechaza en lugar de recortar valores (cross_validation del spec).
 * Equivalente a `_validate` de `model/engine_reference.py`.
 */
export function validateField(field: NumericField, value: unknown): InputErrorCode | null {
  if (value === undefined || value === null) return 'required';
  if (typeof value !== 'number') return 'not_a_number';
  if (!Number.isFinite(value)) return 'not_a_number';
  const spec = NUMERIC_SPEC[field];
  if (spec.kind === 'integer' && !Number.isInteger(value)) return 'not_integer';
  if (value < spec.min || value > spec.max) {
    return field === 'age_years' ? 'out_of_scope' : 'out_of_range';
  }
  return null;
}

export function validateInputs(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: { _root: 'required' } };
  }
  const obj = raw as Record<string, unknown>;
  const errors: InputErrors = {};

  const known = new Set<string>(INPUT_FIELDS);
  if (Object.keys(obj).some((k) => !known.has(k))) errors._root = 'unexpected_field';

  for (const field of NUMERIC_FIELDS) {
    const code = validateField(field, obj[field]);
    if (code) errors[field] = code;
  }

  const srh = obj.self_rated_health;
  if (srh === undefined || srh === null) errors.self_rated_health = 'required';
  else if (typeof srh !== 'string' || !(SRH_VALUES as readonly string[]).includes(srh)) {
    errors.self_rated_health = 'invalid_enum';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: obj as unknown as Inputs };
}

export class InputValidationError extends Error {
  readonly errors: InputErrors;
  constructor(errors: InputErrors) {
    super('invalid_inputs');
    this.name = 'InputValidationError';
    this.errors = errors;
  }
}

/** Devuelve inputs tipados o lanza InputValidationError. */
export function assertInputs(raw: unknown): Inputs {
  const result = validateInputs(raw);
  if (!result.ok) throw new InputValidationError(result.errors);
  return result.data;
}
