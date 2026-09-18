const fs = require('fs');
const vm = require('vm');

global.window = { addEventListener: () => {}, indexedDB: null, location: { reload: () => {} } };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
const fakeEl = {
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {},
    innerHTML: '',
    value: '',
    options: [],
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    setAttribute: () => {}
};
global.document = {
    getElementById: (id) => ({ ...fakeEl, id }),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ ...fakeEl }),
    addEventListener: () => {},
    body: { style: {}, appendChild: () => {} }
};
global.navigator = { onLine: true };
global.XLSX = require('./xlsx.full.min.js');

const scriptCode = fs.readFileSync('script.js', 'utf8');
vm.runInThisContext(scriptCode);

async function runSync() {
    console.log("Starting Live Google Sheets Fetch & Cache Sync...");
    await loadData(true);
    
    console.log(`Live candidates parsed: ${candidatesData.length}`);
    console.log(`Incumbent map size: ${incumbentMap.size}`);
    console.log(`Chairman map size: ${chairmanMap.size}`);
    console.log(`Runner Up map size: ${runnerUpMap.size}`);
    console.log(`PK data rows: ${pkData.length}`);
    
    // Check gap seats
    const seatsWithCandidates = new Set();
    candidatesData.forEach(c => {
        const name = (c['Probable ZP Candidate Name'] || '').trim();
        const seat = (c['District'] || '').trim() + ' | ' + (c['ZP Seat Number'] || '').trim();
        if (name && name !== '-' && name.toLowerCase() !== 'nan' && seat !== ' | ') {
            seatsWithCandidates.add(seat);
        }
    });
    console.log(`Seats with identified candidates: ${seatsWithCandidates.size}`);

    const payload = {
        version: 'v5.1_20260918',
        timestamp: Date.now(),
        lastSync: new Date().toLocaleString(),
        candidatesData: candidatesData,
        incumbentMap: Array.from(incumbentMap.entries()),
        chairmanMap: Array.from(chairmanMap.entries()),
        runnerUpMap: Array.from(runnerUpMap.entries()),
        pkData: pkData
    };

    fs.writeFileSync('data_cache.json', JSON.stringify(payload, null, 2), 'utf8');
    const stats = fs.statSync('data_cache.json');
    console.log(`Successfully generated fresh data_cache.json (${(stats.size / 1024 / 1024).toFixed(2)} MB)!`);
}

runSync().catch(err => {
    console.error("Sync failed:", err);
    process.exit(1);
});
