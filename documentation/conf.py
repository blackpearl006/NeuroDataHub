"""Sphinx configuration for the NeuroDataHub documentation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "_ext"))

project = "NeuroDataHub"
author = "Ninad Aithal"
copyright = "NeuroDataHub contributors"

extensions = [
    "myst_parser",
    "sphinx_copybutton",
    "dataset_pages",
]

nitpicky = True

exclude_patterns = ["_build"]

html_theme = "furo"
html_title = "NeuroDataHub"
html_static_path = []

myst_enable_extensions = ["colon_fence", "fieldlist"]
myst_heading_anchors = 3

# Path to the dataset metadata, relative to this file
dataset_metadata_tsv = "../docs/assets/data_updated.tsv"
