const url = 'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx';

let candidatesData = [];
let pkData = [];
let allSeatNumbers = [];

// DOM Elements
const candidateStatusFilter = document.getElementById('candidateStatusFilter');
const zoneFilter = document.getElementById('zoneFilter');
const districtFilter = document.getElementById('districtFilter');
const pcFilter = document.getElementById('pcFilter');
const acFilter = document.getElementById('acFilter');
const blockFilter = document.getElementById('blockFilter');
const reservationFilter = document.getElementById('reservationFilter');
const refreshBtn = document.getElementById('refreshBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const candidateTableBody = document.getElementById('candidateTableBody');

// KPI elements
const kpiSeats = document.getElementById('kpi-seats');
const kpiUnique = document.getElementById('kpi-unique');
const kpiMulti = document.getElementById('kpi-multi');
const kpiGap = document.getElementById('kpi-gap');
const kpiTotal = document.getElementById('kpi-total');

// KPI cards
const cardTotalSeats = document.getElementById('card-total-seats');
const cardSeatsIdentified = document.getElementById('card-seats-identified');
const cardMultiCandidates = document.getElementById('card-multi-candidates');
const cardGapSeats = document.getElementById('card-gap-seats');

// Search elements
const seatSearch = document.getElementById('seatSearch');
const seatSuggestions = document.getElementById('seatSuggestions');
const clearSearch = document.getElementById('clearSearch');
const resultCount = document.getElementById('resultCount');
const activeFilterBadge = document.getElementById('activeFilterBadge');

// Bifurcation elements
const zoneTableBody = document.getElementById('zoneTableBody');
const districtTableBody = document.getElementById('districtTableBody');

// Reservation breakdown
const reservationBreakdown = document.getElementById('reservationBreakdown');
const reservationChips = document.getElementById('reservationChips');

// Modal
const candidateModal = document.getElementById('candidateModal');
const modalClose = document.getElementById('modalClose');
const modalContent = document.getElementById('modalContent');

// Bifurcation tabs
const bifTabs = document.querySelectorAll('.bif-tab');
const zoneTableContainer = document.getElementById('zoneTable');
const districtTableContainer = document.getElementById('districtTable');

// Track search mode
let searchMode = false;
let searchedSeat = '';

// Initialize
document.addEventListener('DOMContentLoaded', loadData);
refreshBtn.addEventListener('click', loadData);

// Bifurcation tab switching
bifTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        bifTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        if (target === 'zone') {
            zoneTableContainer.classList.add('bif-active');
            districtTableContainer.classList.remove('bif-active');
        } else {
            districtTableContainer.classList.add('bif-active');
            zoneTableContainer.classList.remove('bif-active');
        }
    });
});

// Modal close
modalClose.addEventListener('click', () => candidateModal.classList.remove('show'));
candidateModal.addEventListener('click', (e) => {
    if (e.target === candidateModal) candidateModal.classList.remove('show');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') candidateModal.classList.remove('show');
});

// Event Listeners for Filters
candidateStatusFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateActiveKPICard(); renderDashboard(); });
zoneFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('zone'); renderDashboard(); });
districtFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('district'); renderDashboard(); });
pcFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('pc'); renderDashboard(); });
acFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('ac'); renderDashboard(); });
blockFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; renderDashboard(); });
reservationFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; renderDashboard(); });

// Interactive KPI Card Clicks
cardTotalSeats.addEventListener('click', () => {
    candidateStatusFilter.value = 'All';
    updateActiveKPICard();
    renderDashboard();
});

cardSeatsIdentified.addEventListener('click', () => {
    candidateStatusFilter.value = (candidateStatusFilter.value === 'single' || candidateStatusFilter.value === 'multi') ? 'All' : 'single';
    updateActiveKPICard();
    renderDashboard();
});

cardMultiCandidates.addEventListener('click', () => {
    candidateStatusFilter.value = (candidateStatusFilter.value === 'multi') ? 'All' : 'multi';
    updateActiveKPICard();
    renderDashboard();
});

cardGapSeats.addEventListener('click', () => {
    candidateStatusFilter.value = (candidateStatusFilter.value === 'gap') ? 'All' : 'gap';
    updateActiveKPICard();
    renderDashboard();
});

