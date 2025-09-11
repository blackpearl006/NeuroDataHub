/**
 * NeuroDataHub Vue.js Application
 * 
 * Main application for exploring and visualizing neuroimaging datasets.
 * Provides interactive filtering, dataset details, and data visualizations.
 */

// Application Constants
const APP_CONFIG = {
    DATA_FILE_PATH: './docs/assets/data_updated.tsv',
    METADATA_PATH: 'docs/assets/Encrypt/',
    DEFAULT_IMAGE: 'docs/assets/images/indi.png',
    AGE_RANGE: {
        MIN: 0,
        MAX: 105,
        DEFAULT: [0, 105]
    },
    CHART_COLORS: {
        PRIMARY: '#6366f1',
        MALE: '#60a5fa',
        FEMALE: '#f472b6',
        BACKGROUND: '#e0e7ef'
    }
};

// Utility Functions
const Utils = {
    /**
     * Safely parse a float value with fallback
     */
    parseFloat(value, fallback = 'N/A', decimals = 2) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed.toFixed(decimals);
    },

    /**
     * Safely parse an integer value with fallback
     */
    parseInt(value, fallback = 'N/A') {
        const parsed = parseInt(value);
        return isNaN(parsed) ? fallback : parsed.toString();
    },

    /**
     * Clean and trim string values
     */
    cleanString(value, fallback = 'N/A') {
        return value?.trim() || fallback;
    },

    /**
     * Convert binary string to boolean number
     */
    binaryToNumber(value) {
        return value === '1' ? 1 : 0;
    },

    /**
     * Validate if a URL/link is usable
     */
    isValidLink(link) {
        return link && link !== 'N/A' && link.trim() !== '';
    }
};

