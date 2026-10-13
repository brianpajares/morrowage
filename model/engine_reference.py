#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r":"http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL_NS = {"p":"http://schemas.openxmlformats.org/package/2006/relationships"}

RANGES = {
    "age_years": (40, 69),
    "sleep_hours": (3, 12),
    "cigarettes_per_day": (0, 60),
    "reaction_time_ms": (250, 1500),
    "waist_to_height_ratio": (0.30, 0.90),
    "alcohol_units_week": (0, 100),
    "resting_hr_bpm": (35, 130),
}
SRH = {"excellent", "good", "fair", "poor"}

def _col_letters_to_index(s: str) -> int:
    out = 0
    for ch in s:
        out = out * 26 + (ord(ch.upper()) - 64)
    return out - 1

def _read_xlsx_sheet_rows(path: str | Path, sheet_name: str) -> list[list[object]]:
    """Minimal stdlib XLSX reader: sufficient for literal cells in Parametros."""
    path = Path(path)
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                texts = [t.text or "" for t in si.iterfind(".//m:t", NS)]
                shared.append("".join(texts))

        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("p:Relationship", REL_NS)}

        target = None
        for sh in wb.findall("m:sheets/m:sheet", NS):
            if sh.attrib.get("name") == sheet_name:
                rid = sh.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
                target = rid_to_target[rid]
                break
        if target is None:
            raise KeyError(f"Sheet not found: {sheet_name}")
        if target.startswith("/"):
            sheet_path = target.lstrip("/")
        else:
            sheet_path = "xl/" + target.lstrip("./")
        xml = ET.fromstring(z.read(sheet_path))

        cells = {}
        max_r = max_c = -1
        for c in xml.findall(".//m:c", NS):
            ref = c.attrib.get("r", "")
            m = re.match(r"([A-Z]+)(\d+)", ref)
            if not m:
                continue
            col = _col_letters_to_index(m.group(1))
            row = int(m.group(2)) - 1
            typ = c.attrib.get("t")
            value = None
            if typ == "inlineStr":
                ts = [t.text or "" for t in c.iterfind(".//m:t", NS)]
                value = "".join(ts)
            else:
                v = c.find("m:v", NS)
                if v is not None and v.text is not None:
                    raw = v.text
                    if typ == "s":
                        value = shared[int(raw)]
                    elif typ == "b":
                        value = raw == "1"
                    elif typ in ("str", "e"):
                        value = raw
                    else:
                        try:
                            value = float(raw)
                            if value.is_integer():
                                value = int(value)
                        except ValueError:
                            value = raw
            cells[(row, col)] = value
            max_r, max_c = max(max_r, row), max(max_c, col)

        rows = []
        for r in range(max_r + 1):
            rows.append([cells.get((r, c)) for c in range(max_c + 1)])
        return rows

def load_base(xlsx_path: str | Path) -> dict:
    rows = _read_xlsx_sheet_rows(xlsx_path, "Parametros")
    if not rows:
        raise ValueError("Parametros is empty")
    header = [str(x) if x is not None else "" for x in rows[0]]
    try:
        i_name = header.index("parametro")
        i_val = header.index("valor")
        i_state = header.index("estado")
    except ValueError as exc:
        raise ValueError("Parametros sheet has unexpected columns") from exc

    params = {}
    states = {}
    for row in rows[1:]:
        if len(row) <= max(i_name, i_val):
            continue
        name = row[i_name]
        if not name:
            continue
        params[str(name)] = row[i_val]
        states[str(name)] = row[i_state] if len(row) > i_state else None

    required = {
        "beta_log_age","beta_sleep","beta_srh_good","beta_srh_fair","beta_srh_poor",
        "beta_cigs","beta_reaction","beta_wthr","beta_alcohol","beta_rhr",
        "ref_sleep","ref_srh_coef","ref_cigs","ref_reaction","ref_wthr",
        "ref_alcohol","ref_rhr","ref_nonage_lp",
        "sens_sleep","sens_reaction","sens_wthr","sens_alcohol","sens_rhr"
    }
    missing = sorted(required - set(params))
    if missing:
        raise ValueError(f"Missing parameters: {missing}")
    return {"params": params, "states": states, "source_xlsx": str(xlsx_path)}

def _validate(inputs: dict) -> None:
    required = set(RANGES) | {"self_rated_health"}
    missing = sorted(required - set(inputs))
    if missing:
        raise ValueError(f"Missing inputs: {missing}")
    extra = sorted(set(inputs) - required)
    if extra:
        raise ValueError(f"Unexpected inputs: {extra}")
    for key, (lo, hi) in RANGES.items():
        v = inputs[key]
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise TypeError(f"{key} must be numeric")
        fv = float(v)
        if not math.isfinite(fv):
            raise ValueError(f"{key} must be finite")
        if not (lo <= fv <= hi):
            raise ValueError(f"{key} outside [{lo}, {hi}]")
    if inputs["self_rated_health"] not in SRH:
        raise ValueError("self_rated_health must be one of excellent|good|fair|poor")
    if int(inputs["age_years"]) != inputs["age_years"]:
        raise ValueError("age_years must be integer")
    if int(inputs["cigarettes_per_day"]) != inputs["cigarettes_per_day"]:
        raise ValueError("cigarettes_per_day must be integer")
    if int(inputs["resting_hr_bpm"]) != inputs["resting_hr_bpm"]:
        raise ValueError("resting_hr_bpm must be integer")

