const url = 'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx';

let candidatesData = [];
let incumbentMap = new Map(); // seat -> incumbent object
let chairmanMap = new Map();  // district -> chairman object
let pkData = [];
let allSeatNumbers = [];

// DOM Elements
const candidateStatusFilter = document.getElementById('candidateStatusFilter');
const incumbentFilter = document.getElementById('incumbentFilter');
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
if (refreshBtn) {
    refreshBtn.addEventListener('click', loadData);
}

async function loadData() {
    loadingIndicator.classList.add('show');
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // 1. Final Candidate Sheet
        const finalCandidateSheet = workbook.Sheets['Final Candidate'];
        candidatesData = XLSX.utils.sheet_to_json(finalCandidateSheet, { defval: '' });

        // 2. Incumbent ZP Sheet
        incumbentMap.clear();
        const incumbentSheet = workbook.Sheets['Incumbent ZP'];
        if (incumbentSheet) {
            const incumbentRows = XLSX.utils.sheet_to_json(incumbentSheet, { defval: '' });
            incumbentRows.forEach(row => {
                const seat = String(row['ZP Seat Number'] || '').trim();
                if (seat && seat !== 'undefined') {
                    incumbentMap.set(seat, {
                        district: String(row['District'] || '').trim(),
                        pc: String(row['PC'] || '').trim(),
                        ac: String(row['AC'] || '').trim(),
                        block: String(row['Block'] || '').trim(),
                        panchayat: String(row['Panchayat'] || '').trim(),
                        seatNumber: seat,
                        chairman: String(row['ZP Chairman'] || '').trim(),
                        viceChairman: String(row['ZP Vice Chairman'] || '').trim(),
                        incumbentName: String(row['Incumbent ZP Name'] || '').trim(),
                        inFinalList: String(row['In Final Candidates List'] || '').trim(),
                        incumbentNumber: String(row['Incumbent ZP Number'] || '').trim(),
                        currentReservation: String(row['Current Seat Reservation'] || '').trim(),
                        probableReservation: String(row['Probable Seat Reservation'] || '').trim(),
                        party: String(row['Party Inclination'] || '').trim(),
                        callingStatus: String(row['Calling Status'] || '').trim(),
                        meetingStatus: String(row['PK Meeting Status'] || '').trim(),
                        wantContestJSP: String(row['Want contest with JSP'] || '').trim(),
                        onboardingStatus: String(row['Onboarding Status '] || row['Onboarding Status'] || '').trim(),
                        meetingDate: String(row['Meeting Date'] || '').trim(),
                        remarks: String(row['Remarks'] || '').trim(),
                        runnerupName: String(row['Runnerup ZP Name'] || '').trim(),
                        runnerupNumber: String(row['Runnerup ZP Number'] || '').trim()
                    });
                }
            });
        }

        // 3. ZP Chairman Sheet
        chairmanMap.clear();
        const chairmanSheet = workbook.Sheets['ZP Chairman'];
        if (chairmanSheet) {
            const chairmanRows = XLSX.utils.sheet_to_json(chairmanSheet, { defval: '' });
            chairmanRows.forEach(row => {
                const dist = String(row['District'] || row['District Name'] || '').trim();
                if (dist && dist !== 'undefined') {
                    chairmanMap.set(dist, {
                        district: dist,
                        chairman: String(row['District ZP Chairman'] || row['Chairman Name'] || row['Incumbent Chairman'] || '').trim(),
                        party: String(row['Party'] || row['Party Inclination'] || '').trim(),
                        viceChairman: String(row['Vice Chairman'] || row['ZP Vice Chairman'] || '').trim(),
                        profile: String(row['Profile'] || '').trim()
                    });
                }
            });
        }

        // 4. PK Review Report Sheet
        const pkSheet = workbook.Sheets['PK Review Report'];
        if (pkSheet) {
            pkData = XLSX.utils.sheet_to_json(pkSheet, { range: 1, defval: '' });
        }

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

// Main View Switcher
const viewDashboardBtn = document.getElementById('viewDashboardBtn');
const viewReportBtn = document.getElementById('viewReportBtn');
const dashboardViewContainer = document.getElementById('dashboardViewContainer');
const reportViewContainer = document.getElementById('reportViewContainer');
const viewTitle = document.getElementById('viewTitle');
const viewSubtitle = document.getElementById('viewSubtitle');

if (viewDashboardBtn && viewReportBtn) {
    viewDashboardBtn.addEventListener('click', () => switchMainView('dashboard'));
    viewReportBtn.addEventListener('click', () => switchMainView('report'));
}

function switchMainView(view) {
    if (view === 'dashboard') {
        viewDashboardBtn.classList.add('active');
        viewReportBtn.classList.remove('active');
        dashboardViewContainer.classList.add('active-panel');
        reportViewContainer.classList.remove('active-panel');
        if (viewTitle) viewTitle.textContent = 'Candidate & Incumbent Overview';
        if (viewSubtitle) viewSubtitle.textContent = 'Comprehensive analysis of ZP Seats, Probable Candidates, Sitting Incumbents & Leadership';
    } else {
        viewReportBtn.classList.add('active');
        viewDashboardBtn.classList.remove('active');
        reportViewContainer.classList.add('active-panel');
        dashboardViewContainer.classList.remove('active-panel');
        if (viewTitle) viewTitle.textContent = 'Executive Summary Report';
        if (viewSubtitle) viewSubtitle.textContent = 'Numerical State & District Breakdown | Social Category & Recommendation Channel Analysis';
    }
}

// Modal close
modalClose.addEventListener('click', () => candidateModal.classList.remove('show'));
candidateModal.addEventListener('click', (e) => {
    if (e.target === candidateModal) candidateModal.classList.remove('show');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') candidateModal.classList.remove('show');
});

const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const sidebarElement = document.querySelector('.sidebar');

if (mobileFilterToggle && sidebarElement) {
    mobileFilterToggle.addEventListener('click', () => {
        sidebarElement.classList.toggle('mobile-open');
        mobileFilterToggle.classList.toggle('active');
    });
}

// Event Listeners for Filters
candidateStatusFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateActiveKPICard(); renderDashboard(); });
incumbentFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; renderDashboard(); });
zoneFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('zone'); renderDashboard(); });
districtFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('district'); renderDashboard(); });
pcFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('pc'); renderDashboard(); });
acFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; updateFilters('ac'); renderDashboard(); });
blockFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; renderDashboard(); });
reservationFilter.addEventListener('change', () => { searchMode = false; seatSearch.value = ''; renderDashboard(); });

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetAllFilters);
}

