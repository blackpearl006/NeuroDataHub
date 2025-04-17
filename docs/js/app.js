new Vue({
    el: '#app',
    data() {
        return {
          datasets: [],
          showModal: false,
          selectedDataset: null,
          searchQuery: '',
          selectedModality: ''
        };
    },      
    mounted() {
        this.loadDatasets();
    },
    computed: {
        filteredDatasets() {
          return this.datasets.filter(ds => {
            const matchesSearch = ds.name.toLowerCase().includes(this.searchQuery.toLowerCase());
            const matchesModality = this.selectedModality === '' || ds.name.toLowerCase().includes(this.selectedModality.toLowerCase());
            return matchesSearch && matchesModality;
          });
        }
      },      
    methods: {
        async loadDatasets() {
            try {
                const response = await fetch('./docs/assets/NeuroDataHub.tsv');
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
                const [DATASET, GROUP, CDRGLOB, SUBJECT, SCANS, MALES, FEMALES, MINAGE, MAXAGE, MEANAGE, STD, Median, Q25, Q75, LINK, Publication, Description, Population, Datatype, Data] = columns;
                console.log({
                    DATASET, GROUP, CDRGLOB, SUBJECT, SCANS, MALES, FEMALES, MINAGE, MAXAGE, MEANAGE, STD, Median, Q25, Q75, LINK, Publication, Description, Population, Datatype, Data
                });
                return {
                    name: DATASET?.trim() || 'Unknown',
                    group: GROUP?.trim() || 'N/A',
                    cdrGlobal: CDRGLOB?.trim() || 'N/A',
                    subject: SUBJECT?.trim() || 'N/A',
                    scans: SCANS?.trim() || 'N/A',
                    males: MALES?.trim() || 'N/A',
                    females: FEMALES?.trim() || 'N/A',
                    minAge: parseFloat(MINAGE)?.toFixed(2) || 'N/A',
                    maxAge: parseFloat(MAXAGE)?.toFixed(2) || 'N/A',
                    meanAge: parseFloat(MEANAGE)?.toFixed(2) || 'N/A',
                    stdDev: parseFloat(STD)?.toFixed(2) || 'N/A',
                    median: parseFloat(Median)?.toFixed(2) || 'N/A',
                    q25: parseFloat(Q25)?.toFixed(2) || 'N/A',
                    q75: parseFloat(Q75)?.toFixed(2) || 'N/A',
                    link: LINK?.trim() || 'N/A',
                    publication: Publication?.trim() || 'N/A',
                    description: Description?.trim() || 'N/A',
                    population: Population?.trim() || 'N/A',
                    datatype: Datatype?.trim() || 'N/A',
                    data: Data?.trim() || 'N/A',
                    hovered: false
                };
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
          }
          
    }
});


