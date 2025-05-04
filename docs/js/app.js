new Vue({
    el: '#app',
    data() {
        return {
          datasets: [],
          showModal: false,
          selectedDataset: null,
          searchQuery: '',
          selectedModality: '',
          selectedPathology: '', 
          ageRange: [0, 100],
          maxPossibleAge:100,
          minPossibleAge: 0,
          isGridView: true,
          hoveredPubIdx: null,
          windowWidth: window.innerWidth,
          isLoading: true, // Flag for loading state
          errorLoading: null, // Store loading errors
          niivueError: null,
          niivueLoading: false,
          niivueInstance: null,
          ageChartInstance: null,
          genderChartInstance: null,
          hoveredModality: null,
        };
    },      
    mounted() {
        this.loadDatasets();
    },
    computed: {
        filteredDatasets() {
            return this.datasets.filter(ds => {
                const matchesSearch = ds.name.toLowerCase().includes(this.searchQuery.toLowerCase());
                const matchesPathology =
                    !this.selectedPathology ||
                    ds.pathology.toLowerCase() === this.selectedPathology.toLowerCase();
                // Add age range filtering
                const minAge = parseInt(ds.minAge) || 0;
                const maxAge = parseInt(ds.maxAge) || 100;
                const matchesAge =
                    minAge <= this.ageRange[1] && maxAge >= this.ageRange[0];
                return matchesSearch && matchesPathology && matchesAge;
            });
        },
        hasCDRDistribution() {
        if (!this.selectedDataset) return false;
        const cdr0 = Number(this.selectedDataset.cdr0_0 || 0);
        const cdr05 = Number(this.selectedDataset.cdr0_5 || 0);
        const cdr1 = Number(this.selectedDataset.cdr1_0 || 0);
        const cdr2 = Number(this.selectedDataset.cdr2_0 || 0);
        const cdr3 = Number(this.selectedDataset.cdr3_0 || 0);
        return (cdr0 + cdr05 + cdr1 + cdr2 + cdr3) > 0;
        },
        publicationCards() {
        if (!this.selectedDataset) return [];
        return [
            {
                link: this.selectedDataset.researchArticle1Link,
                title: this.selectedDataset.researchArticle1Title,
                description: this.selectedDataset.researchArticle1Description,
                _hover: false
            },
            {
                link: this.selectedDataset.researchArticle2Link,
                title: this.selectedDataset.researchArticle2Title,
                description: this.selectedDataset.researchArticle2Description,
                _hover: false
            }
        ].filter(pub => pub.link && pub.link !== 'N/A' && pub.title && pub.title !== 'N/A');
    },
    },
    methods: {
        async loadDatasets() {
            try {
                const response = await fetch('./docs/assets/data_updated.tsv');
                const data = await response.text();
                this.datasets = this.parseCSV(data);
            } catch (error) {
                console.error('Error loading datasets:', error);
            } finally {
                this.isLoading = false;
            }
            
        },
        parseCSV(data) {
            this.isLoading = true;
            const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
            return rows.map(row => {
                const columns = row.split('\t');
                if (columns.length < 48) { // Updated total column count
                    console.warn('Skipping malformed row:', row);
                    return null;
                }

                const [
                    DATASET, ABBREVIATION, SITES, SUBJECT, SCANS, MALES, FEMALES, MINAGE, MAXAGE, MEANAGE, STD, MEDIAN, Q25, Q75, 
                    CDR0_0, CDR0_5, CDR1_0, CDR2_0, CDR3_0, RACE, ETHNICITY, PATHOLOGY, LINK, DESCRIPTION, POPULATION, DATA, DESIGN, 
                    PUBLICATION, RESEARCH_ARTICLE_1_LINK, RESEARCH_ARTICLE_1_TITLE, RESEARCH_ARTICLE_1_DESCRIPTION, 
                    RESEARCH_ARTICLE_2_LINK, RESEARCH_ARTICLE_2_TITLE, RESEARCH_ARTICLE_2_DESCRIPTION,
                    PLATFORM, TIP1, TIP2, ANAT, RS_FMRI, T_FMRI, DWI, EEG, PET,
                    COGNITIVE, BEHAVIOURAL, GENETICS, FLUID_BIOMARKERS, OTHERS, DRAWBACK
                ] = columns;

                return {
                    name: DATASET?.trim() || 'Unknown',
                    abbreviation: ABBREVIATION?.trim() || 'N/A',
                    sites: SITES?.trim() || 'N/A',
                    subjects: SUBJECT?.trim() || 'N/A',
                    scans: SCANS?.trim() || 'N/A',
                    males: MALES?.trim() || 'N/A',
                    females: FEMALES?.trim() || 'N/A',
                    minAge: parseFloat(MINAGE)?.toFixed(0) || 'N/A',
                    maxAge: parseFloat(MAXAGE)?.toFixed(0) || 'N/A',
                    meanAge: parseFloat(MEANAGE)?.toFixed(2) || 'N/A',
                    stdDev: parseFloat(STD)?.toFixed(2) || 'N/A',
                    median: parseFloat(MEDIAN)?.toFixed(2) || 'N/A',
                    q25: parseFloat(Q25)?.toFixed(2) || 'N/A',
                    q75: parseFloat(Q75)?.toFixed(2) || 'N/A',
                    cdr0_0: CDR0_0?.trim() || 'N/A',
                    cdr0_5: CDR0_5?.trim() || 'N/A',
                    cdr1_0: CDR1_0?.trim() || 'N/A',
                    cdr2_0: CDR2_0?.trim() || 'N/A',
                    cdr3_0: CDR3_0?.trim() || 'N/A',
                    race: RACE?.trim() || 'N/A',
                    ethnicity: ETHNICITY?.trim() || 'N/A',
                    pathology: PATHOLOGY?.trim() || 'N/A',
                    link: LINK?.trim() || 'N/A',
                    description: DESCRIPTION?.trim() || 'N/A',
                    population: POPULATION?.trim() || 'N/A',
                    data: DATA?.trim() || 'N/A',
                    design: DESIGN?.trim() || 'N/A',
                    publication: PUBLICATION?.trim() || 'N/A',
                    researchArticle1Link: RESEARCH_ARTICLE_1_LINK?.trim() || 'N/A',
                    researchArticle1Title: RESEARCH_ARTICLE_1_TITLE?.trim() || 'N/A',
                    researchArticle1Description: RESEARCH_ARTICLE_1_DESCRIPTION?.trim() || 'N/A',
                    researchArticle2Link: RESEARCH_ARTICLE_2_LINK?.trim() || 'N/A',
                    researchArticle2Title: RESEARCH_ARTICLE_2_TITLE?.trim() || 'N/A',
                    researchArticle2Description: RESEARCH_ARTICLE_2_DESCRIPTION?.trim() || 'N/A',
                    platform: PLATFORM?.trim() || 'N/A',
                    tip1: TIP1?.trim() || 'N/A',
                    tip2: TIP2?.trim() || 'N/A',
                    anat: ANAT === '1' ? 1 : 0,
                    rs_fmri: RS_FMRI === '1' ? 1 : 0,
                    t_fmri: T_FMRI === '1' ? 1 : 0,
                    dwi: DWI === '1' ? 1 : 0,
                    eeg: EEG === '1' ? 1 : 0,
                    pet: PET === '1' ? 1 : 0,
                    cognitive: COGNITIVE === '1' ? 1 : 0,
                    behavioural: BEHAVIOURAL === '1' ? 1 : 0,
                    genetics: GENETICS === '1' ? 1 : 0,
                    fluid_biomarkers: FLUID_BIOMARKERS === '1' ? 1 : 0,
                    others: OTHERS?.trim() || 'N/A',
                    drawback: DRAWBACK?.trim() || 'N/A',
                    hovered: false
                };
            }).filter(dataset => dataset !== null);
        },
        viewDetails(dataset) {
            this.selectedDataset = dataset;
            this.showModal = true;
            this.$nextTick(() => {
                this.initializeNiivue();
            });
        },
        closeModal() {
            this.showModal = false;
            this.selectedDataset = null;
        },
        toggleHover(dataset, isHovered) {
            dataset.hovered = isHovered;
        },
        getThumbnail(dataset) {
            // You can improve this by mapping dataset.name to real thumbnails
            return dataset.hovered
              ? 'docs/assets/images/sample2.png'
              : 'docs/assets/images/sample1.png';
        },
        updateAgeRangeMin(val) {
            val = parseInt(val);
            if (val <= this.ageRange[1]) {
            this.ageRange[0] = val;
            }
        },
        updateAgeRangeMax(val) {
            val = parseInt(val);
            if (val >= this.ageRange[0]) {
            this.ageRange[1] = val;
            }
        },
        toggleView() {
            this.isGridView = !this.isGridView;
        },
        handleResize() {
            this.windowWidth = window.innerWidth;
        },
        async viewDetails(dataset) {
        this.selectedDataset = dataset;
        this.showModal = true;
        this.$nextTick(async () => {
            await this.plotAgeChart(dataset.name);
            await this.plotGenderChart(dataset.name);
        });
        },
        async plotAgeChart(datasetName) {
            // Remove previous chart if exists
            if (this.ageChartInstance) {
                this.ageChartInstance.destroy();
                this.ageChartInstance = null;
            }
            const csvPath = `docs/assets/Encrypt/${datasetName}.csv`;
            try {
                const resp = await fetch(csvPath);
                if (!resp.ok) {
                    console.warn("No metadata CSV found for", datasetName);
                    return;
                }
                const text = await resp.text();
                // Parse CSV
                const rows = text.split('\n').map(row => row.trim()).filter(row => row);
                const header = rows[0].split(',');
                const ageIdx = header.findIndex(h => h.trim().toLowerCase() === 'age');
                if (ageIdx === -1) {
                    console.warn("No 'Age' column in metadata for", datasetName);
                    return;
                }
                const ages = rows.slice(1)
                    .map(row => {
                        const cols = row.split(',');
                        const val = parseFloat(cols[ageIdx]);
                        return isNaN(val) ? null : val;
                    })
                    .filter(val => val !== null);

                // Bin ages in 5-year intervals
                if (ages.length === 0) return;
                const minAge = Math.floor(Math.min(...ages) / 5) * 5;
                const maxAge = Math.ceil(Math.max(...ages) / 5) * 5;
                const bins = [];
                const labels = [];
                for (let start = minAge; start < maxAge; start += 5) {
                    bins.push(0);
                    labels.push(`${start}-${start+4}`);
                }
                ages.forEach(age => {
                    const binIdx = Math.floor((age - minAge) / 5);
                    if (binIdx >= 0 && binIdx < bins.length) bins[binIdx]++;
                });

                // Draw chart
                const ctx = document.getElementById('ageChart').getContext('2d');
                this.ageChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Number of Subjects',
                            data: bins,
                            backgroundColor: '#6366f1',
                        }]
                    },
                    options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: false },
                        tooltip: {
                        backgroundColor: '#6366f1',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#818cf8',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        }
                    },
                    scales: {
                        x: {
                        title: { display: true, text: 'Age (years)', color: '#3730a3', font: { weight: 'bold', size: 15 } },
                        ticks: { color: '#334155', font: { size: 13 } },
                        grid: { color: '#e0e7ef' }
                        },
                        y: {
                        title: { display: true, text: 'Count', color: '#3730a3', font: { weight: 'bold', size: 15 } },
                        ticks: { color: '#334155', font: { size: 13 } },
                        grid: { color: '#e0e7ef' },
                        beginAtZero: true
                        }
                    }
                    }
                });
            } catch (err) {
                console.warn("Error loading or plotting age chart:", err);
            }
        },
        async plotGenderChart(datasetName) {
            // Remove previous chart if exists
            if (this.genderChartInstance) {
                this.genderChartInstance.destroy();
                this.genderChartInstance = null;
            }
            const csvPath = `docs/assets/Encrypt/${datasetName}.csv`;
            try {
                const resp = await fetch(csvPath);
                if (!resp.ok) {
                    console.warn("No metadata CSV found for", datasetName);
                    return;
                }
                const text = await resp.text();
                const rows = text.split('\n').map(row => row.trim()).filter(row => row);
                const header = rows[0].split(',');
                const subjectIdx = header.findIndex(h => h.trim().toLowerCase() === 'subjectid');
                const genderIdx = header.findIndex(h => h.trim().toLowerCase() === 'gender');
                if (subjectIdx === -1 || genderIdx === -1) {
                    console.warn("No 'SubjectID' or 'Gender' column in metadata for", datasetName);
                    return;
                }

                const seenSubjects = new Set();
                const genders = [];

                rows.slice(1).forEach(row => {
                    const cols = row.split(',');
                    const subject = cols[subjectIdx]?.trim();
                    const genderRaw = cols[genderIdx]?.trim().toLowerCase();
                    if (!subject || seenSubjects.has(subject)) return;
                    seenSubjects.add(subject);
                    if (genderRaw === 'm' || genderRaw === 'male') genders.push('male');
                    else if (genderRaw === 'f' || genderRaw === 'female') genders.push('female');
                });

                const maleCount = genders.filter(g => g === 'male').length;
                const femaleCount = genders.filter(g => g === 'female').length;

                const ctx = document.getElementById('genderChart').getContext('2d');
                this.genderChartInstance = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: ['Male', 'Female'],
                        datasets: [{
                            data: [maleCount, femaleCount],
                            backgroundColor: ['#60a5fa', '#f472b6'],
                            borderColor: '#fff',
                            borderWidth: 2,
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    color: '#334155',
                                    font: { size: 15 }
                                }
                            },
                            title: { display: false }
                        }
                    }
                });
            } catch (err) {
                console.warn("Error loading or plotting gender chart:", err);
            }
        },
    },
    mounted() {
        this.loadDatasets();
        this.handleResize();

        if (this.$refs.ageSlider && typeof noUiSlider !== "undefined") {
            noUiSlider.create(this.$refs.ageSlider, {
            start: this.ageRange,
            connect: true,
            step: 1,
            range: {
                min: this.minPossibleAge,
                max: this.maxPossibleAge,
            },
            tooltips: true,
            orientation: 'horizontal',
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
            });

            // Center the slider using flexbox
            this.$refs.ageSlider.style.display = 'flex';
            this.$refs.ageSlider.style.justifyContent = 'center';
            this.$refs.ageSlider.style.alignItems = 'center';
            this.$refs.ageSlider.style.margin = '0 auto';

            // Change the color of the slider fill (connect bar)
            this.$nextTick(() => {
            const connect = this.$refs.ageSlider.querySelector('.noUi-connect');
            if (connect) {
                connect.style.background = '#4caf50'; // Change to your desired color (e.g., Tailwind blue-500)
            }
            // Move tooltips below the slider
            const tooltips = this.$refs.ageSlider.querySelectorAll('.noUi-tooltip');
            tooltips.forEach(tooltip => {
                tooltip.style.top = '32px'; // move below the slider
                tooltip.style.bottom = 'auto';
            });
            });

            // Show tooltip for 3 seconds on update, then hide
            this.$refs.ageSlider.noUiSlider.on('update', (values, handle) => {
            this.ageRange = [parseInt(values[0]), parseInt(values[1])];
            const tooltips = this.$refs.ageSlider.querySelectorAll('.noUi-tooltip');
            tooltips.forEach(tooltip => {
                tooltip.style.opacity = '1';
            });
            clearTimeout(this._tooltipTimeout);
            this._tooltipTimeout = setTimeout(() => {
                tooltips.forEach(tooltip => {
                tooltip.style.opacity = '0';
                });
            }, 3000);
            });

            // Initially hide tooltips after 3 seconds
            setTimeout(() => {
            const tooltips = this.$refs.ageSlider.querySelectorAll('.noUi-tooltip');
            tooltips.forEach(tooltip => {
                tooltip.style.opacity = '0';
            });
            }, 3000);
        } else {
            console.warn("noUiSlider not loaded or missing ref.");
        }
    },
});