function resetAllFilters() {
    searchMode = false;
    searchedSeat = '';
    seatSearch.value = '';
    seatSuggestions.classList.remove('show');

    candidateStatusFilter.value = 'All';
    incumbentFilter.value = 'All';
    zoneFilter.value = 'All';
    districtFilter.value = 'All';
    pcFilter.value = 'All';
    acFilter.value = 'All';
    blockFilter.value = 'All';
    reservationFilter.value = 'All';

    updateFilters('zone', true);
    updateActiveKPICard();
    renderDashboard();
}

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
    incumbentFilter.value = 'All';
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

        // 1. Final Candidate Sheet
        const finalCandidateSheet = workbook.Sheets['Final Candidate'];
        candidatesData = XLSX.utils.sheet_to_json(finalCandidateSheet, { defval: '' });

        // 2. Incumbent ZP Sheet
        incumbentMap.clear();
        const incumbentSheet = workbook.Sheets['Incumbent ZP'];
        if (incumbentSheet) {
            const incumbentRows = XLSX.utils.sheet_to_json(incumbentSheet, { defval: '' });
            incumbentRows.forEach(row => {
                const seat = String(row['ZP Seat Number'] || '').trim();
                if (seat && seat !== 'undefined') {
                    incumbentMap.set(seat, {
                        district: String(row['District'] || '').trim(),
                        pc: String(row['PC'] || '').trim(),
                        ac: String(row['AC'] || '').trim(),
                        block: String(row['Block'] || '').trim(),
                        panchayat: String(row['Panchayat'] || '').trim(),
                        seatNumber: seat,
                        chairman: String(row['ZP Chairman'] || '').trim(),
                        viceChairman: String(row['ZP Vice Chairman'] || '').trim(),
                        incumbentName: String(row['Incumbent ZP Name'] || '').trim(),
                        inFinalList: String(row['In Final Candidates List'] || '').trim(),
                        incumbentNumber: String(row['Incumbent ZP Number'] || '').trim(),
                        currentReservation: String(row['Current Seat Reservation'] || '').trim(),
                        probableReservation: String(row['Probable Seat Reservation'] || '').trim(),
                        party: String(row['Party Inclination'] || '').trim(),
                        callingStatus: String(row['Calling Status'] || '').trim(),
                        meetingStatus: String(row['PK Meeting Status'] || '').trim(),
                        wantContestJSP: String(row['Want contest with JSP'] || '').trim(),
                        onboardingStatus: String(row['Onboarding Status '] || row['Onboarding Status'] || '').trim(),
                        meetingDate: String(row['Meeting Date'] || '').trim(),
                        remarks: String(row['Remarks'] || '').trim(),
                        runnerupName: String(row['Runnerup ZP Name'] || '').trim(),
                        runnerupNumber: String(row['Runnerup ZP Number'] || '').trim()
                    });
                }
            });
        }

        // 3. ZP Chairman Sheet
        chairmanMap.clear();
        const chairmanSheet = workbook.Sheets['ZP Chairman'];
        if (chairmanSheet) {
            const chairmanRows = XLSX.utils.sheet_to_json(chairmanSheet, { defval: '' });
            chairmanRows.forEach(row => {
                const dist = String(row['District'] || row['District Name'] || '').trim();
                if (dist && dist !== 'undefined') {
                    chairmanMap.set(dist, {
                        district: dist,
                        chairman: String(row['District ZP Chairman'] || row['Chairman Name'] || row['Incumbent Chairman'] || '').trim(),
                        party: String(row['Party'] || row['Party Inclination'] || '').trim(),
                        viceChairman: String(row['Vice Chairman'] || row['ZP Vice Chairman'] || '').trim(),
                        profile: String(row['Profile'] || '').trim()
                    });
                }
            });
        }

        // 4. PK Review Report Sheet
        const pkSheet = workbook.Sheets['PK Review Report'];
        if (pkSheet) {
            pkData = XLSX.utils.sheet_to_json(pkSheet, { range: 1, defval: '' });
        }

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

    // Apply Incumbent Status filter if requested
    if (incumbentFilter.value !== 'All') {
        const incVal = incumbentFilter.value;
        filtered = filtered.filter(row => {
            const seat = String(row['ZP Seat Number']).trim();
            const inc = incumbentMap.get(seat);
            if (!inc) return false;
            if (incVal === 'inFinalList') {
                return inc.inFinalList && inc.inFinalList.toLowerCase() !== 'no';
            }
            if (incVal === 'jsp') {
                const party = (inc.party || '').toLowerCase();
                const meet = (inc.meetingStatus || '').toLowerCase();
                return party.includes('jsp') || meet.includes('ready') || meet.includes('onboard');
            }
            if (incVal === 'otherParty') {
                const party = (inc.party || '').toUpperCase();
                return party.includes('BJP') || party.includes('RJD') || party.includes('JDU') || party.includes('JD(U)') || party.includes('INC');
            }
            return true;
        });
    }

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
    const geoFiltered = getFilteredCandidates(false);
    const tableFiltered = getFilteredCandidates(true);

    renderKPIs(geoFiltered);
    renderBifurcation(geoFiltered);
    renderExecutiveReport(geoFiltered);
    renderSeatTable(tableFiltered);
    renderReservationBreakdown(geoFiltered);
}

