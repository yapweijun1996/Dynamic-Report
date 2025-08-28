document.addEventListener('DOMContentLoaded', () => {
    const dbName = 'DynamicReportDB';
    let db;

    const availableFields = [
        { id: 'date', name: 'Date', type: 'group' },
        { id: 'region', name: 'Region', type: 'group' },
        { id: 'salesperson', name: 'Salesperson', type: 'group' },
        { id: 'documentType', name: 'Document Type', type: 'group' },
        { id: 'documentId', name: 'Document ID', type: 'group' },
        { id: 'amount', name: 'Amount', type: 'metric' }
    ];

    const request = indexedDB.open(dbName, 2);

    request.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        let objectStore;
        if (!db.objectStoreNames.contains('sales')) {
            objectStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        } else {
            objectStore = event.target.transaction.objectStore('sales');
        }

        if (!objectStore.indexNames.contains('date')) {
            objectStore.createIndex('date', 'date', { unique: false });
        }
        if (!objectStore.indexNames.contains('region')) {
            objectStore.createIndex('region', 'region', { unique: false });
        }
        if (!objectStore.indexNames.contains('salesperson')) {
            objectStore.createIndex('salesperson', 'salesperson', { unique: false });
        }
        if (!objectStore.indexNames.contains('amount')) {
            objectStore.createIndex('amount', 'amount', { unique: false });
        }
        if (!objectStore.indexNames.contains('documentType')) {
            objectStore.createIndex('documentType', 'documentType', { unique: false });
        }
        if (!objectStore.indexNames.contains('documentId')) {
            objectStore.createIndex('documentId', 'documentId', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        populateInitialData();
        setupFieldList();
        setupEventListeners();
        setupAutoGenerate();
    };

    function populateInitialData() {
        const transaction = db.transaction(['sales'], 'readwrite');
        const objectStore = transaction.objectStore('sales');
        const countRequest = objectStore.count();

        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                const salesData = [];
                const docTypes = ['INV', 'QUO', 'DO', 'PO'];
                const regions = ['North', 'South', 'East', 'West'];
                const salespersons = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
                for (let i = 0; i < 200; i++) {
                    salesData.push({
                        date: `2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                        region: regions[Math.floor(Math.random() * regions.length)],
                        salesperson: salespersons[Math.floor(Math.random() * salespersons.length)],
                        documentType: docTypes[Math.floor(Math.random() * docTypes.length)],
                        documentId: `${docTypes[Math.floor(Math.random() * docTypes.length)]}-${1000 + i}`,
                        amount: Math.floor(Math.random() * 5000) + 100,
                    });
                }
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

    function setupFieldList() {
        const container = document.getElementById('field-list-container');
        availableFields.forEach(field => {
            const item = document.createElement('div');
            item.className = 'field-item';
            item.innerHTML = `
                <span>${field.name}</span>
                <div class="field-actions">
                    <button onclick="addField('groupZone', '${field.id}', '${field.name}')">Group</button>
                    <button onclick="addField('metricZone', '${field.id}', '${field.name}')">Metric</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    window.addField = function(zoneId, field, text) {
        const zone = document.getElementById(zoneId);
        if (field && !zone.querySelector(`[data-field="${field}"]`)) {
            const pill = createPill(field, text);
            zone.appendChild(pill);
            generateReport();
        }
    }

    function createPill(field, text) {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.dataset.field = field;
        pill.textContent = text;

        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            pill.remove();
            generateReport();
        };

        pill.appendChild(removeBtn);
        return pill;
    }

    function setupEventListeners() {
        document.getElementById('generateBtn').addEventListener('click', generateReport);
        document.getElementById('resetBtn').addEventListener('click', resetConfiguration);
        document.getElementById('selfTestBtn').addEventListener('click', runSelfTest);
    }

    function setupAutoGenerate() {
        const reportInputs = document.querySelectorAll('.filters input, .filters select');
        reportInputs.forEach(input => {
            input.addEventListener('change', generateReport);
        });
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
                if (typeof item[field] === 'number') {
                    grouped[key][`sum_${field}`] += item[field];
                }
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