'use client';

/**
 * Estado del assessment en el navegador. Se persiste en sessionStorage (por pestaña) para conservar
 * respuestas al volver y tras recargar; NO se precompleta ninguna respuesta de salud y todo se borra
 * al cerrar la pestaña. Nada de esto se envía a analítica.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { PreviewOutput } from '@/lib/model/display';
import type { SelfRatedHealth } from '@/lib/model/input-spec';
import type { AlcoholMode, LengthUnit } from '@/lib/model/units';

export interface AssessmentValues {
  age?: number;
  sleep?: number;
  srh?: SelfRatedHealth;
  cigs?: number;
  reaction?: number;
  wthr?: number;
  alcohol?: number;
  rhr?: number;
}

export interface AssessmentUi {
  /** Texto tal como lo escribió la persona (conserva coma/punto), por paso. */
  text: Partial<Record<'age' | 'sleep' | 'cigs' | 'reactionManual' | 'waist' | 'height' | 'alcohol' | 'rhr', string>>;
  unit: LengthUnit;
  alcoholMode: AlcoholMode;
  reactionAttempts: number;
}

export interface CalculationSnapshot {
  id: string;
  output: PreviewOutput;
  expiresAt: string;
  chronological: number;
}

export interface DeliveryInfo {
  leadId: string;
  /** Enlace personal al informe (contiene el token). Solo en sessionStorage de esta pestaña. */
  reportUrl: string;
}

export interface AssessmentState {
  scopeAcceptedAt?: string;
  startedAt?: number;
  values: AssessmentValues;
  ui: AssessmentUi;
  calculation?: CalculationSnapshot;
  delivery?: DeliveryInfo;
  hydrated: boolean;
}

const initial: AssessmentState = {
  values: {},
  ui: { text: {}, unit: 'cm', alcoholMode: 'us_drinks', reactionAttempts: 0 },
  hydrated: false,
};

type Action =
  | { type: 'hydrate'; state: Omit<AssessmentState, 'hydrated'> }
  | { type: 'acceptScope'; at: string }
  | { type: 'setValue'; key: keyof AssessmentValues; value: AssessmentValues[keyof AssessmentValues] | undefined }
  | { type: 'setUi'; patch: Partial<Omit<AssessmentUi, 'text'>> }
  | { type: 'setText'; key: keyof AssessmentUi['text']; value: string }
  | { type: 'setCalculation'; calculation: CalculationSnapshot }
  | { type: 'setDelivery'; delivery: DeliveryInfo }
  | { type: 'reset' };

function reducer(state: AssessmentState, action: Action): AssessmentState {
  switch (action.type) {
    case 'hydrate':
      return { ...action.state, hydrated: true };
    case 'acceptScope':
      return { ...state, scopeAcceptedAt: action.at, startedAt: state.startedAt ?? Date.now() };
    case 'setValue': {
      const values = { ...state.values } as Record<string, unknown>;
      if (action.value === undefined) delete values[action.key];
      else values[action.key] = action.value;
      return { ...state, values: values as AssessmentValues };
    }
    case 'setUi':
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case 'setText':
      return { ...state, ui: { ...state.ui, text: { ...state.ui.text, [action.key]: action.value } } };
    case 'setCalculation':
      return { ...state, calculation: action.calculation };
    case 'setDelivery':
      return { ...state, delivery: action.delivery };
    case 'reset':
      return { ...initial, hydrated: true };
  }
}

const KEY = 'ma-assessment-v1';

interface Ctx {
  state: AssessmentState;
  acceptScope: () => void;
  setValue: (key: keyof AssessmentValues, value: AssessmentValues[keyof AssessmentValues] | undefined) => void;
  setUi: (patch: Partial<Omit<AssessmentUi, 'text'>>) => void;
  setText: (key: keyof AssessmentUi['text'], value: string) => void;
  setCalculation: (c: CalculationSnapshot) => void;
  setDelivery: (d: DeliveryInfo) => void;
  reset: () => void;
}

const AssessmentContext = createContext<Ctx | null>(null);

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<AssessmentState, 'hydrated'>;
        dispatch({ type: 'hydrate', state: { ...initial, ...parsed, ui: { ...initial.ui, ...parsed.ui, text: { ...parsed.ui?.text } } } });
        return;
      }
    } catch {
      /* almacenamiento no disponible o corrupto: se empieza limpio */
    }
    dispatch({ type: 'hydrate', state: initial });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      const { hydrated: _h, ...persist } = state;
      sessionStorage.setItem(KEY, JSON.stringify(persist));
    } catch {
      /* sin persistencia: el flujo sigue funcionando en memoria */
    }
  }, [state]);

  const acceptScope = useCallback(() => dispatch({ type: 'acceptScope', at: new Date().toISOString() }), []);
  const setValue = useCallback<Ctx['setValue']>((key, value) => dispatch({ type: 'setValue', key, value }), []);
  const setUi = useCallback<Ctx['setUi']>((patch) => dispatch({ type: 'setUi', patch }), []);
  const setText = useCallback<Ctx['setText']>((key, value) => dispatch({ type: 'setText', key, value }), []);
  const setCalculation = useCallback((calculation: CalculationSnapshot) => dispatch({ type: 'setCalculation', calculation }), []);
  const setDelivery = useCallback((delivery: DeliveryInfo) => dispatch({ type: 'setDelivery', delivery }), []);
  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    dispatch({ type: 'reset' });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ state, acceptScope, setValue, setUi, setText, setCalculation, setDelivery, reset }),
    [state, acceptScope, setValue, setUi, setText, setCalculation, setDelivery, reset],
  );
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment(): Ctx {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment fuera de AssessmentProvider');
  return ctx;
}

/** Convierte las respuestas del assessment en el payload canónico de /api/calculate. */
export function toCanonicalInputs(v: AssessmentValues) {
  return {
    age_years: v.age,
    sleep_hours: v.sleep,
    self_rated_health: v.srh,
    cigarettes_per_day: v.cigs,
    reaction_time_ms: v.reaction,
    waist_to_height_ratio: v.wthr,
    alcohol_units_week: v.alcohol,
    resting_hr_bpm: v.rhr,
  };
}
