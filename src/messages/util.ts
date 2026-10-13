/** Forma estructural de un árbol de mensajes (strings → string, arrays → arrays, objetos → objetos). */
export type Shape<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Shape<U>[]
    : T extends object
      ? { [K in keyof T]: Shape<T[K]> }
      : T;

export function deepMerge<A extends Record<string, unknown>, B extends Record<string, unknown>>(a: A, b: B): A & B {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (
      v !== null && typeof v === 'object' && !Array.isArray(v) &&
      cur !== null && typeof cur === 'object' && !Array.isArray(cur)
    ) {
      out[k] = deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as A & B;
}

/** Subconjunto de namespaces de primer nivel (para enviar al cliente solo lo necesario). */
export function pickNamespaces<T extends Record<string, unknown>, K extends keyof T>(messages: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = messages[k];
  return out;
}