function updateActiveKPICard() {
    const val = candidateStatusFilter.value;
    cardTotalSeats.classList.toggle('active-kpi', val === 'All');
    cardMultiCandidates.classList.toggle('active-kpi', val === 'multi');
    cardGapSeats.classList.toggle('active-kpi', val === 'gap');
    cardSeatsIdentified.classList.toggle('active-kpi', val === 'single');
}

// --- ZP Seat Search ---
seatSearch.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
        seatSuggestions.classList.remove('show');
        seatSuggestions.innerHTML = '';
        if (searchMode) {
            searchMode = false;
            searchedSeat = '';
            renderDashboard();
        }
        return;
    }

    const matches = allSeatNumbers.filter(s => s.toLowerCase().includes(query)).slice(0, 8);

    if (matches.length > 0) {
        seatSuggestions.innerHTML = matches.map(m => {
            const idx = m.toLowerCase().indexOf(query);
            const before = m.substring(0, idx);
            const match = m.substring(idx, idx + query.length);
            const after = m.substring(idx + query.length);
            return `<li data-seat="${m}">${before}<strong>${match}</strong>${after}</li>`;
        }).join('');
        seatSuggestions.classList.add('show');
    } else {
        seatSuggestions.innerHTML = '<li class="no-match">No matching seat found</li>';
        seatSuggestions.classList.add('show');
    }
});

seatSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = seatSearch.value.trim();
        if (query) {
            const exactMatch = allSeatNumbers.find(s => s.toLowerCase() === query.toLowerCase());
            const closestMatch = allSeatNumbers.find(s => s.toLowerCase().includes(query.toLowerCase()));
            const selectedSeat = exactMatch || closestMatch;
            if (selectedSeat) selectSeat(selectedSeat);
        }
    }
    if (e.key === 'Escape') {
        seatSuggestions.classList.remove('show');
        seatSearch.blur();
    }
});

seatSuggestions.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-seat]');
    if (li) selectSeat(li.dataset.seat);
});

clearSearch.addEventListener('click', () => {
    seatSearch.value = '';
    seatSuggestions.classList.remove('show');
    searchMode = false;
    searchedSeat = '';
    renderDashboard();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.seat-search-group')) {
        seatSuggestions.classList.remove('show');
    }
});

function selectSeat(seat) {
    seatSearch.value = seat;
    seatSuggestions.classList.remove('show');
    searchMode = true;
    searchedSeat = seat;
    candidateStatusFilter.value = 'All';
    zoneFilter.value = 'All';
    districtFilter.value = 'All';
    pcFilter.value = 'All';
    acFilter.value = 'All';
    blockFilter.value = 'All';
    reservationFilter.value = 'All';
    updateActiveKPICard();
    renderDashboard();
}

async function loadData() {
    loadingIndicator.classList.add('show');
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const finalCandidateSheet = workbook.Sheets['Final Candidate'];
        candidatesData = XLSX.utils.sheet_to_json(finalCandidateSheet, { defval: '' });

        const pkSheet = workbook.Sheets['PK Review Report'];
        pkData = XLSX.utils.sheet_to_json(pkSheet, { range: 1, defval: '' });

        allSeatNumbers = getUniqueValues(candidatesData, 'ZP Seat Number');

        populateInitialFilters();
        updateActiveKPICard();
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load data from Google Sheets.");
    } finally {
        loadingIndicator.classList.remove('show');
    }
}

function getUniqueValues(data, key) {
    const values = data.map(item => String(item[key]).trim()).filter(val => val && val !== 'undefined');
    return [...new Set(values)].sort();
}

function populateDropdown(element, values, selectedValue = 'All') {
    element.innerHTML = '<option value="All">All</option>';
    values.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        if (val === selectedValue) option.selected = true;
        element.appendChild(option);
    });
}

function populateInitialFilters() {
    populateDropdown(zoneFilter, getUniqueValues(candidatesData, 'Zone'));
    populateDropdown(reservationFilter, getUniqueValues(candidatesData, 'Seat Reservation Status'));
    updateFilters('zone', true);
}