// ===========================================
// EXECUTIVE NUMERICAL REPORT (1-Page Print Ready)
// ===========================================
function renderExecutiveReport(data) {
    const reportKpiBar = document.getElementById('reportKpiBar');
    const reportZoneDistrictBody = document.getElementById('reportZoneDistrictBody');
    const reportCategoryBody = document.getElementById('reportCategoryBody');
    const reportSourceBody = document.getElementById('reportSourceBody');

    if (!reportKpiBar || !reportZoneDistrictBody) return;

    // 1. Overall Stats Calculation
    const uniqueSeats = new Set();
    let totalCandidates = 0;
    const seatCandidateMap = new Map();
    const zoneDistrictsMap = new Map(); // Zone -> Map(District -> {seats, seats1Plus, seats2Plus, candCount})

    data.forEach(row => {
        const zone = String(row.Zone || '').trim();
        const district = String(row.District || '').trim();
        const seat = String(row['ZP Seat Number'] || '').trim();
        const candidateName = String(row['Probable ZP Candidate Name'] || '').trim();

        if (seat && seat !== 'undefined') {
            uniqueSeats.add(seat);
            if (!seatCandidateMap.has(seat)) seatCandidateMap.set(seat, 0);
            if (candidateName && candidateName !== 'undefined') {
                totalCandidates++;
                seatCandidateMap.set(seat, seatCandidateMap.get(seat) + 1);
            }

            if (zone && zone !== 'undefined') {
                if (!zoneDistrictsMap.has(zone)) zoneDistrictsMap.set(zone, new Map());
                const distMap = zoneDistrictsMap.get(zone);
                if (district && district !== 'undefined') {
                    if (!distMap.has(district)) {
                        distMap.set(district, { seats: new Set(), totalCand: 0 });
                    }
                    const dObj = distMap.get(district);
                    dObj.seats.add(seat);
                    if (candidateName && candidateName !== 'undefined') {
                        dObj.totalCand++;
                    }
                }
            }
        }
    });

    let seatsWith1Plus = 0;
    let seatsWith2Plus = 0;
    let gapSeats = 0;

    seatCandidateMap.forEach(count => {
        if (count >= 1) seatsWith1Plus++;
        if (count >= 2) seatsWith2Plus++;
        if (count === 0) gapSeats++;
    });

    const totalSeatsCount = uniqueSeats.size;
    const overallCompletionPct = totalSeatsCount > 0 ? (((seatsWith1Plus + seatsWith2Plus) / (totalSeatsCount * 2)) * 100).toFixed(2) : '0.00';

    // 1. Top KPI Summary Bar
    reportKpiBar.innerHTML = `
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Total ZP Seats</span>
            <strong class="report-kpi-val">${totalSeatsCount}</strong>
        </div>
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Seats (1+ Cand.)</span>
            <strong class="report-kpi-val text-success">${seatsWith1Plus}</strong>
        </div>
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Seats (2+ Cand.)</span>
            <strong class="report-kpi-val text-warning">${seatsWith2Plus}</strong>
        </div>
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Gap Seats (0 Cand.)</span>
            <strong class="report-kpi-val text-danger">${gapSeats}</strong>
        </div>
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Total Candidates</span>
            <strong class="report-kpi-val text-primary">${totalCandidates}</strong>
        </div>
        <div class="report-kpi-item">
            <span class="report-kpi-lbl">Overall Completion</span>
            <strong class="report-kpi-val text-success">${overallCompletionPct}%</strong>
        </div>
    `;

    // 2. Zone & District Table (Hierarchical numerical summary)
    let zoneDistrictHtml = '';
    const sortedZones = Array.from(zoneDistrictsMap.keys()).sort();

    sortedZones.forEach(zone => {
        const distMap = zoneDistrictsMap.get(zone);
        let zoneTotalSeats = new Set();
        let zoneSeats1Plus = 0;
        let zoneSeats2Plus = 0;
        let zoneGap = 0;
        let zoneTotalCand = 0;

        let districtRowsHtml = '';
        const sortedDistricts = Array.from(distMap.keys()).sort();

        sortedDistricts.forEach(district => {
            const dObj = distMap.get(district);
            let dSeats1Plus = 0;
            let dSeats2Plus = 0;
            let dGap = 0;

            dObj.seats.forEach(s => {
                zoneTotalSeats.add(s);
                const c = seatCandidateMap.get(s) || 0;
                if (c >= 1) dSeats1Plus++;
                if (c >= 2) dSeats2Plus++;
                if (c === 0) dGap++;
            });

            zoneSeats1Plus += dSeats1Plus;
            zoneSeats2Plus += dSeats2Plus;
            zoneGap += dGap;
            zoneTotalCand += dObj.totalCand;

            const dTotalSeats = dObj.seats.size;
            const dCompletionPct = dTotalSeats > 0 ? (((dSeats1Plus + dSeats2Plus) / (dTotalSeats * 2)) * 100).toFixed(2) : '0.00';

            districtRowsHtml += `
                <tr class="report-dist-row">
                    <td class="dist-name-cell">↳ ${district}</td>
                    <td class="num-col">${dTotalSeats}</td>
                    <td class="num-col">${dSeats1Plus}</td>
                    <td class="num-col text-warning font-bold">${dSeats2Plus}</td>
                    <td class="num-col ${dGap > 0 ? 'text-danger font-bold' : 'text-success'}">${dGap}</td>
                    <td class="num-col font-bold">${dObj.totalCand}</td>
                    <td class="num-col font-bold ${parseFloat(dCompletionPct) === 100 ? 'text-success' : ''}">${dCompletionPct}%</td>
                </tr>
            `;
        });

        const zoneSeatsTotal = zoneTotalSeats.size;
        const zoneCompletionPct = zoneSeatsTotal > 0 ? (((zoneSeats1Plus + zoneSeats2Plus) / (zoneSeatsTotal * 2)) * 100).toFixed(2) : '0.00';

        // Zone Header Row
        zoneDistrictHtml += `
            <tr class="report-zone-header-row">
                <td><strong>${zone} Zone (${sortedDistricts.length} Dist.)</strong></td>
                <td class="num-col font-bold">${zoneSeatsTotal}</td>
                <td class="num-col font-bold">${zoneSeats1Plus}</td>
                <td class="num-col font-bold text-warning">${zoneSeats2Plus}</td>
                <td class="num-col font-bold ${zoneGap > 0 ? 'text-danger' : 'text-success'}">${zoneGap}</td>
                <td class="num-col font-bold">${zoneTotalCand}</td>
                <td class="num-col font-bold text-success">${zoneCompletionPct}%</td>
            </tr>
            ${districtRowsHtml}
        `;
    });

    // Grand Total Row
    zoneDistrictHtml += `
        <tr class="report-grand-total-row">
            <td><strong>STATE TOTAL</strong></td>
            <td class="num-col"><strong>${totalSeatsCount}</strong></td>
            <td class="num-col"><strong>${seatsWith1Plus}</strong></td>
            <td class="num-col text-warning"><strong>${seatsWith2Plus}</strong></td>
            <td class="num-col ${gapSeats > 0 ? 'text-danger' : 'text-success'}"><strong>${gapSeats}</strong></td>
            <td class="num-col"><strong>${totalCandidates}</strong></td>
            <td class="num-col text-success"><strong>${overallCompletionPct}%</strong></td>
        </tr>
    `;
    reportZoneDistrictBody.innerHTML = zoneDistrictHtml;

    // 3. Primary Recommendation Sources Calculation & Grouping
    const rawSourceMap = new Map();
    let totalSources = 0;
    data.forEach(row => {
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!candName || candName === 'undefined') return;

        let src = String(row['Recommendation Source Categories'] || '').trim();
        if (!src || src === 'undefined' || src === '-') src = 'Other Source';
        else {
            const lower = src.toLowerCase();
            if (lower.includes('sangathan')) src = 'Sangathan';
            else if (lower.includes('onboard')) src = 'Onboarded';
            else if (lower.includes('runnerup') || lower.includes('runner up') || lower.includes('1st runner') || lower.includes('runner-up')) src = '1st Runner Up';
            else if (lower.includes('incumbent')) src = 'Incumbent ZP';
            else if (lower.includes('acc')) src = 'ACC / Frontals';
            else if (lower.includes('new name') || lower.includes('recommendation')) src = 'Direct Recommendation';
        }

        rawSourceMap.set(src, (rawSourceMap.get(src) || 0) + 1);
        totalSources++;
    });

    const sortedSources = Array.from(rawSourceMap.entries()).sort((a, b) => b[1] - a[1]);
    if (reportSourceBody) {
        reportSourceBody.innerHTML = sortedSources.map(([src, count]) => {
            const pct = totalSources > 0 ? ((count / totalSources) * 100).toFixed(2) : '0.00';
            return `
                <tr>
                    <td><strong>${src}</strong></td>
                    <td class="num-col font-bold">${count}</td>
                    <td class="num-col text-muted">${pct}%</td>
                </tr>
            `;
        }).join('') + `
            <tr class="report-grand-total-row">
                <td><strong>Total</strong></td>
                <td class="num-col"><strong>${totalSources}</strong></td>
                <td class="num-col"><strong>100.00%</strong></td>
            </tr>
        `;
    }
}

