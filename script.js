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
        setupAutoGenerate();
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

    function setupAutoGenerate() {
        const reportInputs = document.querySelectorAll('.filters input, .filters select');
        reportInputs.forEach(input => {
            input.addEventListener('change', generateReport);
        });

        const dropZones = document.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            zone.addEventListener('drop', () => {
                setTimeout(generateReport, 0);
            });
        });
    }

    function setupEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', generateReport);
        document.getElementById('resetBtn').addEventListener('click', resetConfiguration);
        document.getElementById('selfTestBtn').addEventListener('click', runSelfTest);
    }

    function renderReport(items, groupFields, metricFields) {
        const grouped = {};

        items.forEach(item => {
            const key = groupFields.map(field => item[field]).join(' - ');
            if (!grouped[key]) {
                grouped[key] = {};
                groupFields.forEach(field => {
                    grouped[key][field] = item[field];
                });
                metricFields.forEach(field => {
                    grouped[key][`sum_${field}`] = 0;
                });
                grouped[key].count = 0;
            }
            metricFields.forEach(field => {
                grouped[key][`sum_${field}`] += item[field];
            });
            grouped[key].count++;
        });

        const output = document.getElementById('reportOutput');
        if (Object.keys(grouped).length === 0) {
            output.innerHTML = '<p>No data matches the selected criteria.</p>';
            return;
        }

        let table = '<table><thead><tr>';
        groupFields.forEach(field => table += `<th>${field}</th>`);
        metricFields.forEach(field => table += `<th>SUM(${field})</th>`);
        table += '<th>Count</th></tr></thead><tbody>';

        for (const key in grouped) {
            table += '<tr>';
            groupFields.forEach(field => table += `<td>${grouped[key][field]}</td>`);
            metricFields.forEach(field => table += `<td>${grouped[key][`sum_${field}`]}</td>`);
            table += `<td>${grouped[key].count}</td>`;
            table += '</tr>';
        }

        table += '</tbody></table>';
        output.innerHTML = table;
    }

    function generateReport() {
        const groupFields = Array.from(document.querySelectorAll('#groupZone .pill')).map(p => p.dataset.field);
        const metricFields = Array.from(document.querySelectorAll('#metricZone .pill')).map(p => p.dataset.field);

        if (groupFields.length === 0 || metricFields.length === 0) {
            document.getElementById('reportOutput').innerHTML = '<p>Please select at least one grouping and one metric field.</p>';
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const region = document.getElementById('regionFilter').value;
        const minAmount = parseFloat(document.getElementById('minAmount').value) || 0;

        const transaction = db.transaction(['sales'], 'readonly');
        const objectStore = transaction.objectStore('sales');
        const items = [];

        objectStore.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const item = cursor.value;
                let include = true;
                if (startDate && item.date < startDate) include = false;
                if (endDate && item.date > endDate) include = false;
                if (region && item.region !== region) include = false;
                if (item.amount < minAmount) include = false;

                if (include) {
                    items.push(item);
                }
                cursor.continue();
            } else {
                renderReport(items, groupFields, metricFields);
            }
        };
    }

    function resetConfiguration() {
        document.getElementById('groupZone').innerHTML = '';
        document.getElementById('metricZone').innerHTML = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('regionFilter').value = '';
        document.getElementById('minAmount').value = '';
        document.getElementById('reportOutput').innerHTML = '';
        document.getElementById('testResults').innerHTML = '';
    }

    function runSelfTest() {
        const results = [];
        const testResultsEl = document.getElementById('testResults');
        testResultsEl.innerHTML = 'Running tests...';

        const tests = [
            () => new Promise((resolve) => {
                const transaction = db.transaction(['sales'], 'readonly');
                const objectStore = transaction.objectStore('sales');
                const countRequest = objectStore.count();
                countRequest.onsuccess = () => {
                    results.push(countRequest.result > 0 ? 'PASS: Initial data loaded.' : 'FAIL: Initial data not loaded.');
                    resolve();
                };
                countRequest.onerror = () => {
                    results.push('FAIL: Could not count data.');
                    resolve();
                };
            }),
            () => new Promise((resolve) => {
                const transaction = db.transaction(['sales'], 'readonly');
                const objectStore = transaction.objectStore('sales');
                const request = objectStore.getAll();
                request.onsuccess = () => {
                    const items = request.result;
                    const filtered = items.filter(i => i.region === 'North');
                    results.push(filtered.length === 2 ? 'PASS: Region filtering works.' : 'FAIL: Region filtering failed.');
                    resolve();
                };
                request.onerror = () => {
                    results.push('FAIL: Could not get all data for filtering test.');
                    resolve();
                };
            }),
        ];

        Promise.all(tests.map(test => test())).then(() => {
            testResultsEl.innerHTML = results.map(r => `<div>${r}</div>`).join('');
        });
    }
});