function updateFilters(changedLevel, isInitial = false) {
    let filteredForDistrict = candidatesData;
    if (zoneFilter.value !== 'All') {
        filteredForDistrict = filteredForDistrict.filter(row => String(row.Zone).trim() === zoneFilter.value);
    }
    if (changedLevel === 'zone' || isInitial) {
        populateDropdown(districtFilter, getUniqueValues(filteredForDistrict, 'District'));
    }

    let filteredForPC = filteredForDistrict;
    if (districtFilter.value !== 'All') {
        filteredForPC = filteredForPC.filter(row => String(row.District).trim() === districtFilter.value);
    }
    if (changedLevel === 'zone' || changedLevel === 'district' || isInitial) {
        populateDropdown(pcFilter, getUniqueValues(filteredForPC, 'PC'));
    }

    let filteredForAC = filteredForPC;
    if (pcFilter.value !== 'All') {
        filteredForAC = filteredForAC.filter(row => String(row.PC).trim() === pcFilter.value);
    }
    if (changedLevel === 'zone' || changedLevel === 'district' || changedLevel === 'pc' || isInitial) {
        populateDropdown(acFilter, getUniqueValues(filteredForAC, 'AC'));
    }

    let filteredForBlock = filteredForAC;
    if (acFilter.value !== 'All') {
        filteredForBlock = filteredForBlock.filter(row => String(row.AC).trim() === acFilter.value);
    }
    if (changedLevel !== 'block') {
        populateDropdown(blockFilter, getUniqueValues(filteredForBlock, 'Block'));
    }
}

function getFilteredCandidates(applyStatusFilter = true) {
    if (searchMode && searchedSeat) {
        return candidatesData.filter(row => String(row['ZP Seat Number']).trim() === searchedSeat);
    }

    let filtered = candidatesData;
    if (zoneFilter.value !== 'All') filtered = filtered.filter(row => String(row.Zone).trim() === zoneFilter.value);
    if (districtFilter.value !== 'All') filtered = filtered.filter(row => String(row.District).trim() === districtFilter.value);
    if (pcFilter.value !== 'All') filtered = filtered.filter(row => String(row.PC).trim() === pcFilter.value);
    if (acFilter.value !== 'All') filtered = filtered.filter(row => String(row.AC).trim() === acFilter.value);
    if (blockFilter.value !== 'All') filtered = filtered.filter(row => String(row.Block).trim() === blockFilter.value);
    if (reservationFilter.value !== 'All') filtered = filtered.filter(row => String(row['Seat Reservation Status']).trim() === reservationFilter.value);

    // Apply Candidate Status filter (multi / single / gap) only if requested
    if (applyStatusFilter && candidateStatusFilter.value !== 'All') {
        const status = candidateStatusFilter.value;
        // Group by seat to count candidates
        const seatCounts = new Map();
        filtered.forEach(row => {
            const seat = String(row['ZP Seat Number']).trim();
            const candName = String(row['Probable ZP Candidate Name']).trim();
            if (!seat || seat === 'undefined') return;
            if (!seatCounts.has(seat)) seatCounts.set(seat, 0);
            if (candName && candName !== 'undefined') {
                seatCounts.set(seat, seatCounts.get(seat) + 1);
            }
        });

        filtered = filtered.filter(row => {
            const seat = String(row['ZP Seat Number']).trim();
            const count = seatCounts.get(seat) || 0;
            if (status === 'multi') return count >= 2;
            if (status === 'single') return count === 1;
            if (status === 'gap') return count === 0;
            return true;
        });
    }

    return filtered;
}

function renderDashboard() {
    // Geographical & reservation filtered (without candidate status filter) for top-level KPIs & Bifurcation
    const geoFiltered = getFilteredCandidates(false);
    // Fully filtered for the candidate table
    const tableFiltered = getFilteredCandidates(true);

    renderKPIs(geoFiltered);
    renderBifurcation(geoFiltered);
    renderSeatTable(tableFiltered);
    renderReservationBreakdown(geoFiltered);
}