// Main Vue Application
new Vue({
    el: '#app',
    
    data() {
        return {
            // Dataset Management
            datasets: [],
            isLoading: true,
            errorLoading: null,

            // Modal and Selection
            showModal: false,
            selectedDataset: null,
            hoveredPubIdx: null,
            hoveredModality: null,

            // Filtering Options
            searchQuery: '',
            selectedPathology: '',
            ageRange: [...APP_CONFIG.AGE_RANGE.DEFAULT],

            // UI State
            isGridView: true,
            windowWidth: window.innerWidth,

            // Sidebar and Navigation
            sidebarOpen: false,
            currentPage: 'home',
            sidebarClosing: false,

            // Dataset Helper Page
            datasetRecommendations: [],
            helperSearchQuery: '',

            // Dataset Submission Form (Legacy - now using Google Forms)
            // submissionForm: {
            //     pathology: '',
            //     datasetName: '',
            //     datasetLink: '',
            //     reason1: '',
            //     reason2: '',
            //     reason3: '',
            //     caution: '',
            //     aboutCondition: ''
            // },

            // Chart Instances
            ageChartInstance: null,
            genderChartInstance: null,

            // Configuration
            maxPossibleAge: APP_CONFIG.AGE_RANGE.MAX,
            minPossibleAge: APP_CONFIG.AGE_RANGE.MIN
        };
    },

    computed: {
        /**
         * Filter datasets based on search, pathology, and age range
         */
        filteredDatasets() {
            if (!this.datasets.length) return [];

            const filtered = this.datasets.filter(dataset => {
                // Search filter
                const matchesSearch = !this.searchQuery || 
                    dataset.name.toLowerCase().includes(this.searchQuery.toLowerCase());

                // Pathology filter
                const matchesPathology = !this.selectedPathology || 
                    dataset.pathology.toLowerCase() === this.selectedPathology.toLowerCase();

                // Age range filter
                const minAge = parseFloat(dataset.minAge) || 0;
                const maxAge = parseFloat(dataset.maxAge) || 105;
                const matchesAge = minAge <= this.ageRange[1] && maxAge >= this.ageRange[0];

                return matchesSearch && matchesPathology && matchesAge;
            });
            
            console.log(`Filtered ${filtered.length} datasets from ${this.datasets.length} total`);
            return filtered;
        },

        /**
         * Check if selected dataset has CDR distribution data
         */
        hasCDRDistribution() {
            if (!this.selectedDataset) return false;
            
            const cdrValues = [
                this.selectedDataset.cdr0_0,
                this.selectedDataset.cdr0_5,
                this.selectedDataset.cdr1_0,
                this.selectedDataset.cdr2_0,
                this.selectedDataset.cdr3_0
            ];

            return cdrValues.some(value => Number(value || 0) > 0);
        },

        /**
         * Generate publication cards for selected dataset
         */
        publicationCards() {
            if (!this.selectedDataset) return [];
            
            const articles = [
                {
                    link: this.selectedDataset.researchArticle1Link,
                    title: this.selectedDataset.researchArticle1Title,
                    description: this.selectedDataset.researchArticle1Description
                },
                {
                    link: this.selectedDataset.researchArticle2Link,
                    title: this.selectedDataset.researchArticle2Title,
                    description: this.selectedDataset.researchArticle2Description
                }
            ];

            return articles.filter(article => 
                Utils.isValidLink(article.link) && Utils.isValidLink(article.title)
            );
        },

        /**
         * Filter dataset recommendations based on search query
         */
        filteredRecommendations() {
            if (!this.datasetRecommendations.length) return [];
            
            if (!this.helperSearchQuery) return this.datasetRecommendations;
            
            const query = this.helperSearchQuery.toLowerCase();
            return this.datasetRecommendations.filter(rec => 
                rec.pathology.toLowerCase().includes(query) ||
                rec.dataset.toLowerCase().includes(query) ||
                rec.reason1.toLowerCase().includes(query) ||
                rec.reason2.toLowerCase().includes(query) ||
                rec.reason3.toLowerCase().includes(query) ||
                rec.caution.toLowerCase().includes(query)
            );
        }
    },

    methods: {
        /**
         * Load dataset data from TSV file
         */
        async loadDatasets() {
            try {
                this.isLoading = true;
                this.errorLoading = null;

                const response = await fetch(APP_CONFIG.DATA_FILE_PATH);
                
                if (!response.ok) {
                    throw new Error(`Failed to load datasets: ${response.status} ${response.statusText}`);
                }

                const data = await response.text();
                this.datasets = this.parseDatasetTSV(data);
                
                console.log(`Successfully loaded ${this.datasets.length} datasets`);
                
                // Check for OASIS and YALE datasets
                const oasisCount = this.datasets.filter(d => d.name.includes('OASIS')).length;
                const yaleCount = this.datasets.filter(d => d.name.includes('YALE')).length;
                console.log(`Found ${oasisCount} OASIS and ${yaleCount} YALE datasets`);
                
            } catch (error) {
                console.error('Error loading datasets:', error);
                this.errorLoading = `Failed to load datasets: ${error.message}`;
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Parse TSV data into dataset objects
         */
        parseDatasetTSV(data) {
            const rows = data.split('\n')
                .slice(1) // Skip header
                .map(row => row.trim())
                .filter(row => row.length > 0);

            console.log(`Found ${rows.length} total rows to parse`);
            
            // Log all dataset names from raw data
            const allDatasetNames = rows.map(row => row.split('\t')[0]).filter(name => name);
            console.log('All dataset names found:', allDatasetNames);
            
            const parsedDatasets = rows.map((row, index) => {
                const dataset = this.parseDatasetRow(row);
                if (!dataset) {
                    const datasetName = row.split('\t')[0] || `Row ${index + 1}`;
                    console.error(`Failed to parse dataset: ${datasetName} (${row.split('\t').length} columns)`);
                }
                return dataset;
            }).filter(dataset => dataset !== null);
            
            console.log(`Successfully parsed ${parsedDatasets.length} out of ${rows.length} rows`);
            return parsedDatasets;
        },

        /**
         * Parse individual dataset row
         */
        parseDatasetRow(row) {
            const columns = row.split('\t');
            
            if (columns.length < 47) {
                console.warn('Skipping malformed row - insufficient columns:', columns.length, 'expected at least 47');
                return null;
            }

            try {
                // Map columns according to actual TSV structure (51 columns)
                const [
                    DATASET, ABBREVIATION, SITES, SUBJECT, SCANS, MALES, FEMALES, 
                    MINAGE, MAXAGE, MEANAGE, STD, MEDIAN, Q25, Q75,
                    CDR0_0, CDR0_5, CDR1_0, CDR2_0, CDR3_0, RACE, ETHNICITY, 
                    PATHOLOGY, LINK, DESCRIPTION, POPULATION, DATA, DESIGN,
                    PUBLICATION, RESEARCH_ARTICLE_1_LINK, RESEARCH_ARTICLE_1_TITLE, 
                    RESEARCH_ARTICLE_1_DESCRIPTION, RESEARCH_ARTICLE_2_LINK, 
                    RESEARCH_ARTICLE_2_TITLE, RESEARCH_ARTICLE_2_DESCRIPTION,
                    PLATFORM, TIP1, TIP2, ANAT, RS_FMRI, T_FMRI, DWI, EEG, PET,
                    COGNITIVE, BEHAVIOURAL, GENETICS, FLUID_BIOMARKERS, OTHERS, 
                    DRAWBACK, GOAL, LAUNCHYEAR
                ] = columns;
                
                // Debug specific datasets
                if (DATASET && (DATASET.includes('OASIS') || DATASET.includes('YALE'))) {
                    console.log(`Successfully parsing: ${DATASET} with ${columns.length} columns`);
                }

                return {
                    // Basic Information
                    name: Utils.cleanString(DATASET, 'Unknown'),
                    abbreviation: Utils.cleanString(ABBREVIATION),
                    description: Utils.cleanString(DESCRIPTION),
                    goal: Utils.cleanString(GOAL),
                    
                    // Study Design
                    sites: Utils.cleanString(SITES),
                    subjects: Utils.cleanString(SUBJECT),
                    scans: Utils.cleanString(SCANS),
                    design: Utils.cleanString(DESIGN),
                    platform: Utils.cleanString(PLATFORM),
                    launchyear: Utils.cleanString(LAUNCHYEAR),
                    
                    // Demographics
                    males: Utils.cleanString(MALES),
                    females: Utils.cleanString(FEMALES),
                    population: Utils.cleanString(POPULATION),
                    race: Utils.cleanString(RACE),
                    ethnicity: Utils.cleanString(ETHNICITY),
                    
                    // Age Statistics
                    minAge: Utils.parseInt(MINAGE),
                    maxAge: Utils.parseInt(MAXAGE),
                    meanAge: Utils.parseFloat(MEANAGE),
                    stdDev: Utils.parseFloat(STD),
                    median: Utils.parseFloat(MEDIAN),
                    q25: Utils.parseFloat(Q25),
                    q75: Utils.parseFloat(Q75),
                    
                    // Clinical Data
                    pathology: Utils.cleanString(PATHOLOGY),
                    cdr0_0: Utils.cleanString(CDR0_0),
                    cdr0_5: Utils.cleanString(CDR0_5),
                    cdr1_0: Utils.cleanString(CDR1_0),
                    cdr2_0: Utils.cleanString(CDR2_0),
                    cdr3_0: Utils.cleanString(CDR3_0),
                    
                    // Data Information
                    data: Utils.cleanString(DATA),
                    link: Utils.cleanString(LINK),
                    publication: Utils.cleanString(PUBLICATION),
                    
                    // Research Articles
                    researchArticle1Link: Utils.cleanString(RESEARCH_ARTICLE_1_LINK),
                    researchArticle1Title: Utils.cleanString(RESEARCH_ARTICLE_1_TITLE),
                    researchArticle1Description: Utils.cleanString(RESEARCH_ARTICLE_1_DESCRIPTION),
                    researchArticle2Link: Utils.cleanString(RESEARCH_ARTICLE_2_LINK),
                    researchArticle2Title: Utils.cleanString(RESEARCH_ARTICLE_2_TITLE),
                    researchArticle2Description: Utils.cleanString(RESEARCH_ARTICLE_2_DESCRIPTION),
                    
                    // Tips and Additional Info
                    tip1: Utils.cleanString(TIP1),
                    tip2: Utils.cleanString(TIP2),
                    drawback: Utils.cleanString(DRAWBACK),
                    others: Utils.cleanString(OTHERS),
                    
                    // Modalities (Binary flags)
                    anat: Utils.binaryToNumber(ANAT),
                    rs_fmri: Utils.binaryToNumber(RS_FMRI),
                    t_fmri: Utils.binaryToNumber(T_FMRI),
                    dwi: Utils.binaryToNumber(DWI),
                    eeg: Utils.binaryToNumber(EEG),
                    pet: Utils.binaryToNumber(PET),
                    cognitive: Utils.binaryToNumber(COGNITIVE),
                    behavioural: Utils.binaryToNumber(BEHAVIOURAL),
                    genetics: Utils.binaryToNumber(GENETICS),
                    fluid_biomarkers: Utils.binaryToNumber(FLUID_BIOMARKERS),
                    
                    // UI State
                    hovered: false
                };
            } catch (error) {
                const datasetName = columns[0] || 'Unknown';
                console.error(`Error parsing dataset "${datasetName}":`, error);
                console.error('Full row:', row);
                console.error('Columns length:', columns.length);
                console.error('First few columns:', columns.slice(0, 5));
                return null;
            }
        },

        /**
         * Open dataset details modal
         */
        async viewDetails(dataset) {
            this.selectedDataset = dataset;
            this.showModal = true;

            // Wait for DOM update, then plot charts
            await this.$nextTick();
            await Promise.all([
                this.plotAgeChart(dataset.name),
                this.plotGenderChart(dataset.name)
            ]);
        },

        /**
         * Close dataset details modal
         */
        closeModal() {
            this.showModal = false;
            this.selectedDataset = null;
            this.destroyCharts();
        },

        /**
         * Destroy chart instances to prevent memory leaks
         */
        destroyCharts() {
            if (this.ageChartInstance) {
                this.ageChartInstance.destroy();
                this.ageChartInstance = null;
            }
            if (this.genderChartInstance) {
                this.genderChartInstance.destroy();
                this.genderChartInstance = null;
            }
        },

        /**
         * Plot age distribution chart for dataset
         */
        async plotAgeChart(datasetName) {
            try {
                // Destroy existing chart
                if (this.ageChartInstance) {
                    this.ageChartInstance.destroy();
                    this.ageChartInstance = null;
                }

                const csvPath = `${APP_CONFIG.METADATA_PATH}${datasetName}.csv`;
                const response = await fetch(csvPath);
                
                if (!response.ok) {
                    console.warn(`No metadata CSV found for ${datasetName}`);
                    return;
                }

                const csvData = await response.text();
                const ages = this.extractAgesFromCSV(csvData);
                
                if (ages.length === 0) {
                    console.warn(`No valid age data found for ${datasetName}`);
                    return;
                }

                const chartData = this.createAgeHistogram(ages);
                this.renderAgeChart(chartData);
                
            } catch (error) {
                console.warn(`Error plotting age chart for ${datasetName}:`, error);
            }
        },

        /**
         * Extract age values from CSV data
         */
        extractAgesFromCSV(csvData) {
            const rows = csvData.split('\n')
                .map(row => row.trim())
                .filter(row => row.length > 0);
            
            if (rows.length === 0) return [];

            const header = rows[0].split(',');
            const ageIndex = header.findIndex(col => 
                col.trim().toLowerCase() === 'age'
            );

            if (ageIndex === -1) {
                console.warn('No "Age" column found in CSV');
                return [];
            }

            return rows.slice(1)
                .map(row => {
                    const columns = row.split(',');
                    const ageValue = parseFloat(columns[ageIndex]);
                    return isNaN(ageValue) ? null : ageValue;
                })
                .filter(age => age !== null);
        },

        /**
         * Create histogram data from age values
         */
        createAgeHistogram(ages) {
            const minAge = Math.floor(Math.min(...ages) / 5) * 5;
            const maxAge = Math.ceil(Math.max(...ages) / 5) * 5;
            
            const bins = [];
            const labels = [];
            
            for (let start = minAge; start < maxAge; start += 5) {
                bins.push(0);
                labels.push(`${start}-${start + 4}`);
            }

            ages.forEach(age => {
                const binIndex = Math.floor((age - minAge) / 5);
                if (binIndex >= 0 && binIndex < bins.length) {
                    bins[binIndex]++;
                }
            });

            return { labels, data: bins };
        },

        /**
         * Render age distribution chart
         */
        renderAgeChart({ labels, data }) {
            const canvas = document.getElementById('ageChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            
            this.ageChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Number of Subjects',
                        data,
                        backgroundColor: APP_CONFIG.CHART_COLORS.PRIMARY,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: false },
                        tooltip: {
                            backgroundColor: APP_CONFIG.CHART_COLORS.PRIMARY,
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#818cf8',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            title: { 
                                display: true, 
                                text: 'Age (years)', 
                                color: '#3730a3', 
                                font: { weight: 'bold', size: 15 } 
                            },
                            ticks: { color: '#334155', font: { size: 13 } },
                            grid: { color: APP_CONFIG.CHART_COLORS.BACKGROUND }
                        },
                        y: {
                            title: { 
                                display: true, 
                                text: 'Count', 
                                color: '#3730a3', 
                                font: { weight: 'bold', size: 15 } 
                            },
                            ticks: { color: '#334155', font: { size: 13 } },
                            grid: { color: APP_CONFIG.CHART_COLORS.BACKGROUND },
                            beginAtZero: true
                        }
                    }
                }
            });
        },

        /**
         * Plot gender distribution chart for dataset
         */
        async plotGenderChart(datasetName) {
            try {
                // Destroy existing chart
                if (this.genderChartInstance) {
                    this.genderChartInstance.destroy();
                    this.genderChartInstance = null;
                }

                const csvPath = `${APP_CONFIG.METADATA_PATH}${datasetName}.csv`;
                const response = await fetch(csvPath);
                
                if (!response.ok) {
                    console.warn(`No metadata CSV found for ${datasetName}`);
                    return;
                }

                const csvData = await response.text();
                const genderCounts = this.extractGenderFromCSV(csvData);
                
                if (genderCounts.male === 0 && genderCounts.female === 0) {
                    console.warn(`No valid gender data found for ${datasetName}`);
                    return;
                }

                this.renderGenderChart(genderCounts);
                
            } catch (error) {
                console.warn(`Error plotting gender chart for ${datasetName}:`, error);
            }
        },

        /**
         * Extract gender distribution from CSV data
         */
        extractGenderFromCSV(csvData) {
            const rows = csvData.split('\n')
                .map(row => row.trim())
                .filter(row => row.length > 0);
            
            if (rows.length === 0) return { male: 0, female: 0 };

            const header = rows[0].split(',');
            const subjectIndex = header.findIndex(col => 
                col.trim().toLowerCase() === 'subjectid'
            );
            const genderIndex = header.findIndex(col => 
                col.trim().toLowerCase() === 'gender'
            );

            if (subjectIndex === -1 || genderIndex === -1) {
                console.warn('Missing SubjectID or Gender columns in CSV');
                return { male: 0, female: 0 };
            }

            const seenSubjects = new Set();
            const genders = { male: 0, female: 0 };

            rows.slice(1).forEach(row => {
                const columns = row.split(',');
                const subjectId = columns[subjectIndex]?.trim();
                const genderValue = columns[genderIndex]?.trim().toLowerCase();

                if (!subjectId || seenSubjects.has(subjectId)) return;
                
                seenSubjects.add(subjectId);

                if (genderValue === 'm' || genderValue === 'male') {
                    genders.male++;
                } else if (genderValue === 'f' || genderValue === 'female') {
                    genders.female++;
                }
            });

            return genders;
        },

        /**
         * Render gender distribution pie chart
         */
        renderGenderChart({ male, female }) {
            const canvas = document.getElementById('genderChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            
            this.genderChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Male', 'Female'],
                    datasets: [{
                        data: [male, female],
                        backgroundColor: [
                            APP_CONFIG.CHART_COLORS.MALE, 
                            APP_CONFIG.CHART_COLORS.FEMALE
                        ],
                        borderColor: '#fff',
                        borderWidth: 2
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
                        title: { display: false },
                        tooltip: {
                            backgroundColor: '#374151',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 12,
                            cornerRadius: 8
                        }
                    }
                }
            });
        },

        /**
         * Toggle dataset hover state
         */
        toggleHover(dataset, isHovered) {
            if (dataset) {
                dataset.hovered = isHovered;
            }
        },

        /**
         * Toggle between grid and table view
         */
        toggleView() {
            this.isGridView = !this.isGridView;
        },

        /**
         * Reset all filters to default values
         */
        resetFilters() {
            this.searchQuery = '';
            this.selectedPathology = '';
            this.ageRange = [...APP_CONFIG.AGE_RANGE.DEFAULT];
            
            // Reset the slider if it exists
            if (this.$refs.ageSlider && this.$refs.ageSlider.noUiSlider) {
                this.$refs.ageSlider.noUiSlider.set(this.ageRange);
            }
        },

        /**
         * Handle window resize events
         */
        handleResize() {
            this.windowWidth = window.innerWidth;
        },

        /**
         * Initialize age range slider
         */
        initializeAgeSlider() {
            if (!this.$refs.ageSlider || typeof noUiSlider === 'undefined') {
                console.warn('Age slider initialization failed: element or library not found');
                return;
            }

            try {
                // Create slider
                noUiSlider.create(this.$refs.ageSlider, {
                    start: this.ageRange,
                    connect: true,
                    step: 1,
                    range: {
                        min: this.minPossibleAge,
                        max: this.maxPossibleAge
                    },
                    tooltips: true,
                    orientation: 'horizontal',
                    format: {
                        to: value => Math.round(value),
                        from: value => Number(value)
                    }
                });

                // Add modern slider class for styling
                this.$refs.ageSlider.classList.add('modern-slider');

                // Listen for changes
                this.$refs.ageSlider.noUiSlider.on('update', (values) => {
                    this.ageRange = values.map(v => parseInt(v));
                });

            } catch (error) {
                console.error('Error initializing age slider:', error);
            }
        },

        /**
         * Sidebar and Navigation Methods
         */
        
        /**
         * Toggle sidebar open/close
         */
        toggleSidebar() {
            this.sidebarOpen = !this.sidebarOpen;
        },

        /**
         * Close sidebar with fade animation
         */
        closeSidebar() {
            this.sidebarClosing = true;
            
            // Add small delay to show fade effect before closing
            setTimeout(() => {
                this.sidebarOpen = false;
                this.sidebarClosing = false;
            }, 150);
        },

        /**
         * Set current page and close sidebar with fade effect
         */
        setCurrentPage(page) {
            if (page === this.currentPage) {
                // If clicking same page, just close sidebar
                this.closeSidebar();
                return;
            }

            // Always close sidebar with fade effect when navigating
            this.sidebarClosing = true;
            
            setTimeout(() => {
                this.currentPage = page;
                this.sidebarOpen = false;
                this.sidebarClosing = false;
            }, 200);
        },

        /**
         * Load dataset recommendations from CSV
         */
        async loadDatasetRecommendations() {
            try {
                const response = await fetch('./docs/assets/goto2.csv');
                if (!response.ok) {
                    throw new Error(`Failed to load recommendations: ${response.status}`);
                }

                const csvData = await response.text();
                this.datasetRecommendations = this.parseRecommendationsCSV(csvData);
                
                console.log(`Loaded ${this.datasetRecommendations.length} dataset recommendations`);
                
            } catch (error) {
                console.error('Error loading dataset recommendations:', error);
            }
        },

        /**
         * Parse recommendations CSV data
         */
        parseRecommendationsCSV(csvData) {
            const lines = csvData.split('\n').filter(line => line.trim());
            if (lines.length <= 1) return [];

            // Skip header row
            const dataLines = lines.slice(1);
            
            return dataLines.map(line => {
                // Handle CSV parsing with quoted fields
                const fields = this.parseCSVLine(line);
                
                if (fields.length >= 8) {
                    return {
                        pathology: fields[0] || 'N/A',
                        dataset: fields[1] || 'N/A',
                        link: fields[2] || '',
                        reason1: fields[3] || 'N/A',
                        reason2: fields[4] || 'N/A',
                        reason3: fields[5] || 'N/A',
                        caution: fields[6] || 'N/A',
                        about: fields[7] || 'N/A'
                    };
                }
                return null;
            }).filter(item => item !== null);
        },

        /**
         * Parse a single CSV line with quoted fields
         */
        parseCSVLine(line) {
            const fields = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"' && !inQuotes) {
                    inQuotes = true;
                } else if (char === '"' && inQuotes) {
                    if (nextChar === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = false;
                    }
                } else if (char === ',' && !inQuotes) {
                    fields.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            fields.push(current.trim());
            return fields;
        },


        /**
         * Dataset Submission Methods - Now handled by Google Forms
         */
    },

    mounted() {
        // Load initial data
        this.loadDatasets();
        this.loadDatasetRecommendations();
        
        // Setup window resize handler
        this.handleResize();
        window.addEventListener('resize', this.handleResize);
        
        // Initialize age slider
        this.$nextTick(() => {
            this.initializeAgeSlider();
        });
        
        // Close sidebar on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.sidebarOpen) {
                this.closeSidebar();
            }
        });
    },

    beforeDestroy() {
        // Cleanup
        window.removeEventListener('resize', this.handleResize);
        this.destroyCharts();
    }
});