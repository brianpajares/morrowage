#!/usr/bin/env python3
"""Independent QA reimplementation of MorrowAge model wrapper v2.1.

Source of truth used for the initial implementation:
- 02_datos_modelo/model_spec.json
- 02_datos_modelo/base_morrowage.xlsx (parameters/benchmarks only)

This file intentionally does not import engine_reference.py.
Stage-3 fixes add bounds-aware measurement sensitivity and display guardrails;
the underlying Cox coefficients and raw risk-equivalent-age transform are unchanged.
"""
from __future__ import annotations
import math
from typing import Any, Dict

BETA_LOG_AGE = 3.8622
BETA = {
    "sleep_hours": 0.0750,
    "cigarettes_per_day": 0.0685,
    "reaction_time_ms": 0.0008,
    "waist_to_height_ratio": 1.1679,
    "alcohol_units_week": 0.0077,
    "resting_hr_bpm": 0.0133,
}
SRH_BETA = {"excellent": 0.0, "good": 0.0964, "fair": 0.6310, "poor": 2.5479}
REF = {
    "sleep_hours": 7.16,
    "self_rated_health_coef": 0.29910076,
    "cigarettes_per_day": 0.0,
    "reaction_time_ms": 558.03,
    "waist_to_height_ratio": 0.54,
    "alcohol_units_week": 14.34,
    "resting_hr_bpm": 69.84,
}
REF_NONAGE_LP = 2.95248076
RANGES = {
    "age_years": (40, 69),
    "sleep_hours": (3, 12),
    "cigarettes_per_day": (0, 60),
    "reaction_time_ms": (250, 1500),
    "waist_to_height_ratio": (0.3, 0.9),
    "alcohol_units_week": (0, 100),
    "resting_hr_bpm": (35, 130),
}
INTEGER_FIELDS = {"age_years", "cigarettes_per_day", "resting_hr_bpm"}
SENS_DELTAS = {
    "sleep_hours": 0.5,
    "reaction_time_ms": 50.0,
    "waist_to_height_ratio": 0.02,
    "alcohol_units_week": 2.0,
    "resting_hr_bpm": 5.0,
}
MODEL_VERSION = "2.1"


class ValidationError(ValueError):
    pass


