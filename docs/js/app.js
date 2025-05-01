// Make sure Niivue is available globally
// If using a CDN, add the following line at the top of your HTML file before this script:
// <script src="https://unpkg.com/niivue/dist/niivue.umd.js"></script>

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
          windowWidth: window.innerWidth,
          isLoading: true, // Flag for loading state
          errorLoading: null, // Store loading errors
          niivueError: null,
          niivueLoading: false,
          niivueInstance: null,
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
        }
    },
    methods: {
        async loadDatasets() {
            try {
                const response = await fetch('./docs/assets/data.tsv');
                const data = await response.text();
                this.datasets = this.parseCSV(data);
            } catch (error) {
                console.error('Error loading datasets:', error);
            }
        },
        parseCSV(data) {
            const rows = data.split('\n').slice(1).filter(row => row.trim() !== '');
            return rows.map(row => {
                const columns = row.split('\t');
                if (columns.length < 33) { // Updated column count
                    console.warn('Skipping malformed row:', row);
                    return null;
                }
                const [
                    DATASET, ABBREVIATION, SITES, SUBJECT, SCANS, MALES, FEMALES, MINAGE, MAXAGE, MEANAGE, STD, MEDIAN, Q25, Q75, 
                    CDR0_0, CDR0_5, CDR1_0, CDR2_0, CDR3_0, RACE, ETHNICITY, PATHOLOGY, LINK, DESCRIPTION, POPULATION, DATA, DESIGN, 
                    PUBLICATION, RESEARCH_ARTICLE_1_LINK, RESEARCH_ARTICLE_1_TITLE, RESEARCH_ARTICLE_1_DESCRIPTION, 
                    RESEARCH_ARTICLE_2_LINK, RESEARCH_ARTICLE_2_TITLE, RESEARCH_ARTICLE_2_DESCRIPTION
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
        this.ageRange = [Number(val), this.ageRange[1]];
        },
        updateAgeRangeMax(val) {
            this.ageRange = [this.ageRange[0], Number(val)];
        },
        toggleView() {
            this.isGridView = !this.isGridView;
        },
        handleResize() {
            this.windowWidth = window.innerWidth;
            // Optional: Resize Niivue if needed (often handles automatically)
            // if (this.niivueInstance && this.showModal) {
            //     this.niivueInstance.resizeCanvas();
            // }
        },
        // --- Niivue Methods --- 
        async initializeNiivue() {
            console.log("initializeNiivue called");
            if (!this.showModal) {
                console.warn("Modal is not open.");
                return;
            }
            if (!this.selectedDataset) {
                console.warn("No dataset selected.");
                return;
            }
            const canvas = document.getElementById('niivue-canvas');
            if (!canvas) {
                console.warn("Canvas element #niivue-canvas not found.");
                return;
            }

            // Clean up any previous instance
            this.destroyNiivue();

            this.niivueLoading = true;
            this.niivueError = null;

            // Dynamically set the NIfTI path based on the selected dataset
            // Example: assumes dataset.name matches the NIfTI filename
            const niftiPath = `docs/assets/nifti/${this.selectedDataset.name}.nii.gz`;
            console.log("Attempting to load NIfTI file:", niftiPath);

            // Optionally, check if the file exists (fetch HEAD request)
            try {
                const headResp = await fetch(niftiPath, { method: 'HEAD' });
                if (!headResp.ok) {
                    this.niivueError = `NIfTI file not found: ${niftiPath}`;
                    console.error(this.niivueError);
                    this.niivueLoading = false;
                    return;
                }
            } catch (fetchErr) {
                this.niivueError = `Error checking NIfTI file: ${fetchErr}`;
                console.error(this.niivueError);
                this.niivueLoading = false;
                return;
            }

            try {
                console.log("Initializing Niivue instance...");
                const nv = new Niivue({
                    show3Dcrosshair: true,
                    backColor: [0.1, 0.1, 0.1, 1],
                });
                this.niivueInstance = nv;

                await nv.attachTo('niivue-canvas');
                console.log("Niivue attached to canvas.");

                const volumeList = [
                    { url: niftiPath }
                ];
                await nv.loadVolumes(volumeList);
                console.log("Niivue volume loaded successfully.");

            } catch (error) {
                this.niivueError = `Failed to load image: ${error.message || error}`;
                console.error("Niivue Error:", error);
                this.destroyNiivue();
            } finally {
                this.niivueLoading = false;
            }
        },
        destroyNiivue() {
            if (this.niivueInstance) {
                try {
                    console.log("Detaching Niivue instance.");
                    this.niivueInstance.detach(); // Release resources
                 } catch (error) {
                    console.error("Error detaching Niivue:", error);
                 } finally {
                    this.niivueInstance = null; // Clear the stored instance
                 }
            }
             // Reset state flags
            this.niivueLoading = false;
            this.niivueError = null;
        },
    },
    mounted() {
        if (typeof Niivue !== "undefined") {
            console.log("Niivue CDN loaded successfully:", Niivue);
        } else {
            console.error("Niivue CDN NOT loaded! Check your <script> tag in index.html.");
        }
        this.loadDatasets();
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    },
    beforeDestroy() {
         // Clean up listener when the Vue instance is destroyed
        window.removeEventListener('resize', this.handleResize);
        // Ensure Niivue is cleaned up if the component is destroyed unexpectedly
        this.destroyNiivue();
    }
});

window.addEventListener('resize', () => {
    const app = new Vue({
        el: '#app',
        data: {
            windowWidth: window.innerWidth
        }
    });
});