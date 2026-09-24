const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure target directories exist
const dataDir = path.join(__dirname, '..', 'data');
const zonesDir = path.join(dataDir, 'zones');
const detailsDir = path.join(dataDir, 'details');
const viewsDir = path.join(dataDir, 'views');

[dataDir, zonesDir, detailsDir, viewsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load source dataset (from data_cache.json or passed in)
const cachePath = path.join(__dirname, '..', 'data_cache.json');
if (!fs.existsSync(cachePath)) {
    console.error('Error: data_cache.json not found!');
    process.exit(1);
}

console.log('Loading raw dataset from data_cache.json...');
const rawPayload = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

const candidates = rawPayload.candidatesData || [];
const incumbentMap = new Map();
if (Array.isArray(rawPayload.incumbentMap)) {
    rawPayload.incumbentMap.forEach(([k, v]) => incumbentMap.set(k, v));
} else if (rawPayload.incumbentMap) {
    Object.entries(rawPayload.incumbentMap).forEach(([k, v]) => incumbentMap.set(k, v));
}

const chairmanMap = new Map();
if (Array.isArray(rawPayload.chairmanMap)) {
    rawPayload.chairmanMap.forEach(([k, v]) => chairmanMap.set(k, v));
} else if (rawPayload.chairmanMap) {
    Object.entries(rawPayload.chairmanMap).forEach(([k, v]) => chairmanMap.set(k, v));
}

const runnerUpMap = new Map();
if (Array.isArray(rawPayload.runnerUpMap)) {
    rawPayload.runnerUpMap.forEach(([k, v]) => runnerUpMap.set(k, v));
} else if (rawPayload.runnerUpMap) {
    Object.entries(rawPayload.runnerUpMap).forEach(([k, v]) => runnerUpMap.set(k, v));
}

const pkData = rawPayload.pkData || [];

console.log(`Loaded ${candidates.length} candidate rows, ${incumbentMap.size} incumbents, ${chairmanMap.size} chairmen.`);

// Helper to sanitize strings
const clean = (val) => String(val || '').trim();

// 1. Group by Seats
const seatsMap = new Map(); // seatNumber -> seatObj
candidates.forEach((row, idx) => {
    const seat = clean(row['ZP Seat Number']);
    if (!seat || seat === 'undefined') return;

    if (!seatsMap.has(seat)) {
        const inc = incumbentMap.get(seat);
        const ru = runnerUpMap.get(seat);
        const district = clean(row.District);
        const ch = chairmanMap.get(district);

        seatsMap.set(seat, {
            seat: seat,
            zone: clean(row.Zone),
            district: district,
            pc: clean(row.PC),
            ac: clean(row.AC),
            block: clean(row.Block),
            panchayat: clean(row.Panchayat),
            reservation: clean(row['Seat Reservation Status']),
            chairman: ch ? {
                name: ch.chairman || '',
                viceChairman: ch.viceChairman || '',
                party: ch.party || ''
            } : null,
            incumbent: inc ? {
                name: inc.incumbentName || '',
                party: inc.party || '',
                meetingStatus: inc.meetingStatus || '',
                inFinalList: inc.inFinalList || '',
                callingStatus: inc.callingStatus || '',
                wantContestJSP: inc.wantContestJSP || ''
            } : null,
            candidates: []
        });
    }

    const candName = clean(row['Probable ZP Candidate Name']);
    if (candName && candName !== 'undefined' && candName !== '-' && candName.toLowerCase() !== 'nan') {
        seatsMap.get(seat).candidates.push({
            id: idx,
            name: candName,
            caste: clean(row.Caste),
            category: clean(row.Category),
            age: clean(row.Age),
            phone: clean(row['Contact No']),
            jsDesignation: clean(row['JS Designation']),
            source: clean(row['Recommendation Source Categories'])
        });
    }
});

console.log(`Unique seats identified: ${seatsMap.size}`);

// 2. Compute Summary & Statistics (KPIs, Bifurcation, Reservations)
let seatsWith1Plus = 0;
let seatsWith2Plus = 0;
let seatsWith3Plus = 0;
let gapSeats = 0;
let totalCandidates = 0;

const zoneStats = {}; // zone -> { totalSeats, seats1, seats2, seats3, gap, totalCand, districts: Set }
const distStats = {}; // dist -> { zone, totalSeats, seats1, seats2, seats3, gap, totalCand }
const reservationCounts = {};

const zonesList = new Set();
const districtsList = new Set();
const pcsList = new Set();
const acsList = new Set();
const blocksList = new Set();
const reservationsList = new Set();

seatsMap.forEach((seatObj, seatName) => {
    const candCount = seatObj.candidates.length;
    totalCandidates += candCount;

    if (candCount >= 1) seatsWith1Plus++;
    if (candCount >= 2) seatsWith2Plus++;
    if (candCount >= 3) seatsWith3Plus++;
    if (candCount === 0) gapSeats++;

    const z = seatObj.zone || 'Other';
    const d = seatObj.district || 'Other';
    const r = seatObj.reservation || 'Unreserved';

    zonesList.add(z);
    districtsList.add(d);
    if (seatObj.pc) pcsList.add(seatObj.pc);
    if (seatObj.ac) acsList.add(seatObj.ac);
    if (seatObj.block) blocksList.add(seatObj.block);
    if (r) reservationsList.add(r);

    // Zone stats
    if (!zoneStats[z]) {
        zoneStats[z] = { zone: z, totalSeats: 0, seats1: 0, seats2: 0, seats3: 0, gap: 0, totalCand: 0, districts: new Set() };
    }
    const zs = zoneStats[z];
    zs.totalSeats++;
    zs.totalCand += candCount;
    if (candCount >= 1) zs.seats1++;
    if (candCount >= 2) zs.seats2++;
    if (candCount >= 3) zs.seats3++;
    if (candCount === 0) zs.gap++;
    zs.districts.add(d);

    // District stats
    if (!distStats[d]) {
        const ch = chairmanMap.get(d);
        distStats[d] = {
            district: d,
            zone: z,
            chairman: ch ? ch.chairman : '',
            viceChairman: ch ? ch.viceChairman : '',
            totalSeats: 0,
            seats1: 0,
            seats2: 0,
            seats3: 0,
            gap: 0,
            totalCand: 0
        };
    }
    const ds = distStats[d];
    ds.totalSeats++;
    ds.totalCand += candCount;
    if (candCount >= 1) ds.seats1++;
    if (candCount >= 2) ds.seats2++;
    if (candCount >= 3) ds.seats3++;
    if (candCount === 0) ds.gap++;

    // Reservation stats
    reservationCounts[r] = (reservationCounts[r] || 0) + 1;
});

const totalSeatsCount = seatsMap.size;
const overallCompletionPct = totalSeatsCount > 0 ? (((seatsWith1Plus + seatsWith2Plus) / (totalSeatsCount * 2)) * 100).toFixed(2) : '0.00';

const sortedZonesSummary = Object.values(zoneStats).map(zs => ({
    zone: zs.zone,
    districtsCount: zs.districts.size,
    totalSeats: zs.totalSeats,
    seatsWithCandidates: zs.seats1,
    seats2Plus: zs.seats2,
    seats3Plus: zs.seats3,
    gap: zs.gap,
    totalCandidates: zs.totalCand,
    coveragePct: zs.totalSeats > 0 ? ((zs.seats1 / zs.totalSeats) * 100).toFixed(1) : '0.0'
})).sort((a, b) => a.zone.localeCompare(b.zone));

const sortedDistrictsSummary = Object.values(distStats).map(ds => ({
    district: ds.district,
    zone: ds.zone,
    chairman: ds.chairman,
    viceChairman: ds.viceChairman,
    totalSeats: ds.totalSeats,
    seatsWithCandidates: ds.seats1,
    seats2Plus: ds.seats2,
    seats3Plus: ds.seats3,
    gap: ds.gap,
    totalCandidates: ds.totalCand,
    coveragePct: ds.totalSeats > 0 ? ((ds.seats1 / ds.totalSeats) * 100).toFixed(1) : '0.0'
})).sort((a, b) => a.district.localeCompare(b.district));

const allSeatNames = Array.from(seatsMap.keys()).sort(new Intl.Collator(undefined, { numeric: true }).compare);

const summaryPayload = {
    version: rawPayload.version || 'v5.2',
    timestamp: Date.now(),
    lastSync: rawPayload.lastSync || new Date().toLocaleString(),
    kpi: {
        totalSeats: totalSeatsCount,
        seatsWithCandidates: seatsWith1Plus,
        seats2Plus: seatsWith2Plus,
        seats3Plus: seatsWith3Plus,
        gapSeats: gapSeats,
        totalCandidates: totalCandidates,
        overallCompletionPct: overallCompletionPct
    },
    zonesSummary: sortedZonesSummary,
    districtsSummary: sortedDistrictsSummary,
    reservationCounts: reservationCounts,
    filterOptions: {
        zones: Array.from(zonesList).sort(),
        districts: Array.from(districtsList).sort(),
        pcs: Array.from(pcsList).sort(),
        acs: Array.from(acsList).sort(),
        blocks: Array.from(blocksList).sort(),
        reservations: Array.from(reservationsList).sort()
    },
    seatNumbers: allSeatNames
};

const summaryFile = path.join(dataDir, 'summary.json');
fs.writeFileSync(summaryFile, JSON.stringify(summaryPayload));
const summarySize = fs.statSync(summaryFile).size;
console.log(`[OK] Generated summary.json (${(summarySize / 1024).toFixed(1)} KB)`);

// 3. Split by Zone (9 files in data/zones/*.json)
const zoneFilesMap = {}; // slug -> seatsArray
const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

sortedZonesSummary.forEach(z => {
    const slug = slugify(z.zone);
    zoneFilesMap[slug] = [];
});

seatsMap.forEach((seatObj) => {
    const slug = slugify(seatObj.zone || 'other');
    if (!zoneFilesMap[slug]) zoneFilesMap[slug] = [];
    zoneFilesMap[slug].push(seatObj);
});

// Write zone files and also a compact catalog
let totalZoneBytes = 0;
const allCompactSeats = [];

Object.entries(zoneFilesMap).forEach(([slug, seats]) => {
    seats.sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));
    allCompactSeats.push(...seats);

    const zoneFilePath = path.join(zonesDir, `${slug}.json`);
    const content = JSON.stringify(seats);
    fs.writeFileSync(zoneFilePath, content);
    const zSize = fs.statSync(zoneFilePath).size;
    totalZoneBytes += zSize;
    console.log(`  - Zone ${slug}.json: ${seats.length} seats, ${(zSize / 1024).toFixed(1)} KB`);
});