def _finite_number(name: str, value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{name} must be numeric")
    x = float(value)
    if not math.isfinite(x):
        raise ValidationError(f"{name} must be finite")
    return x


def validate_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    required = set(RANGES) | {"self_rated_health"}
    missing = required - set(inputs)
    extra = set(inputs) - required
    if missing:
        raise ValidationError(f"missing fields: {sorted(missing)}")
    if extra:
        raise ValidationError(f"unexpected fields: {sorted(extra)}")

    out: Dict[str, Any] = {}
    for name, (lo, hi) in RANGES.items():
        x = _finite_number(name, inputs[name])
        if name in INTEGER_FIELDS and not x.is_integer():
            raise ValidationError(f"{name} must be an integer")
        if x < lo or x > hi:
            raise ValidationError(f"{name} outside [{lo}, {hi}]")
        out[name] = int(x) if name in INTEGER_FIELDS else x

    srh = inputs["self_rated_health"]
    if srh not in SRH_BETA:
        raise ValidationError(f"self_rated_health must be one of {sorted(SRH_BETA)}")
    out["self_rated_health"] = srh
    return out


def _display_age(raw_age: float) -> tuple[str, str]:
    lo, hi = RANGES["age_years"]
    if raw_age < lo:
        return "BELOW_REFERENCE_RANGE", f"<{lo:g}"
    if raw_age > hi:
        return "ABOVE_REFERENCE_RANGE", f">{hi:g}"
    return "WITHIN_REFERENCE_RANGE", f"{raw_age:.1f}"


def _sensitivity_lp(x: Dict[str, Any]) -> tuple[float, float]:
    """Return feasible LP decrement/increment without crossing product guardrails."""
    low_lp = 0.0
    high_lp = 0.0
    for name, requested_delta in SENS_DELTAS.items():
        lo, hi = RANGES[name]
        down = min(requested_delta, max(0.0, float(x[name]) - lo))
        up = min(requested_delta, max(0.0, hi - float(x[name])))
        low_lp += BETA[name] * down
        high_lp += BETA[name] * up
    return low_lp, high_lp


def calculate(inputs: Dict[str, Any]) -> Dict[str, Any]:
    x = validate_inputs(inputs)

    drivers = {
        "sleep_hours": BETA["sleep_hours"] * (x["sleep_hours"] - REF["sleep_hours"]),
        "self_rated_health": SRH_BETA[x["self_rated_health"]] - REF["self_rated_health_coef"],
        "cigarettes_per_day": BETA["cigarettes_per_day"] * (x["cigarettes_per_day"] - REF["cigarettes_per_day"]),
        "reaction_time_ms": BETA["reaction_time_ms"] * (x["reaction_time_ms"] - REF["reaction_time_ms"]),
        "waist_to_height_ratio": BETA["waist_to_height_ratio"] * (x["waist_to_height_ratio"] - REF["waist_to_height_ratio"]),
        "alcohol_units_week": BETA["alcohol_units_week"] * (x["alcohol_units_week"] - REF["alcohol_units_week"]),
        "resting_hr_bpm": BETA["resting_hr_bpm"] * (x["resting_hr_bpm"] - REF["resting_hr_bpm"]),
    }
    delta_lp = sum(drivers.values())
    eta_nonage = REF_NONAGE_LP + delta_lp
    relative_hazard = math.exp(delta_lp)
    morrow_age = x["age_years"] * math.exp(delta_lp / BETA_LOG_AGE)
    delta_age = morrow_age - x["age_years"]
    status, display = _display_age(morrow_age)

    top_name = max(drivers, key=lambda k: abs(drivers[k]))
    sens_low_lp, sens_high_lp = _sensitivity_lp(x)
    sens_low = x["age_years"] * math.exp((delta_lp - sens_low_lp) / BETA_LOG_AGE)
    sens_high = x["age_years"] * math.exp((delta_lp + sens_high_lp) / BETA_LOG_AGE)

    return {
        "model_version": MODEL_VERSION,
        "morrow_age": morrow_age,
        "morrow_age_status": status,
        "morrow_age_display": display,
        "morrow_age_reference_range": list(RANGES["age_years"]),
        "delta_age": delta_age,
        "relative_hazard": relative_hazard,
        "eta_nonage": eta_nonage,
        "delta_lp": delta_lp,
        "top_driver": {
            "name": top_name,
            "log_hazard_contribution": drivers[top_name],
        },
        "drivers": drivers,
        "measurement_sensitivity": {
            "type": "measurement_scenario_not_confidence_interval",
            "bounds_aware": True,
            "morrow_age_low": sens_low,
            "morrow_age_base": morrow_age,
            "morrow_age_high": sens_high,
        },
        "absolute_mortality_10y": None,
        "absolute_mortality_10y_status": "LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION",
    }


def us_standard_drinks_to_uk_units(drinks: float) -> float:
    x = _finite_number("drinks", drinks)
    if x < 0:
        raise ValidationError("drinks must be >= 0")
    return x * 1.75


def grams_ethanol_to_uk_units(grams: float) -> float:
    x = _finite_number("grams", grams)
    if x < 0:
        raise ValidationError("grams must be >= 0")
    return x / 8.0


def waist_to_height_ratio(waist: float, height: float) -> float:
    w = _finite_number("waist", waist)
    h = _finite_number("height", height)
    if w <= 0 or h <= 0:
        raise ValidationError("waist and height must be > 0")
    return w / h


if __name__ == "__main__":
    import json, sys
    payload = json.load(sys.stdin)
    json.dump(calculate(payload), sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
