# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NeuroDataHub is an open-access web platform for exploring and analyzing neuroimaging datasets. It showcases 50+ curated public brain imaging datasets with over 50,000 scans, built as a single-page application using Vue.js 2 and vanilla JavaScript.

## Architecture

**Frontend Framework**: Vue.js 2 (CDN-based, no build system)
- Main application: `index.html` with Vue instance in `docs/js/app.js`
- Data loading: TSV file parsing for dataset metadata (`docs/assets/data_updated.tsv`)
- Styling: Custom CSS (`docs/css/style.css`) built on Clarity template

**Key Components**:
- Dataset viewer with grid/table toggle view modes
- Modal system for detailed dataset information
- Interactive filtering (search, pathology, age range with noUiSlider)
- Chart.js integration for age/gender distribution visualization
- Responsive design with mobile-specific layouts

**External Dependencies** (CDN):
- Vue.js 2
- Chart.js (for data visualization)
- noUiSlider (for age range filtering)
- NiiVue (for neuroimaging visualization)
- FontAwesome icons

## Development Workflow

**No Build System**: This is a static website with no package.json or build pipeline. All dependencies are loaded via CDN.

**File Structure**:
- `index.html` - Main page and Vue application
- `docs/js/app.js` - Vue.js application logic and data handling
- `docs/css/style.css` - Main stylesheet
- `docs/assets/data_updated.tsv` - Dataset metadata (tab-separated values)
- `docs/assets/images/` - Dataset logos and brain visualizations
- `docs/clarity-template/` - Base template from Clarity framework

**Data Management**:
- Dataset information stored in TSV format for easy editing
- Images follow naming convention: `{dataset.name}.png`
- Fallback image: `indi.png` for missing dataset images

**Development Server**: Use any static file server (e.g., `python -m http.server`, Live Server extension)

## Key Features

**Dataset Management**:
- 50+ neuroimaging datasets with comprehensive metadata
- Filtering by pathology (Alzheimer's, Autism, Schizophrenia, etc.)
- Age range filtering with interactive slider
- Search functionality across dataset names

**Data Visualization**:
- Age distribution histograms using Chart.js
- Gender distribution pie charts
- Interactive modality icons (Anatomical MRI, fMRI, DWI, EEG, PET, etc.)

**Research Integration**:
- Links to original publications and dataset websites
- Research article recommendations with expandable descriptions
- Citation information and DOI links

## Working with Datasets

To add or modify datasets, edit `docs/assets/data_updated.tsv`. The TSV format includes columns for:
- Basic info: DATASET, ABBREVIATION, SUBJECTS, SCANS
- Demographics: MALES, FEMALES, MINAGE, MAXAGE, MEANAGE, STD
- Clinical: CDR scores, PATHOLOGY, RACE, ETHNICITY
- Technical: SITES, PLATFORM, DATA type, DESIGN
- Modalities: ANAT, RS_FMRI, T_FMRI, DWI, EEG, PET, etc.
- Research: Publication links, article titles/descriptions

## Dataset Download Scripts

The repository includes neuroimaging dataset download commands:
- `download.sh` - Shell script with aria2c and AWS CLI commands
- `dataset.ipynb` - Jupyter notebook with detailed download instructions
- Supports major repositories: INDI, OpenNeuro, OASIS, HCP, IXI, and more

## Notes

- Built using the Clarity template (Creative Commons Attribution-ShareAlike 4.0)
- No server-side processing - purely client-side JavaScript
- Responsive design optimized for research community usage
- Visitor tracking via CounterAPI integration