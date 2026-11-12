# Contributing a dataset

Dataset information is in one file: `docs/assets/data_updated.tsv`.
One row is one dataset. The web app and these docs both read this file.

1. Add a row with the dataset's metadata.
2. Add a logo at `docs/assets/images/{dataset name}.png` (optional; a default image is used if missing).
3. Open a pull request.

Report problems or ask for a dataset in the [issue tracker](https://github.com/blackpearl006/NeuroDataHub/issues).

```{note}
This page is a stub. A column-by-column guide to the TSV will be added.
```

## Build these docs locally

```bash
pip install -r documentation/requirements.txt
sphinx-build -W --keep-going -b html documentation documentation/_build/html
```
