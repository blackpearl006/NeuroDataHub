"""Generate one documentation page per dataset from the metadata TSV.

The pages are written to ``datasets/pages/`` at the start of every build.
That folder is git-ignored, so the pages cannot drift from the TSV.
"""

import csv
import re
import shutil
from pathlib import Path

# (TSV column, label) for the facts table. Empty values are skipped.
FACT_COLUMNS = [
    ("Abbreviation", "Full name"),
    ("Pathology", "Pathology"),
    ("Sites", "Sites"),
    ("SUBJECT", "Subjects"),
    ("SCANS", "Scans"),
    ("MALES", "Males"),
    ("FEMALES", "Females"),
    ("MINAGE", "Minimum age"),
    ("MAXAGE", "Maximum age"),
    ("MEANAGE", "Mean age"),
    ("Data", "Data types"),
    ("Design", "Design"),
    ("Population", "Population"),
    ("Platform", "Download platform"),
    ("LaunchYear", "Launch year"),
]

MODALITY_COLUMNS = [
    ("anat", "Anatomical MRI"),
    ("rs-fMRI", "Resting-state fMRI"),
    ("t-fMRI", "Task fMRI"),
    ("dwi", "DWI"),
    ("eeg", "EEG"),
    ("pet", "PET"),
    ("cognitive", "Cognitive"),
    ("behavioural", "Behavioural"),
    ("genetics", "Genetics"),
    ("fluid_biomarkers", "Fluid biomarkers"),
]


def _slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _is_url(text):
    return text.startswith(("http://", "https://"))


def _render(row):
    name = row["DATASET"].strip()
    lines = [f"# {name}", ""]
    description = row.get("Description", "").strip()
    if description:
        lines += [description, ""]

    lines += ["| Property | Value |", "| --- | --- |"]
    for column, label in FACT_COLUMNS:
        value = row.get(column, "").strip()
        if value:
            lines.append(f"| {label} | {value} |")
    lines.append("")

    modalities = [
        label
        for column, label in MODALITY_COLUMNS
        if row.get(column, "").strip() not in ("", "0")
    ]
    if modalities:
        lines += ["## Modalities", "", *[f"- {m}" for m in modalities], ""]

    links = []
    if _is_url(row.get("LINK", "").strip()):
        links.append(f"- [Dataset website]({row['LINK'].strip()})")
    if _is_url(row.get("Publication", "").strip()):
        links.append(f"- [Publication]({row['Publication'].strip()})")
    for i in (1, 2):
        url = row.get(f"Research_Article_{i}_Link", "").strip()
        title = row.get(f"Research_Article_{i}_Title", "").strip()
        if _is_url(url):
            links.append(f"- [{title or url}]({url})")
    if links:
        lines += ["## Links", "", *links, ""]

    lines += [
        "## Download",
        "",
        "```bash",
        f"neurodatahub pull {name} ./data/{name}",
        "```",
        "",
        "See {doc}`/downloading` for requirements and authentication.",
        "",
    ]
    return "\n".join(lines)


def generate(app):
    srcdir = Path(app.srcdir)
    tsv = (srcdir / app.config.dataset_metadata_tsv).resolve()
    out = srcdir / "datasets" / "pages"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    with open(tsv, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f, delimiter="\t") if r.get("DATASET")]

    for row in rows:
        (out / f"{_slug(row['DATASET'])}.md").write_text(_render(row), encoding="utf-8")


def setup(app):
    app.add_config_value("dataset_metadata_tsv", "", "env")
    app.connect("builder-inited", generate)
    return {"parallel_read_safe": True, "parallel_write_safe": True}
