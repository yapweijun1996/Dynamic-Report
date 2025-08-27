document.addEventListener('DOMContentLoaded', () => {
    const dbName = 'DynamicReportDB';
    let db;

    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        const objectStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('date', 'date', { unique: false });
        objectStore.createIndex('region', 'region', { unique: false });
        objectStore.createIndex('salesperson', 'salesperson', { unique: false });
        objectStore.createIndex('amount', 'amount', { unique: false });
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        populateInitialData();
        setupDragAndDrop();
        setupEventListeners();
    };

    function populateInitialData() {
        const transaction = db.transaction(['sales'], 'readwrite');
        const objectStore = transaction.objectStore('sales');
        const countRequest = objectStore.count();

        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                const salesData = [
                    { date: '2023-01-05', region: 'North', salesperson: 'Alice', amount: 1500 },
                    { date: '2023-01-08', region: 'South', salesperson: 'Bob', amount: 2500 },
                    { date: '2023-01-12', region: 'North', salesperson: 'Alice', amount: 1200 },
                    { date: '2023-01-15', region: 'East', salesperson: 'Charlie', amount: 3200 },
                    { date: '2023-02-02', region: 'West', salesperson: 'David', amount: 2200 },
                    { date: '2023-02-05', region: 'South', salesperson: 'Bob', amount: 1800 },
                ];
                salesData.forEach(item => objectStore.add(item));
            }
            populateRegionFilter();
        };
    }

    function populateRegionFilter() {
        const transaction = db.transaction(['sales'], 'readonly');
        const objectStore = transaction.objectStore('sales');
        const regionIndex = objectStore.index('region');
        const regions = new Set();
        
        regionIndex.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                regions.add(cursor.value.region);
                cursor.continue();
            } else {
                const regionFilter = document.getElementById('regionFilter');
                regions.forEach(region => {
                    const option = document.createElement('option');
                    option.value = region;
                    option.textContent = region;
                    regionFilter.appendChild(option);
                });
            }
        };
    }

    function setupDragAndDrop() {
        const pills = document.querySelectorAll('.pill');
        const dropZones = document.querySelectorAll('.drop-zone');

        pills.forEach(pill => {
            pill.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.dataset.field);
                e.target.style.opacity = '0.5';
            });

            pill.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
            });
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('over');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('over');
                const field = e.dataTransfer.getData('text/plain');
                const pill = document.querySelector(`.pill[data-field="${field}"]`);
                if (pill && !zone.contains(pill)) {
                    zone.appendChild(pill.cloneNode(true));
                }
            });
        });
    }

    function setupEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', generateReport);
        document.getElementById('resetBtn').addEventListener('click', resetConfiguration);
        document.getElementById('selfTestBtn').addEventListener('click', runSelfTest);
    }

    function generateReport() {
        // Logic to be implemented
        document.getElementById('reportOutput').innerHTML = '<p>Report generation logic not yet implemented.</p>';
    }

-   function resetConfiguration() {
-       document.getElementById('groupZone').innerHTML = '';
-       document.getElementById('metricZone').innerHTML = '';
-       document.getElementById('startDate').value = '';
-       document.getElementById('endDate').value = '';
-       document.getElementById('regionFilter').value = '';
-       document.getElementById('minAmount').value = '';
-       document.getElementById('reportOutput').innerHTML = '';
-       document.getElementById('testResults').innerHTML = '';
-   }
-
-   function runSelfTest() {
-       // Logic to be implemented
-       document.getElementById('testResults').innerHTML = '<p>Self-test logic not yet implemented.</p>';
-   }
});