// ===========================================
// BIFURCATION: Zone-wise & District-wise
// ===========================================
function renderBifurcation(data) {
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

    // --- Zone-wise ---
    const zoneStats = new Map();
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
        const candidateName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!district || district === 'undefined') return;

        if (!districtStats.has(district)) {
            // Find Chairman & Vice Chairman info for this district (Vice Chairman directly from 'Final Candidate' tab)
            let chairman = String(row['ZP Chairman'] || '').trim();
            let viceChairman = String(row['ZP Vice Chairman'] || '').trim();

            const inc = incumbentMap.get(seat);
            if (inc && inc.chairman && !chairman) chairman = inc.chairman;

            const chInfo = chairmanMap.get(district);
            if (chInfo && chInfo.chairman && !chairman) chairman = chInfo.chairman;

            districtStats.set(district, {
                zone: zone,
                chairman: chairman,
                viceChairman: viceChairman,
                seats: new Set(),
                seatsWithCandidate: new Set(),
                seatsWith2Plus: new Set(),
                totalCandidates: 0
            });
        }
        const d = districtStats.get(district);
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
            <td>${d.chairman ? `<span class="chairman-badge-sm">👑 ${d.chairman}</span>` : '-'}</td>
            <td>${d.viceChairman ? `<span class="vice-chairman-badge-sm">${d.viceChairman}</span>` : '-'}</td>
            <td><strong>${d.seats.size}</strong></td>
            <td><span class="count-badge count-identified">${d.seatsWithCandidate.size}</span></td>
            <td><span class="count-badge count-multi-pill">${d.seatsWith2Plus.size}</span></td>
            <td><span class="gap-badge ${gap > 0 ? 'has-gap' : 'no-gap'}">${gap}</span></td>
            <td><strong>${d.totalCandidates}</strong></td>
        `;
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

// Helper to format party badge class
function getPartyBadgeClass(party) {
    const p = String(party || '').trim().toUpperCase();
    if (p.includes('JSP')) return 'party-jsp';
    if (p.includes('BJP')) return 'party-bjp';
    if (p.includes('RJD')) return 'party-rjd';
    if (p.includes('JDU') || p.includes('JD(U)')) return 'party-jdu';
    if (p.includes('INC') || p.includes('CONGRESS')) return 'party-inc';
    if (p.includes('AIMIM')) return 'party-aimim';
    if (p.includes('LJP')) return 'party-ljp';
    return 'party-default';
}

// ===========================================
// SEAT TABLE: Compact, names only, click to expand
// ===========================================
function renderSeatTable(data) {
    candidateTableBody.innerHTML = '';

    // Active status filter indicator
    const currentStatus = candidateStatusFilter.value;
    const currentInc = incumbentFilter.value;
    let badgeText = '';
    if (currentStatus !== 'All') {
        const labels = {
            'multi': 'Seats with 2+ Candidates',
            'single': 'Seats with 1 Candidate',
            'gap': 'Gap Seats (0 Candidates)'
        };
        badgeText = labels[currentStatus] || '';
    }
    if (currentInc !== 'All') {
        const incLabels = {
            'inFinalList': 'Incumbent in Final List',
            'jsp': 'JSP Leaning Incumbents',
            'otherParty': 'Other Party Incumbents'
        };
        badgeText += (badgeText ? ' + ' : '') + (incLabels[currentInc] || '');
    }

    if (badgeText) {
        activeFilterBadge.textContent = 'Filtered: ' + badgeText;
        activeFilterBadge.style.display = 'inline-block';
    } else {
        activeFilterBadge.style.display = 'none';
    }

    if (data.length === 0) {
        candidateTableBody.innerHTML = '<tr><td colspan="7" class="no-results-cell">No matching ZP seats or candidates found for selected filters</td></tr>';
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
        const seatInfo = rowsForSeat[0];
        const candidateRows = rowsForSeat.filter(row => String(row['Probable ZP Candidate Name']).trim());
        const candCount = candidateRows.length;

        const reservationStatus = String(seatInfo['Seat Reservation Status'] || '').trim();
        const badgeClass = getReservationBadgeClass(reservationStatus);
        const district = String(seatInfo.District || '').trim();
        const block = String(seatInfo.Block || '').trim();

        // Get Incumbent Data
        const inc = incumbentMap.get(seat);
        let incumbentDisplay = '<span class="incumbent-none">-</span>';
        if (inc && inc.incumbentName) {
            const partyClass = getPartyBadgeClass(inc.party);
            const isShortlisted = inc.inFinalList && inc.inFinalList.toLowerCase() !== 'no';
            incumbentDisplay = `
                <div class="incumbent-cell-content" title="Sitting Incumbent (2021)">
                    <div class="inc-name-row">
                        <span class="inc-name">${inc.incumbentName}</span>
                        ${inc.party ? `<span class="party-badge ${partyClass}">${inc.party}</span>` : ''}
                        ${isShortlisted ? `<span class="shortlisted-pill" title="Shortlisted in JSP Final Candidate List">⭐ Shortlisted</span>` : ''}
                    </div>
                    ${inc.meetingStatus && inc.meetingStatus !== 'NA' ? `<span class="inc-status-tag status-${inc.meetingStatus.toLowerCase().replace(/\s+/g, '-')}">${inc.meetingStatus}</span>` : ''}
                </div>
            `;
        }

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
            <td class="incumbent-td">${incumbentDisplay}</td>
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

    if (idx >= candidateRows.length && candidateRows.length > 0) return;

    const row = candidateRows[idx] || {};
    const seatInfo = rowsForSeat[0] || {};
    const inc = incumbentMap.get(seatNum);

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
    const zone = row['Zone'] || seatInfo['Zone'] || '-';
    const district = row['District'] || seatInfo['District'] || '-';
    const pc = row['PC'] || seatInfo['PC'] || '-';
    const ac = row['AC'] || seatInfo['AC'] || '-';
    const block = row['Block'] || seatInfo['Block'] || '-';
    const badgeClass = getReservationBadgeClass(reservation);

    // Leadership info (Vice Chairman directly from 'Final Candidate' tab)
    let chairman = String(seatInfo['ZP Chairman'] || row['ZP Chairman'] || '').trim();
    let viceChairman = String(seatInfo['ZP Vice Chairman'] || row['ZP Vice Chairman'] || '').trim();
    if (inc && inc.chairman && !chairman) chairman = inc.chairman;
    const chInfo = chairmanMap.get(district);
    if (chInfo && chInfo.chairman && !chairman) chairman = chInfo.chairman;

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

        <!-- Candidate Details Grid -->
        <div class="modal-section-title">Probable Candidate Information</div>
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

        <!-- Location Breadcrumb -->
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

        <!-- Sitting Incumbent ZP Card -->
        ${inc && inc.incumbentName ? `
        <div class="modal-incumbent-card">
            <div class="modal-incumbent-header">
                <div class="inc-title-badge">👑 Sitting Incumbent ZP (2021)</div>
                ${inc.party ? `<span class="party-badge ${getPartyBadgeClass(inc.party)}">${inc.party}</span>` : ''}
                ${inc.inFinalList && inc.inFinalList.toLowerCase() !== 'no' ? `<span class="shortlisted-pill">⭐ Shortlisted in Final Candidates</span>` : ''}
            </div>
            <div class="modal-incumbent-body">
                <div class="inc-detail-row">
                    <span class="inc-label">Incumbent Name:</span>
                    <strong class="inc-val">${inc.incumbentName}</strong>
                </div>
                ${inc.incumbentNumber ? `
                <div class="inc-detail-row">
                    <span class="inc-label">Contact:</span>
                    <span class="inc-val">${inc.incumbentNumber}</span>
                </div>` : ''}
                ${inc.callingStatus ? `
                <div class="inc-detail-row">
                    <span class="inc-label">Calling Status:</span>
                    <span class="inc-status-tag status-${inc.callingStatus.toLowerCase().replace(/\s+/g, '-')}">${inc.callingStatus}</span>
                </div>` : ''}
                ${inc.meetingStatus ? `
                <div class="inc-detail-row">
                    <span class="inc-label">PK Meeting Status:</span>
                    <span class="inc-status-tag status-${inc.meetingStatus.toLowerCase().replace(/\s+/g, '-')}">${inc.meetingStatus}</span>
                </div>` : ''}
                ${inc.wantContestJSP ? `
                <div class="inc-detail-row">
                    <span class="inc-label">Want Contest with JSP:</span>
                    <span class="inc-val font-semibold">${inc.wantContestJSP}</span>
                </div>` : ''}
                ${inc.onboardingStatus ? `
                <div class="inc-detail-row">
                    <span class="inc-label">Onboarding Status:</span>
                    <span class="inc-val">${inc.onboardingStatus}</span>
                </div>` : ''}
                ${inc.currentReservation ? `
                <div class="inc-detail-row">
                    <span class="inc-label">Reservation (Current / Probable):</span>
                    <span class="inc-val">${inc.currentReservation} ${inc.probableReservation ? `➔ ${inc.probableReservation}` : ''}</span>
                </div>` : ''}
                ${inc.runnerupName ? `
                <div class="inc-detail-row runnerup-row">
                    <span class="inc-label">🥈 Runner-up ZP:</span>
                    <span class="inc-val">${inc.runnerupName} ${inc.runnerupNumber ? `(${inc.runnerupNumber})` : ''}</span>
                </div>` : ''}
                ${inc.remarks ? `
                <div class="inc-detail-row remarks-sub">
                    <span class="inc-label">Incumbent Remarks:</span>
                    <span class="inc-val">${inc.remarks}</span>
                </div>` : ''}
            </div>
        </div>
        ` : ''}

        <!-- District Leadership Card -->
        ${(chairman || viceChairman) ? `
        <div class="modal-leadership-bar">
            ${chairman ? `
            <div class="lead-item">
                <span class="lead-icon">🏛️</span>
                <div>
                    <span class="lead-label">District ZP Chairman</span>
                    <span class="lead-name">👑 ${chairman}</span>
                </div>
            </div>` : ''}
            ${viceChairman ? `
            <div class="lead-item">
                <span class="lead-icon">🎖️</span>
                <div>
                    <span class="lead-label">ZP Vice Chairman</span>
                    <span class="lead-name">${viceChairman}</span>
                </div>
            </div>` : ''}
        </div>
        ` : ''}

        <!-- Profile Section -->
        <div class="modal-profile-section">
            <span class="detail-label">Candidate Brief Profile</span>
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