// ===========================================
// BIFURCATION: Zone-wise & District-wise
// ===========================================
function renderBifurcation(data) {
    // --- Zone-wise ---
    const zoneStats = new Map();
    // Pre-calculate candidate counts per seat
    const seatCandidateCount = new Map();
    data.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!seat || seat === 'undefined') return;
        if (!seatCandidateCount.has(seat)) seatCandidateCount.set(seat, 0);
        if (candName && candName !== 'undefined') {
            seatCandidateCount.set(seat, seatCandidateCount.get(seat) + 1);
        }
    });

    data.forEach(row => {
        const zone = String(row.Zone || '').trim();
        const seat = String(row['ZP Seat Number'] || '').trim();
        const district = String(row.District || '').trim();
        const candidateName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!zone || zone === 'undefined') return;

        if (!zoneStats.has(zone)) {
            zoneStats.set(zone, {
                districts: new Set(),
                seats: new Set(),
                seatsWithCandidate: new Set(),
                seatsWith2Plus: new Set(),
                totalCandidates: 0
            });
        }
        const z = zoneStats.get(zone);
        if (district && district !== 'undefined') z.districts.add(district);
        if (seat && seat !== 'undefined') {
            z.seats.add(seat);
            const count = seatCandidateCount.get(seat) || 0;
            if (count >= 1) z.seatsWithCandidate.add(seat);
            if (count >= 2) z.seatsWith2Plus.add(seat);
            if (candidateName && candidateName !== 'undefined') {
                z.totalCandidates++;
            }
        }
    });

    zoneTableBody.innerHTML = '';
    const sortedZones = Array.from(zoneStats.keys()).sort();
    sortedZones.forEach(zone => {
        const z = zoneStats.get(zone);
        const gap = z.seats.size - z.seatsWithCandidate.size;
        const tr = document.createElement('tr');
        tr.classList.add('bif-row');
        tr.innerHTML = `
            <td><strong>${zone}</strong></td>
            <td>${z.districts.size}</td>
            <td><strong>${z.seats.size}</strong></td>
            <td><span class="count-badge count-identified">${z.seatsWithCandidate.size}</span></td>
            <td><span class="count-badge count-multi-pill">${z.seatsWith2Plus.size}</span></td>
            <td><span class="gap-badge ${gap > 0 ? 'has-gap' : 'no-gap'}">${gap}</span></td>
            <td><strong>${z.totalCandidates}</strong></td>
        `;
        // Click on zone row to filter by that zone
        tr.addEventListener('click', () => {
            zoneFilter.value = zone;
            searchMode = false;
            seatSearch.value = '';
            updateFilters('zone');
            renderDashboard();
        });
        zoneTableBody.appendChild(tr);
    });

    // --- District-wise ---
    const districtStats = new Map();
    data.forEach(row => {
        const district = String(row.District || '').trim();
        const zone = String(row.Zone || '').trim();
        const seat = String(row['ZP Seat Number'] || '').trim();
        const chairman = String(row['ZP Chairman'] || '').trim();
        const candidateName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!district || district === 'undefined') return;

        if (!districtStats.has(district)) {
            districtStats.set(district, {
                zone: zone,
                chairman: '',
                seats: new Set(),
                seatsWithCandidate: new Set(),
                seatsWith2Plus: new Set(),
                totalCandidates: 0
            });
        }
        const d = districtStats.get(district);
        if (chairman && chairman !== 'undefined') d.chairman = chairman;
        if (seat && seat !== 'undefined') {
            d.seats.add(seat);
            const count = seatCandidateCount.get(seat) || 0;
            if (count >= 1) d.seatsWithCandidate.add(seat);
            if (count >= 2) d.seatsWith2Plus.add(seat);
            if (candidateName && candidateName !== 'undefined') {
                d.totalCandidates++;
            }
        }
    });

    districtTableBody.innerHTML = '';
    const sortedDistricts = Array.from(districtStats.keys()).sort();
    sortedDistricts.forEach(district => {
        const d = districtStats.get(district);
        const gap = d.seats.size - d.seatsWithCandidate.size;
        const tr = document.createElement('tr');
        tr.classList.add('bif-row');
        tr.innerHTML = `
            <td><strong>${district}</strong></td>
            <td>${d.zone}</td>
            <td>${d.chairman ? `<span class="chairman-badge-sm">${d.chairman}</span>` : '-'}</td>
            <td><strong>${d.seats.size}</strong></td>
            <td><span class="count-badge count-identified">${d.seatsWithCandidate.size}</span></td>
            <td><span class="count-badge count-multi-pill">${d.seatsWith2Plus.size}</span></td>
            <td><span class="gap-badge ${gap > 0 ? 'has-gap' : 'no-gap'}">${gap}</span></td>
            <td><strong>${d.totalCandidates}</strong></td>
        `;
        // Click on district row to filter by that district
        tr.addEventListener('click', () => {
            if (d.zone && d.zone !== 'undefined') {
                zoneFilter.value = d.zone;
                updateFilters('zone');
            }
            districtFilter.value = district;
            searchMode = false;
            seatSearch.value = '';
            updateFilters('district');
            renderDashboard();
        });
        districtTableBody.appendChild(tr);
    });
}