def calculate(inputs: dict, base: dict) -> dict:
    """Pure deterministic calculation. `base` must be the output of load_base()."""
    _validate(inputs)
    p = base["params"]
    srh_coef = {
        "excellent": 0.0,
        "good": float(p["beta_srh_good"]),
        "fair": float(p["beta_srh_fair"]),
        "poor": float(p["beta_srh_poor"]),
    }[inputs["self_rated_health"]]

    contributions = {
        "sleep_hours": float(p["beta_sleep"]) * (float(inputs["sleep_hours"]) - float(p["ref_sleep"])),
        "self_rated_health": srh_coef - float(p["ref_srh_coef"]),
        "cigarettes_per_day": float(p["beta_cigs"]) * (float(inputs["cigarettes_per_day"]) - float(p["ref_cigs"])),
        "reaction_time_ms": float(p["beta_reaction"]) * (float(inputs["reaction_time_ms"]) - float(p["ref_reaction"])),
        "waist_to_height_ratio": float(p["beta_wthr"]) * (float(inputs["waist_to_height_ratio"]) - float(p["ref_wthr"])),
        "alcohol_units_week": float(p["beta_alcohol"]) * (float(inputs["alcohol_units_week"]) - float(p["ref_alcohol"])),
        "resting_hr_bpm": float(p["beta_rhr"]) * (float(inputs["resting_hr_bpm"]) - float(p["ref_rhr"])),
    }

    eta_nonage = (
        float(p["beta_sleep"]) * float(inputs["sleep_hours"]) +
        srh_coef +
        float(p["beta_cigs"]) * float(inputs["cigarettes_per_day"]) +
        float(p["beta_reaction"]) * float(inputs["reaction_time_ms"]) +
        float(p["beta_wthr"]) * float(inputs["waist_to_height_ratio"]) +
        float(p["beta_alcohol"]) * float(inputs["alcohol_units_week"]) +
        float(p["beta_rhr"]) * float(inputs["resting_hr_bpm"])
    )
    delta_lp = eta_nonage - float(p["ref_nonage_lp"])
    beta_age = float(p["beta_log_age"])
    age = float(inputs["age_years"])
    relative_hazard = math.exp(delta_lp)
    morrow_age = age * math.exp(delta_lp / beta_age)
    delta_age = morrow_age - age

    sens_fields = (
        ("sleep_hours", "beta_sleep", "sens_sleep"),
        ("reaction_time_ms", "beta_reaction", "sens_reaction"),
        ("waist_to_height_ratio", "beta_wthr", "sens_wthr"),
        ("alcohol_units_week", "beta_alcohol", "sens_alcohol"),
        ("resting_hr_bpm", "beta_rhr", "sens_rhr"),
    )
    sens_low_lp = 0.0
    sens_high_lp = 0.0
    for field, beta_name, sens_name in sens_fields:
        lo, hi = RANGES[field]
        value = float(inputs[field])
        requested = float(p[sens_name])
        down = min(requested, max(0.0, value - lo))
        up = min(requested, max(0.0, hi - value))
        sens_low_lp += float(p[beta_name]) * down
        sens_high_lp += float(p[beta_name]) * up
    sens_low = age * math.exp((delta_lp - sens_low_lp) / beta_age)
    sens_high = age * math.exp((delta_lp + sens_high_lp) / beta_age)
    top_driver = max(contributions.items(), key=lambda kv: abs(kv[1]))

    age_min, age_max = RANGES["age_years"]
    if morrow_age < age_min:
        morrow_age_status, morrow_age_display = "BELOW_REFERENCE_RANGE", f"<{age_min:g}"
    elif morrow_age > age_max:
        morrow_age_status, morrow_age_display = "ABOVE_REFERENCE_RANGE", f">{age_max:g}"
    else:
        morrow_age_status, morrow_age_display = "WITHIN_REFERENCE_RANGE", f"{morrow_age:.1f}"

    return {
        "model_version": "2.1",
        "morrow_age": round(morrow_age, 6),
        "morrow_age_status": morrow_age_status,
        "morrow_age_display": morrow_age_display,
        "morrow_age_reference_range": [age_min, age_max],
        "delta_age": round(delta_age, 6),
        "relative_hazard": round(relative_hazard, 6),
        "eta_nonage": round(eta_nonage, 9),
        "delta_lp": round(delta_lp, 9),
        "top_driver": {"name": top_driver[0], "log_hazard_contribution": round(top_driver[1], 9)},
        "drivers": {k: round(v, 9) for k, v in contributions.items()},
        "measurement_sensitivity": {
            "type": "measurement_scenario_not_confidence_interval",
            "bounds_aware": True,
            "morrow_age_low": round(sens_low, 6),
            "morrow_age_base": round(morrow_age, 6),
            "morrow_age_high": round(sens_high, 6),
        },
        "absolute_mortality_10y": None,
        "absolute_mortality_10y_status": "LOCKED_REQUIRES_BASELINE_SURVIVAL_RECALIBRATION",
    }

def main(argv=None):
    argv = argv or sys.argv[1:]
    if len(argv) != 2:
        print("Usage: engine_reference.py BASE.xlsx INPUT.json", file=sys.stderr)
        return 2
    base = load_base(argv[0])
    inputs = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    print(json.dumps(calculate(inputs, base), ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
