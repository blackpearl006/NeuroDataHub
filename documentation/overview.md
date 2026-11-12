# Overview

NeuroDataHub lists public brain imaging datasets in one place.
Each dataset has metadata (subjects, scans, age range, pathology, modalities) and links to the original source.

## Components

| Component | What it does | Where |
| --- | --- | --- |
| Web app | Browse, filter and compare datasets | <https://blackpearl006.github.io/NeuroDataHub/> |
| CLI | Download datasets and brain atlases | <https://github.com/blackpearl006/neurodatahub-cli> |
| Metadata | One TSV file with all dataset information | `docs/assets/data_updated.tsv` in this repository |

NeuroDataHub does not host data.
Every download comes from the original source (for example INDI, OpenNeuro or IDA-LONI).
Some datasets need an account or a data use agreement.