// ===========================================
// SEAT TABLE: Compact, names only, click to expand
// ===========================================
function renderSeatTable(data) {
    candidateTableBody.innerHTML = '';

    // Active status filter indicator
    const currentStatus = candidateStatusFilter.value;
    if (currentStatus !== 'All') {
        const labels = {
            'multi': 'Showing Seats with 2+ Candidates',
            'single': 'Showing Seats with 1 Candidate',
            'gap': 'Showing Gap Seats (0 Candidates)'
        };
        activeFilterBadge.textContent = labels[currentStatus] || '';
        activeFilterBadge.style.display = 'inline-block';
    } else {
        activeFilterBadge.style.display = 'none';
    }

    if (data.length === 0) {
        candidateTableBody.innerHTML = '<tr><td colspan="6" class="no-results-cell">No matching ZP seats or candidates found for selected filters</td></tr>';
        resultCount.textContent = '0 seats';
        return;
    }

    // Group by ZP Seat Number
    const seatsMap = new Map();
    data.forEach(row => {
        const seat = String(row['ZP Seat Number']).trim();
        if (!seat || seat === 'undefined') return;
        if (!seatsMap.has(seat)) seatsMap.set(seat, []);
        seatsMap.get(seat).push(row);
    });

    const sortedSeats = Array.from(seatsMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    let totalCandidateCount = 0;

    sortedSeats.forEach(seat => {
        const rowsForSeat = seatsMap.get(seat);
        const seatInfo = rowsForSeat[0]; // Use first row for seat metadata
        const candidateRows = rowsForSeat.filter(row => String(row['Probable ZP Candidate Name']).trim());
        const candCount = candidateRows.length;

        const reservationStatus = String(seatInfo['Seat Reservation Status'] || '').trim();
        const badgeClass = getReservationBadgeClass(reservationStatus);
        const district = String(seatInfo.District || '').trim();
        const block = String(seatInfo.Block || '').trim();

        // Build candidate count pill
        let countPill = '';
        if (candCount >= 2) {
            countPill = `<span class="seat-count-badge count-multi-badge">${candCount} Candidates</span>`;
        } else if (candCount === 1) {
            countPill = `<span class="seat-count-badge count-single-badge">1 Candidate</span>`;
        } else {
            countPill = `<span class="seat-count-badge count-gap-badge">0 (Gap)</span>`;
        }

        // Build candidate name tags
        let candidateTags = '';
        if (candCount > 0) {
            candidateTags = candidateRows.map((row, idx) => {
                const name = String(row['Probable ZP Candidate Name']).trim();
                totalCandidateCount++;
                return `<span class="candidate-tag" data-seat="${seat}" data-idx="${idx}" title="Click to view full details of ${name}">
                    <span class="candidate-num">${idx + 1}</span>
                    <span class="candidate-name-text">${name}</span>
                    <svg class="candidate-arrow-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </span>`;
            }).join('');
        } else {
            candidateTags = '<span class="no-candidate-text">⚠️ No candidate identified yet (Gap)</span>';
        }

        const tr = document.createElement('tr');
        if (searchMode) tr.classList.add('search-highlight');
        if (candCount === 0) tr.classList.add('no-candidate-row');
        if (candCount >= 2) tr.classList.add('multi-candidate-row');

        tr.innerHTML = `
            <td><strong class="seat-title">${seat}</strong></td>
            <td>${reservationStatus ? `<span class="reservation-badge ${badgeClass}">${reservationStatus}</span>` : '-'}</td>
            <td>${district || '-'}</td>
            <td>${block || '-'}</td>
            <td>${countPill}</td>
            <td class="candidates-cell">${candidateTags}</td>
        `;

        candidateTableBody.appendChild(tr);
    });

    resultCount.textContent = `${totalCandidateCount} candidate${totalCandidateCount !== 1 ? 's' : ''} in ${sortedSeats.length} seat${sortedSeats.length !== 1 ? 's' : ''}`;

    // Attach click handlers to candidate tags
    candidateTableBody.querySelectorAll('.candidate-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            const seatNum = tag.dataset.seat;
            const idx = parseInt(tag.dataset.idx);
            showCandidateDetail(seatNum, idx);
        });
    });
}

