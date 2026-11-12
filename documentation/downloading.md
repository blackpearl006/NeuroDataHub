# Downloading datasets (CLI)

The CLI is `neurodatahub-cli`. See its [README](https://github.com/blackpearl006/neurodatahub-cli) for the full command reference.

## Install

```bash
pip install neurodatahub-cli
```

## Download

```bash
neurodatahub pull HBN ./data/HBN
neurodatahub pull HBN ./data/HBN --dry-run   # preview only
```

## Requirements by source

Different datasets need different tools. Run `neurodatahub check` to see what is missing.

| Source | Tool |
| --- | --- |
| INDI, OpenNeuro | AWS CLI, aria2c |
| ReproBrainChart | DataLad |
| IDA-LONI (ADNI, PPMI, AIBL, MCSA) | Account, interactive steps in Firefox |

## Using downloaded data with Nipoppy

```{note}
This section is a stub. The Nipoppy workflow is not yet documented here.
```

## Authentication

Some datasets need credentials or a data use agreement (for example HCP, ADNI, PPMI).
The CLI guides you through the steps for each one.