// Also write compact global catalog: all seats for directory rendering
const catalogFile = path.join(dataDir, 'seats_catalog.json');
fs.writeFileSync(catalogFile, JSON.stringify(allCompactSeats));
const catalogSize = fs.statSync(catalogFile).size;
const catalogGz = zlib.gzipSync(JSON.stringify(allCompactSeats)).length;
console.log(`[OK] Generated seats_catalog.json (${(catalogSize / 1024).toFixed(1)} KB raw, ${(catalogGz / 1024).toFixed(1)} KB gzipped)`);

// 4. Detailed Profiles (split by zone in data/details/{zone}.json)
const zoneDetailsMap = {};
sortedZonesSummary.forEach(z => {
    const slug = slugify(z.zone);
    zoneDetailsMap[slug] = {};
});

candidates.forEach((row, idx) => {
    const seat = clean(row['ZP Seat Number']);
    if (!seat) return;
    const slug = slugify(clean(row.Zone) || 'other');
    if (!zoneDetailsMap[slug]) zoneDetailsMap[slug] = {};
    if (!zoneDetailsMap[slug][seat]) zoneDetailsMap[slug][seat] = [];

    const candName = clean(row['Probable ZP Candidate Name']);
    if (candName && candName !== 'undefined' && candName !== '-') {
        zoneDetailsMap[slug][seat].push({
            id: idx,
            name: candName,
            contact: clean(row['Contact No']),
            category: clean(row.Category),
            caste: clean(row.Caste),
            age: clean(row.Age),
            profile: clean(row['Brief Profile']),
            jsDesignation: clean(row['JS Designation']),
            recommendation: clean(row['Recommendation Source Categories']),
            remarks: clean(row.Remarks),
            pkFeedback: clean(row['PK Feedback']),
            zone: clean(row.Zone),
            district: clean(row.District),
            pc: clean(row.PC),
            ac: clean(row.AC),
            block: clean(row.Block),
            reservation: clean(row['Seat Reservation Status'])
        });
    }
});