// ===========================================
// CANDIDATE DETAIL MODAL
// ===========================================
function showCandidateDetail(seatNum, idx) {
    const rowsForSeat = candidatesData.filter(row =>
        String(row['ZP Seat Number']).trim() === seatNum
    );
    const candidateRows = rowsForSeat.filter(row => String(row['Probable ZP Candidate Name']).trim());

    if (idx >= candidateRows.length) return;

    const row = candidateRows[idx];
    const seatInfo = rowsForSeat[0];

    const name = row['Probable ZP Candidate Name'] || '-';
    const contact = row['Contact No'] || '-';
    const category = row['Category'] || '-';
    const caste = row['Caste'] || '-';
    const age = row['Age'] || '-';
    const profile = row['Brief Profile'] || '-';
    const jsDesignation = row['JS Designation'] || '-';
    const recommendation = row['Recommendation Source Categories'] || '-';
    const remarks = row['Remarks'] || '-';
    const pkFeedback = row['PK Feedback'] || '-';
    const reservation = String(seatInfo['Seat Reservation Status'] || '').trim();
    const chairman = String(seatInfo['ZP Chairman'] || '').trim();
    const zone = row['Zone'] || '-';
    const district = row['District'] || '-';
    const pc = row['PC'] || '-';
    const ac = row['AC'] || '-';
    const block = row['Block'] || '-';
    const badgeClass = getReservationBadgeClass(reservation);

    // Navigation: prev/next candidate in the same seat
    const totalInSeat = candidateRows.length;
    const prevIdx = idx > 0 ? idx - 1 : null;
    const nextIdx = idx < totalInSeat - 1 ? idx + 1 : null;

    modalContent.innerHTML = `
        <div class="modal-header-section">
            <div class="modal-badge-row">
                <span class="modal-candidate-badge">Candidate ${idx + 1} of ${totalInSeat}</span>
                <span class="modal-seat-badge">${seatNum}</span>
                ${reservation ? `<span class="reservation-badge ${badgeClass}">${reservation}</span>` : ''}
            </div>
            <h2 class="modal-candidate-name">${name}</h2>
        </div>

        ${totalInSeat > 1 ? `
        <div class="modal-nav">
            <button class="modal-nav-btn ${prevIdx === null ? 'disabled' : ''}" ${prevIdx !== null ? `onclick="showCandidateDetail('${seatNum}', ${prevIdx})"` : 'disabled'}>
                ← Previous Candidate
            </button>
            <span class="modal-nav-indicator">${idx + 1} / ${totalInSeat}</span>
            <button class="modal-nav-btn ${nextIdx === null ? 'disabled' : ''}" ${nextIdx !== null ? `onclick="showCandidateDetail('${seatNum}', ${nextIdx})"` : 'disabled'}>
                Next Candidate →
            </button>
        </div>
        ` : ''}

        <div class="modal-details-grid">
            <div class="detail-item">
                <span class="detail-label">Contact Number</span>
                <span class="detail-value">${contact}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Category</span>
                <span class="detail-value">${category}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Caste</span>
                <span class="detail-value">${caste}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Age</span>
                <span class="detail-value">${age}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">JS Designation</span>
                <span class="detail-value">${jsDesignation}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Recommendation Source</span>
                <span class="detail-value">${recommendation}</span>
            </div>
        </div>

        <div class="modal-location-bar">
            <span class="loc-item"><span class="loc-label">Zone:</span> ${zone}</span>
            <span class="loc-divider">›</span>
            <span class="loc-item"><span class="loc-label">District:</span> ${district}</span>
            <span class="loc-divider">›</span>
            <span class="loc-item"><span class="loc-label">PC:</span> ${pc}</span>
            <span class="loc-divider">›</span>
            <span class="loc-item"><span class="loc-label">AC:</span> ${ac}</span>
            <span class="loc-divider">›</span>
            <span class="loc-item"><span class="loc-label">Block:</span> ${block}</span>
        </div>

        ${chairman && chairman !== 'undefined' ? `
        <div class="modal-chairman">
            <span class="detail-label">District ZP Chairman</span>
            <span class="chairman-badge-sm">👑 ${chairman}</span>
        </div>
        ` : ''}

        <div class="modal-profile-section">
            <span class="detail-label">Brief Profile</span>
            <div class="modal-profile-text">${profile}</div>
        </div>

        ${remarks && remarks !== '-' ? `
        <div class="modal-profile-section">
            <span class="detail-label">Remarks</span>
            <div class="modal-profile-text remarks-text">${remarks}</div>
        </div>
        ` : ''}

        ${pkFeedback && pkFeedback !== '-' ? `
        <div class="modal-profile-section">
            <span class="detail-label">PK Feedback</span>
            <div class="modal-profile-text pk-text">${pkFeedback}</div>
        </div>
        ` : ''}
    `;

    candidateModal.classList.add('show');
}

