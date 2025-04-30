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
        };
    },      
    mounted() {
        this.loadDatasets();
    },
    computed: {
        // filteredDatasets() {
        //     return this.datasets.filter(ds => {
        //         const matchesSearch = ds.name.toLowerCase().includes(this.searchQuery.toLowerCase());
        //         const matchesPathology =
        //             !this.selectedPathology ||
        //             ds.pathology.toLowerCase() === this.selectedPathology.toLowerCase();
        //         return matchesSearch && matchesPathology;
        //     });
        // }
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
                const response = await fetch('./docs/assets/NeuroDataHub2.tsv');
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
                if (columns.length < 13) {
                    console.warn('Skipping malformed row:', row);
                    return null;
                }
                const [
                    DATASET, PATHOLOGY, CDRGLOB, SUBJECTS, SCANS, MALES, FEMALES, GENDER_RATIO, 
                    MIN_AGE, MAX_AGE, MEAN_AGE, STD_AGE, MEDIAN_AGE, Q25_AGE, Q75_AGE, AGE_RANGE, NUMBER_OF_SITES, 
                    LINK, Publication, Description, Population, Design, Datatype
                ] = columns;
                
                return {
                    name: DATASET?.trim() || 'Unknown',
                    pathology: PATHOLOGY?.trim() || 'N/A',
                    cdrGlobal: CDRGLOB?.trim() || 'N/A',
                    subjects: SUBJECTS?.trim() || 'N/A',
                    scans: SCANS?.trim() || 'N/A',
                    males: MALES?.trim() || 'N/A',
                    females: FEMALES?.trim() || 'N/A',
                    genderRatio: GENDER_RATIO?.trim() || 'N/A',
                    minAge: parseFloat(MIN_AGE)?.toFixed(0) || 'N/A',
                    maxAge: parseFloat(MAX_AGE)?.toFixed(0) || 'N/A',
                    meanAge: parseFloat(MEAN_AGE)?.toFixed(2) || 'N/A',
                    stdDev: parseFloat(STD_AGE)?.toFixed(2) || 'N/A',
                    median: parseFloat(MEDIAN_AGE)?.toFixed(2) || 'N/A',
                    q25: parseFloat(Q25_AGE)?.toFixed(2) || 'N/A',
                    q75: parseFloat(Q75_AGE)?.toFixed(2) || 'N/A',
                    ageRange: AGE_RANGE?.trim() || 'N/A',
                    numberOfSites: NUMBER_OF_SITES?.trim() || 'N/A',
                    link: LINK?.trim() || 'N/A',
                    publication: Publication?.trim() || 'N/A',
                    description: Description?.trim() || 'N/A',
                    population: Population?.trim() || 'N/A',
                    design: Design?.trim() || 'N/A',
                    datatype: Datatype?.trim() || 'N/A',
                    hovered: false
                }
                
            }).filter(dataset => dataset !== null);
        },
        viewDetails(dataset) {
            this.selectedDataset = dataset;
            this.showModal = true;
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