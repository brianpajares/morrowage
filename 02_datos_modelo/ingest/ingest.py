#!/usr/bin/env python3
"""
MorrowAge — pipeline de ingestión para futura recalibración US.
No es requerido por el motor v2 (que usa coeficientes publicados).
Descarga únicamente fuentes oficiales NCHS/CDC y crea un manifest de archivos.

IMPORTANTE:
- Los nombres/códigos de variables NHANES cambian por ciclo.
- El programador debe completar el mapeo por ciclo antes de entrenar.
- Nunca juntar mortality files restricted-use con una app pública.
"""
from __future__ import annotations
import hashlib
import json
import pathlib
import urllib.request

OUT = pathlib.Path(__file__).resolve().parent / "downloads"
OUT.mkdir(parents=True, exist_ok=True)

# Fuente oficial. El directorio contiene los public-use linked mortality files.
SOURCES = {
    "linked_mortality_directory": "https://ftp.cdc.gov/pub/health_statistics/NCHS/datalinkage/linked_mortality/",
    "linked_mortality_landing": "https://www.cdc.gov/nchs/linked-data/mortality-files/index.html",
    "nhanes_landing": "https://www.cdc.gov/nchs/nhanes/index.html",
    "life_tables": "https://www.cdc.gov/nchs/products/life_tables.htm",
}

def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def download(url: str, filename: str) -> dict:
    target = OUT / filename
    with urllib.request.urlopen(url) as r, target.open("wb") as f:
        f.write(r.read())
    return {"url": url, "file": str(target), "sha256": sha256(target)}

def validate_public_use_record(record: dict) -> None:
    # Placeholder hard guard: downstream schema must contain the public-use survival fields
    # after cycle-specific parsing. No PII or restricted-use geography may be accepted.
    forbidden = {"name", "address", "ssn", "exact_date_of_death"}
    overlap = forbidden & set(record)
    if overlap:
        raise ValueError(f"PII/restricted-looking fields not allowed: {sorted(overlap)}")

def main():
    manifest = {
        "purpose": "Future US recalibration; not used in v2 runtime",
        "sources": SOURCES,
        "required_transformations": [
            "Map NHANES cycle-specific variable codes to the eight MorrowAge constructs where available.",
            "Use public-use linked mortality eligibility/status and person-month follow-up fields.",
            "Respect NHANES complex-survey weights/strata/PSU in descriptive calibration diagnostics.",
            "Split by participant, never by row; reserve an external/temporal holdout.",
            "Fit/recalibrate a survival model only after documenting missingness and harmonization."
        ],
        "validation": [
            "Reject duplicate participant identifiers after harmonization.",
            "Reject impossible follow-up times.",
            "Record cycle, source URL, retrieval date and SHA-256 for every downloaded file.",
            "No restricted-use variables or PII."
        ]
    }
    (OUT / "README_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