// ===========================================
// KPIs
// ===========================================
function renderKPIs(filteredCandidates) {
    const uniqueSeats = new Set();
    let totalCandidatesIdentified = 0;
    const seatCandidateMap = new Map();

    filteredCandidates.forEach(row => {
        const seatNumber = String(row['ZP Seat Number']).trim();
        const candidateName = String(row['Probable ZP Candidate Name']).trim();
        if (seatNumber && seatNumber !== 'undefined') {
            uniqueSeats.add(seatNumber);
            if (!seatCandidateMap.has(seatNumber)) {
                seatCandidateMap.set(seatNumber, 0);
            }
            if (candidateName && candidateName !== 'undefined') {
                totalCandidatesIdentified++;
                seatCandidateMap.set(seatNumber, seatCandidateMap.get(seatNumber) + 1);
            }
        }
    });

    const totalZPSeats = uniqueSeats.size;
    let seatsWithAtLeastOne = 0;
    let seatsWith2Plus = 0;
    let gapSeats = 0;

    seatCandidateMap.forEach(count => {
        if (count >= 1) seatsWithAtLeastOne++;
        if (count >= 2) seatsWith2Plus++;
        if (count === 0) gapSeats++;
    });

    animateKPI(kpiSeats, totalZPSeats);
    animateKPI(kpiUnique, seatsWithAtLeastOne);
    animateKPI(kpiMulti, seatsWith2Plus);
    animateKPI(kpiGap, gapSeats);
    animateKPI(kpiTotal, totalCandidatesIdentified);
}

function animateKPI(element, targetValue) {
    if (!element) return;
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    const duration = 400;
    const startTime = performance.now();
    function step(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.round(currentValue + (targetValue - currentValue) * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ===========================================
// RESERVATION BREAKDOWN
// ===========================================
function getReservationBadgeClass(status) {
    const s = String(status).trim().toLowerCase();
    if (s.includes('sc') && s.includes('mahila')) return 'res-sc-mahila';
    if (s.includes('sc')) return 'res-sc';
    if (s.includes('st') && s.includes('mahila')) return 'res-st-mahila';
    if (s.includes('st')) return 'res-st';
    if (s.includes('backward') && s.includes('mahila')) return 'res-bc-mahila';
    if (s.includes('backward')) return 'res-bc';
    if (s.includes('unreserved') && s.includes('mahila')) return 'res-ur-mahila';
    if (s.includes('unreserved')) return 'res-ur';
    return 'res-default';
}

function renderReservationBreakdown(filteredCandidates) {
    const seatReservationMap = new Map();
    filteredCandidates.forEach(row => {
        const seat = String(row['ZP Seat Number']).trim();
        const reservation = String(row['Seat Reservation Status'] || '').trim();
        if (seat && seat !== 'undefined' && reservation) {
            seatReservationMap.set(seat, reservation);
        }
    });

    const counts = {};
    seatReservationMap.forEach((status) => {
        counts[status] = (counts[status] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (entries.length > 0) {
        reservationChips.innerHTML = entries.map(([status, count]) => {
            const badgeClass = getReservationBadgeClass(status);
            return `<div class="res-chip ${badgeClass}">
                <span class="res-chip-label">${status}</span>
                <span class="res-chip-count">${count}</span>
            </div>`;
        }).join('');
        reservationBreakdown.style.display = 'block';
    } else {
        reservationBreakdown.style.display = 'none';
    }
}