// Attach incumbent and runner up full details to zone details
Object.entries(zoneDetailsMap).forEach(([slug, seatsObj]) => {
    // Add incumbent & runnerup per seat
    Object.keys(seatsObj).forEach(seat => {
        const inc = incumbentMap.get(seat);
        const ru = runnerUpMap.get(seat);
        seatsObj[seat] = {
            candidates: seatsObj[seat],
            incumbent: inc || null,
            runnerUp: ru || null
        };
    });

    const detFile = path.join(detailsDir, `${slug}.json`);
    fs.writeFileSync(detFile, JSON.stringify(seatsObj));
    const dSize = fs.statSync(detFile).size;
    console.log(`  - Details ${slug}.json: ${(dSize / 1024).toFixed(1)} KB`);
});

// 5. Pre-compute View Datasets
// A) Analytics View: Pre-aggregated Demographics & Castes
const casteCounts = {};
const categoryCounts = {};
const ageGroups = { '18-35': 0, '36-50': 0, '51-65': 0, '65+': 0, 'Unknown': 0 };
let femaleCount = 0;
let maleCount = 0;

candidates.forEach(c => {
    const name = clean(c['Probable ZP Candidate Name']);
    if (!name || name === 'undefined' || name === '-') return;

    // Caste
    const caste = clean(c.Caste);
    if (caste && caste !== '-' && caste !== 'NA') {
        const normCaste = caste.charAt(0).toUpperCase() + caste.slice(1);
        casteCounts[normCaste] = (casteCounts[normCaste] || 0) + 1;
    }

    // Category
    const cat = clean(c.Category);
    if (cat && cat !== '-') {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // Age
    const age = parseInt(clean(c.Age), 10);
    if (isNaN(age) || age <= 0 || age > 110) {
        ageGroups['Unknown']++;
    } else if (age <= 35) {
        ageGroups['18-35']++;
    } else if (age <= 50) {
        ageGroups['36-50']++;
    } else if (age <= 65) {
        ageGroups['51-65']++;
    } else {
        ageGroups['65+']++;
    }

    // Gender estimate / check
    const desig = (clean(c['JS Designation']) + ' ' + clean(c['Brief Profile']) + ' ' + clean(c.Remarks)).toLowerCase();
    if (desig.includes('mahila') || desig.includes('female') || desig.includes('devi') || name.toLowerCase().includes('devi')) {
        femaleCount++;
    } else {
        maleCount++;
    }
});

const analyticsPayload = {
    topCastes: Object.entries(casteCounts).map(([caste, count]) => ({ caste, count })).sort((a, b) => b.count - a.count),
    categories: categoryCounts,
    ageGroups: ageGroups,
    gender: { female: femaleCount, male: maleCount },
    totalAnalyzed: totalCandidates
};

const analyticsFile = path.join(viewsDir, 'analytics.json');
fs.writeFileSync(analyticsFile, JSON.stringify(analyticsPayload));
console.log(`[OK] Generated views/analytics.json (${(fs.statSync(analyticsFile).size / 1024).toFixed(1)} KB)`);

// B) Gap Report View
const gapSeatsList = [];
seatsMap.forEach((seatObj, seat) => {
    if (seatObj.candidates.length === 0) {
        gapSeatsList.push({
            seat: seat,
            zone: seatObj.zone,
            district: seatObj.district,
            block: seatObj.block,
            reservation: seatObj.reservation,
            incumbentName: seatObj.incumbent?.name || '-'
        });
    }
});

const gapPayload = {
    gapSeatsCount: gapSeatsList.length,
    gapSeats: gapSeatsList,
    pkReviewRows: pkData.slice(0, 100) // sample / preview
};
const gapFile = path.join(viewsDir, 'gap_report.json');
fs.writeFileSync(gapFile, JSON.stringify(gapPayload));
console.log(`[OK] Generated views/gap_report.json (${(fs.statSync(gapFile).size / 1024).toFixed(1)} KB)`);

// C) Universal Search Index
// Lightweight index of candidates, chairmen, incumbents, and seats for ultra-fast server/client search
const searchIndex = {
    candidates: [],
    chairmen: [],
    incumbents: [],
    seats: []
};

candidates.forEach((r, idx) => {
    const name = clean(r['Probable ZP Candidate Name']);
    if (name && name !== '-' && name !== 'undefined') {
        searchIndex.candidates.push({
            id: idx,
            name: name,
            seat: clean(r['ZP Seat Number']),
            district: clean(r.District),
            zone: clean(r.Zone),
            phone: clean(r['Contact No']),
            caste: clean(r.Caste)
        });
    }
});

chairmanMap.forEach((ch, dist) => {
    searchIndex.chairmen.push({
        district: dist,
        chairman: ch.chairman || '',
        viceChairman: ch.viceChairman || '',
        party: ch.party || ''
    });
});

incumbentMap.forEach((inc, seat) => {
    searchIndex.incumbents.push({
        seat: seat,
        name: inc.incumbentName || '',
        party: inc.party || '',
        number: inc.incumbentNumber || '',
        runnerupName: inc.runnerupName || ''
    });
});

allSeatNames.forEach(seat => {
    const seatObj = seatsMap.get(seat);
    searchIndex.seats.push({
        seat: seat,
        district: seatObj?.district || '',
        zone: seatObj?.zone || '',
        block: seatObj?.block || ''
    });
});

const searchFile = path.join(dataDir, 'search_index.json');
fs.writeFileSync(searchFile, JSON.stringify(searchIndex));
const searchSize = fs.statSync(searchFile).size;
console.log(`[OK] Generated search_index.json (${(searchSize / 1024).toFixed(1)} KB)`);

console.log('\n=== STATIC DATA BUILD COMPLETE ===');
