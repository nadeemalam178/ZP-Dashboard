const GOOGLE_SHEET_URLS = [
    { id: 'sheet1', name: 'Sheet 1 (Champaran, Saran, Sahabad)', url: 'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx' },
    { id: 'sheet2', name: 'Sheet 2 (Samastipur, Tirhut, Mithilanchal)', url: 'https://docs.google.com/spreadsheets/d/1ebxTaRpQOgCNWm2mpwk4qSviNiM4c_HAZX-xuiumlYA/export?format=xlsx' }
];

let candidatesData = [];
let incumbentMap = new Map(); // seat -> incumbent object
let chairmanMap = new Map();  // district -> chairman object
let runnerUpMap = new Map();  // seat -> runner up object
let pkData = [];
let allSeatNumbers = [];

// Multi-Select Instances
let msCandidateStatus, msIncumbent, msZone, msDistrict, msPC, msAC, msBlock, msReservation;

// DOM Elements
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

// Track separated search states & fullscreen/density modes
let selectedSeatNumber = '';    // Left pane only: specific ZP Seat Number (e.g. "Raxaul_1")
let universalSearchQuery = '';   // Middle top header only: universal query across all entities
let isFullscreenTableMode = false;
let isDetailedProfileView = false;

// Table Fullscreen & Density Elements
const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');
const seatDirectorySection = document.getElementById('seatDirectorySection');
const btnCompactView = document.getElementById('btnCompactView');
const btnDetailedView = document.getElementById('btnDetailedView');
const tableHeaderHint = document.getElementById('tableHeaderHint');

/**
 * =========================================================
 * CUSTOM MULTI-SELECT DROPDOWN COMPONENT
 * =========================================================
 */
class MultiSelect {
    constructor(containerId, placeholder, badgeId) {
        this.container = document.getElementById(containerId);
        this.badge = badgeId ? document.getElementById(badgeId) : null;
        this.placeholder = placeholder || 'All';
        this.options = []; // [{ value, label, count }]
        this.selected = new Set();
        this.searchQuery = '';
        this.isOpen = false;
        this.onChange = null;
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
        this.bindEvents();
    }

    setOptions(options, preserveSelection = true) {
        this.options = options || [];
        if (preserveSelection) {
            const validVals = new Set(this.options.map(o => o.value));
            this.selected = new Set([...this.selected].filter(v => validVals.has(v)));
        } else {
            this.selected.clear();
        }
        this.render();
    }

    setSelected(values) {
        this.selected = new Set(values || []);
        this.render();
    }

    getSelected() {
        return Array.from(this.selected);
    }

    clear(silent = false) {
        this.selected.clear();
        this.render();
        if (!silent && this.onChange) this.onChange(this.getSelected());
    }

    render() {
        if (!this.container) return;
        const selectedArr = this.getSelected();
        const hasSelection = selectedArr.length > 0;
        
        // Update count badge
        if (this.badge) {
            if (hasSelection) {
                this.badge.textContent = selectedArr.length;
                this.badge.style.display = 'inline-block';
            } else {
                this.badge.style.display = 'none';
            }
        }

        let triggerText = this.placeholder;
        if (hasSelection) {
            if (selectedArr.length === 1) {
                const opt = this.options.find(o => o.value === selectedArr[0]);
                triggerText = opt ? opt.label : selectedArr[0];
            } else if (selectedArr.length === this.options.length && this.options.length > 0) {
                triggerText = `All (${selectedArr.length} Selected)`;
            } else {
                triggerText = `${selectedArr.length} Selected`;
            }
        }

        const filteredOptions = this.options.filter(o => {
            if (!this.searchQuery) return true;
            return String(o.label).toLowerCase().includes(this.searchQuery.toLowerCase());
        });

        this.container.className = `multi-select-dropdown ${this.isOpen ? 'open' : ''} ${hasSelection ? 'has-selection' : ''}`;
        
        this.container.innerHTML = `
            <div class="ms-trigger">
                <span class="ms-trigger-text ${hasSelection ? 'active-val' : 'placeholder'}">${this.escapeHtml(triggerText)}</span>
                <div class="ms-trigger-icons">
                    <button class="ms-clear-btn" title="Clear selection" type="button">&times;</button>
                    <svg class="ms-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="ms-menu">
                ${this.options.length > 6 ? `
                <div class="ms-search-wrapper">
                    <input type="text" class="ms-search-input" placeholder="Search options..." value="${this.escapeHtml(this.searchQuery)}" />
                </div>` : ''}
                <div class="ms-quick-actions">
                    <button type="button" class="ms-quick-btn ms-select-all">Select All</button>
                    <button type="button" class="ms-quick-btn ms-clear-all">Clear</button>
                </div>
                <ul class="ms-options-list">
                    ${filteredOptions.length > 0 ? filteredOptions.map(opt => {
                        const isChecked = this.selected.has(opt.value);
                        return `
                            <li class="ms-option-item ${isChecked ? 'selected' : ''}" data-value="${this.escapeHtml(opt.value)}">
                                <input type="checkbox" class="ms-checkbox" ${isChecked ? 'checked' : ''} />
                                <span class="ms-option-label">${this.escapeHtml(opt.label)}</span>
                                ${opt.count !== undefined ? `<span class="ms-option-count">${opt.count}</span>` : ''}
                            </li>
                        `;
                    }).join('') : '<li class="ms-empty-state">No matching options</li>'}
                </ul>
            </div>
        `;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    bindEvents() {
        if (!this.container) return;

        this.container.addEventListener('click', (e) => {
            const clearBtn = e.target.closest('.ms-clear-btn');
            if (clearBtn) {
                e.stopPropagation();
                this.clear();
                return;
            }

            const trigger = e.target.closest('.ms-trigger');
            if (trigger) {
                e.stopPropagation();
                this.toggleOpen();
                return;
            }

            const selectAllBtn = e.target.closest('.ms-select-all');
            if (selectAllBtn) {
                e.stopPropagation();
                this.options.forEach(o => this.selected.add(o.value));
                this.render();
                if (this.onChange) this.onChange(this.getSelected());
                return;
            }

            const clearAllBtn = e.target.closest('.ms-clear-all');
            if (clearAllBtn) {
                e.stopPropagation();
                this.clear();
                return;
            }

            const optionItem = e.target.closest('.ms-option-item');
            if (optionItem) {
                e.stopPropagation();
                const val = optionItem.dataset.value;
                if (this.selected.has(val)) {
                    this.selected.delete(val);
                } else {
                    this.selected.add(val);
                }
                this.render();
                if (this.onChange) this.onChange(this.getSelected());
                return;
            }
        });

        this.container.addEventListener('input', (e) => {
            const searchInput = e.target.closest('.ms-search-input');
            if (searchInput) {
                this.searchQuery = searchInput.value;
                const filtered = this.options.filter(o => !this.searchQuery || String(o.label).toLowerCase().includes(this.searchQuery.toLowerCase()));
                const list = this.container.querySelector('.ms-options-list');
                if (list) {
                    list.innerHTML = filtered.length > 0 ? filtered.map(opt => {
                        const isChecked = this.selected.has(opt.value);
                        return `
                            <li class="ms-option-item ${isChecked ? 'selected' : ''}" data-value="${this.escapeHtml(opt.value)}">
                                <input type="checkbox" class="ms-checkbox" ${isChecked ? 'checked' : ''} />
                                <span class="ms-option-label">${this.escapeHtml(opt.label)}</span>
                                ${opt.count !== undefined ? `<span class="ms-option-count">${opt.count}</span>` : ''}
                            </li>
                        `;
                    }).join('') : '<li class="ms-empty-state">No matching options</li>';
                }
            }
        });
    }

    toggleOpen() {
        const willOpen = !this.isOpen;
        document.querySelectorAll('.multi-select-dropdown.open').forEach(el => {
            if (el !== this.container) el.classList.remove('open');
        });
        this.isOpen = willOpen;
        this.container.classList.toggle('open', willOpen);
        if (willOpen) {
            const input = this.container.querySelector('.ms-search-input');
            if (input) setTimeout(() => input.focus(), 50);
        }
    }
}

// Close all multi-selects on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select-dropdown')) {
        document.querySelectorAll('.multi-select-dropdown.open').forEach(el => el.classList.remove('open'));
    }
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initMultiSelectFilters();
    loadData(false);
});

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadData(true));
}

function initMultiSelectFilters() {
    msCandidateStatus = new MultiSelect('msCandidateStatus', 'All Statuses', 'badgeCandidateStatus');
    msCandidateStatus.setOptions([
        { value: 'multi', label: '2+ Candidates (Multi)' },
        { value: 'single', label: '1 Candidate (Single)' },
        { value: 'gap', label: '0 Candidates (Gap)' }
    ]);
    msCandidateStatus.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        updateActiveKPICard();
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msIncumbent = new MultiSelect('msIncumbent', 'All Incumbents', 'badgeIncumbent');
    msIncumbent.setOptions([
        { value: 'inFinalList', label: '⭐ In Final Candidate List' },
        { value: 'jsp', label: 'JSP Leaning / Ready to Meet' },
        { value: 'otherParty', label: 'Other Parties (BJP/RJD/JDU)' }
    ]);
    msIncumbent.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msZone = new MultiSelect('msZone', 'All Zones', 'badgeZone');
    msZone.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        updateFilters('zone');
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msDistrict = new MultiSelect('msDistrict', 'All Districts', 'badgeDistrict');
    msDistrict.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        updateFilters('district');
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msPC = new MultiSelect('msPC', 'All PCs', 'badgePC');
    msPC.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        updateFilters('pc');
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msAC = new MultiSelect('msAC', 'All ACs', 'badgeAC');
    msAC.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        updateFilters('ac');
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msBlock = new MultiSelect('msBlock', 'All Blocks', 'badgeBlock');
    msBlock.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        renderDashboard();
        autoDismissMobileDrawer();
    };

    msReservation = new MultiSelect('msReservation', 'All Reservations', 'badgeReservation');
    msReservation.onChange = () => {
        selectedSeatNumber = '';
        if (seatSearch) seatSearch.value = '';
        renderDashboard();
        autoDismissMobileDrawer();
    };
}

/**
 * Data Loader: Strictly fetches both live Google Sheets in parallel over the network.
 */
async function loadData(forceReload = false) {
    loadingIndicator.classList.add('show');
    const syncBadge = document.getElementById('syncStatusBadge');
    try {
        let liveSuccessCount = 0;
        candidatesData = [];
        incumbentMap.clear();
        chairmanMap.clear();
        runnerUpMap.clear();
        pkData = [];

        // Fetch both Google Sheets live in real-time
        const fetchPromises = GOOGLE_SHEET_URLS.map(async (sheet) => {
            const liveUrl = `${sheet.url}&_nocache=${Date.now()}`;
            const resp = await fetch(liveUrl, { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status} on ${sheet.name}`);
            const arrayBuffer = await resp.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            parseWorkbook(workbook, sheet.name);
            liveSuccessCount++;
        });

        await Promise.allSettled(fetchPromises);

        if (candidatesData.length === 0) {
            throw new Error("Unable to connect to Google Sheets. Please verify your internet connection.");
        }

        // Update Sync Status Badge
        if (syncBadge) {
            syncBadge.innerHTML = `● Live Connected: ${candidatesData.length} Candidates (All 6 Zones)`;
            syncBadge.classList.remove('offline');
        }

        populateIncumbentsFromCandidates();

        allSeatNumbers = getUniqueValues(candidatesData, 'ZP Seat Number');
        populateInitialFilters();
        updateActiveKPICard();
        renderDashboard();
    } catch (error) {
        console.error("Error loading live Google Sheets:", error);
        if (syncBadge) {
            syncBadge.innerHTML = '⚠️ Sync Failed (Check Network)';
            syncBadge.classList.add('offline');
        }
        alert(`Google Sheets Live Sync Error:\n${error.message}\n\nPlease click "Sync Live Google Sheets" to retry.`);
    } finally {
        loadingIndicator.classList.remove('show');
    }
}

/**
 * Parses an XLSX workbook directly from Google Sheets.
 */
function parseWorkbook(workbook, sourceName = 'Google Sheet') {
    // 1. Final Candidate Sheet
    const finalCandidateSheet = workbook.Sheets['Final Candidate'] || workbook.Sheets['final_candidate'] || workbook.Sheets[workbook.SheetNames[0]];
    if (finalCandidateSheet) {
        const rows = XLSX.utils.sheet_to_json(finalCandidateSheet, { defval: '' });
        if (rows.length > 0) {
            mergeCandidateRows(rows);
        }
    }

    // 2. Incumbent ZP Sheet
    const incumbentSheet = workbook.Sheets['Incumbent ZP'] || workbook.Sheets['incumbent'];
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
                    meetingStatus: String(row['PK Meeting Status'] || row['PK Meeting Status.1'] || '').trim(),
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

    // 3. Runner Up Sheet
    const runnerUpSheet = workbook.Sheets['Runner Up'] || workbook.Sheets['runner_up'];
    if (runnerUpSheet) {
        const runnerUpRows = XLSX.utils.sheet_to_json(runnerUpSheet, { defval: '' });
        runnerUpRows.forEach(row => {
            const seat = String(row['ZP Seat Number'] || '').trim();
            if (seat && seat !== 'undefined') {
                runnerUpMap.set(seat, {
                    name: String(row['Runnerup ZP Name'] || '').trim(),
                    contact: String(row['Runnerup ZP Number'] || '').trim(),
                    party: String(row['Current Party Inclination'] || '').trim(),
                    votes: String(row['Secured Votes '] || row['Secured Votes'] || '').trim(),
                    wantContestJSP: String(row['Want To Contest With JSP '] || row['Want To Contest With JSP'] || '').trim(),
                    meetingStatus: String(row['PK Meeting Status'] || '').trim(),
                    remarks: String(row['Remark'] || row['Remarks'] || '').trim()
                });

                if (incumbentMap.has(seat)) {
                    const inc = incumbentMap.get(seat);
                    if (!inc.runnerupName) inc.runnerupName = String(row['Runnerup ZP Name'] || '').trim();
                    if (!inc.runnerupNumber) inc.runnerupNumber = String(row['Runnerup ZP Number'] || '').trim();
                }
            }
        });
    }

    // 4. ZP Chairman Sheet
    const chairmanSheet = workbook.Sheets['ZP Chairman'] || workbook.Sheets['chairman'];
    if (chairmanSheet) {
        let chairmanRows = XLSX.utils.sheet_to_json(chairmanSheet, { range: 1, defval: '' });
        if (!chairmanRows[0] || !chairmanRows[0]['District']) {
            chairmanRows = XLSX.utils.sheet_to_json(chairmanSheet, { defval: '' });
        }
        chairmanRows.forEach(row => {
            const dist = String(row['District'] || row['District Name'] || row['Seat Details'] || '').trim();
            if (dist && dist !== 'undefined' && dist !== 'District') {
                chairmanMap.set(dist, {
                    district: dist,
                    chairman: String(row['District ZP Chairman'] || row['Chairman Name'] || row['Incumbent Chairman'] || row['ZP Chairman'] || '').trim(),
                    party: String(row['Party'] || row['Party Inclination'] || '').trim(),
                    viceChairman: String(row['Vice Chairman'] || row['ZP Vice Chairman'] || '').trim(),
                    profile: String(row['Profile'] || row['Brief Profile'] || '').trim()
                });
            }
        });
    }

    // 5. Gap Report / PK Review Report
    const gapSheet = workbook.Sheets['Gap Report'] || workbook.Sheets['PK Review Report'] || workbook.Sheets['pk_review_report'] || workbook.Sheets['gap_report'];
    if (gapSheet) {
        let parsed = XLSX.utils.sheet_to_json(gapSheet, { defval: '' });
        if (parsed.length > 0 && !parsed[0]['Number of ZP Seats'] && !parsed[0]['Zone']) {
            parsed = XLSX.utils.sheet_to_json(gapSheet, { range: 1, defval: '' });
        }
        if (parsed.length > 0) {
            pkData = [...pkData, ...parsed];
        }
    }
}

/**
 * Merges candidate rows without duplicates based on Seat + Candidate Name.
 */
function mergeCandidateRows(newRows) {
    if (!candidatesData || candidatesData.length === 0) {
        candidatesData = [...newRows];
        return newRows.length;
    }
    const existing = new Set(candidatesData.map(r => `${String(r['ZP Seat Number']).trim()}_${String(r['Probable ZP Candidate Name']).trim()}`));
    let count = 0;
    newRows.forEach(row => {
        const key = `${String(row['ZP Seat Number']).trim()}_${String(row['Probable ZP Candidate Name']).trim()}`;
        if (!existing.has(key)) {
            candidatesData.push(row);
            existing.add(key);
            count++;
        }
    });
    return count;
}

/**
 * Auto-populates Incumbents from candidate data if not loaded separately.
 */
function populateIncumbentsFromCandidates() {
    candidatesData.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        const recSource = String(row['Recommendation Source Categories'] || '').trim();
        const profile = String(row['Brief Profile'] || '').trim();
        const remarks = String(row['Remarks'] || '').trim();

        if (seat && !incumbentMap.has(seat)) {
            if (recSource.toLowerCase().includes('incumbent') || profile.toLowerCase().includes('incumbent')) {
                incumbentMap.set(seat, {
                    district: String(row['District'] || '').trim(),
                    pc: String(row['PC'] || '').trim(),
                    ac: String(row['AC'] || '').trim(),
                    block: String(row['Block'] || '').trim(),
                    panchayat: '',
                    seatNumber: seat,
                    chairman: '',
                    viceChairman: '',
                    incumbentName: candName,
                    inFinalList: 'Yes',
                    incumbentNumber: String(row['Contact No'] || '').trim(),
                    currentReservation: String(row['Seat Reservation Status'] || '').trim(),
                    probableReservation: '',
                    party: profile.includes('JSP') ? 'JSP Leaning' : (recSource || 'Incumbent'),
                    callingStatus: '',
                    meetingStatus: profile.includes('JSP') ? 'Ready to Meet' : '',
                    wantContestJSP: '',
                    onboardingStatus: String(row['JS Designation'] || '').trim(),
                    meetingDate: '',
                    remarks: remarks,
                    runnerupName: '',
                    runnerupNumber: ''
                });
            }
        }
    });
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

// Modal close & Escape key
modalClose.addEventListener('click', () => candidateModal.classList.remove('show'));
candidateModal.addEventListener('click', (e) => {
    if (e.target === candidateModal) candidateModal.classList.remove('show');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isFullscreenTableMode) {
            toggleFullscreenTableMode(false);
        } else if (candidateModal.classList.contains('show')) {
            candidateModal.classList.remove('show');
        }
    }
});

// Fullscreen & Density Toggle Listeners
if (toggleFullscreenBtn) {
    toggleFullscreenBtn.addEventListener('click', () => {
        toggleFullscreenTableMode();
    });
}

function toggleFullscreenTableMode(forceState = null) {
    isFullscreenTableMode = forceState !== null ? forceState : !isFullscreenTableMode;
    
    if (seatDirectorySection) {
        seatDirectorySection.classList.toggle('fullscreen-mode', isFullscreenTableMode);
    }
    document.body.classList.toggle('table-fullscreen-active', isFullscreenTableMode);

    if (toggleFullscreenBtn) {
        toggleFullscreenBtn.classList.toggle('active', isFullscreenTableMode);
        const expandIcon = toggleFullscreenBtn.querySelector('.fs-expand-icon');
        const compressIcon = toggleFullscreenBtn.querySelector('.fs-compress-icon');
        const label = toggleFullscreenBtn.querySelector('.fs-btn-label');
        if (expandIcon) expandIcon.style.display = isFullscreenTableMode ? 'none' : 'inline-block';
        if (compressIcon) compressIcon.style.display = isFullscreenTableMode ? 'inline-block' : 'none';
        if (label) label.textContent = isFullscreenTableMode ? '✕ Exit Fullscreen' : 'Expand Fullscreen / विस्तार';
    }

    // When entering fullscreen, automatically switch to Full Profiles view if not already
    if (isFullscreenTableMode) {
        setProfileDensity(true);
    } else {
        renderSeatTable(getFilteredCandidates(true));
    }
}

if (btnCompactView && btnDetailedView) {
    btnCompactView.addEventListener('click', () => setProfileDensity(false));
    btnDetailedView.addEventListener('click', () => setProfileDensity(true));
}

function setProfileDensity(detailed) {
    isDetailedProfileView = detailed;
    if (btnCompactView) btnCompactView.classList.toggle('active', !detailed);
    if (btnDetailedView) btnDetailedView.classList.toggle('active', detailed);
    if (tableHeaderHint) {
        tableHeaderHint.textContent = detailed ? '(Showing complete candidate profiles & contacts)' : '(Click name for full profile)';
    }
    renderSeatTable(getFilteredCandidates(true));
}

const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarElement = document.querySelector('.sidebar');

function openMobileSidebar() {
    if (sidebarElement) sidebarElement.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
    if (mobileFilterToggle) mobileFilterToggle.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent background scroll when drawer is open
}

function closeMobileSidebar() {
    if (sidebarElement) sidebarElement.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
    if (mobileFilterToggle) mobileFilterToggle.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileFilterToggle) {
    mobileFilterToggle.addEventListener('click', () => {
        if (sidebarElement && sidebarElement.classList.contains('mobile-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    });
}

if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
}

// Auto-close mobile drawer on filter selection if screen is small
function autoDismissMobileDrawer() {
    if (window.innerWidth <= 900) {
        closeMobileSidebar();
    }
}

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
        resetAllFilters();
        autoDismissMobileDrawer();
    });
}

function resetAllFilters() {
    selectedSeatNumber = '';
    universalSearchQuery = '';

    if (seatSearch) {
        seatSearch.value = '';
        const wrapper = seatSearch.closest('.search-input-wrapper');
        if (wrapper) wrapper.classList.remove('has-value');
    }
    if (seatSuggestions) seatSuggestions.classList.remove('show');

    if (topUniversalSearch) {
        topUniversalSearch.value = '';
        const box = topUniversalSearch.closest('.universal-search-box');
        if (box) box.classList.remove('has-value');
    }
    if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');

    if (msCandidateStatus) msCandidateStatus.clear(true);
    if (msIncumbent) msIncumbent.clear(true);
    if (msZone) msZone.clear(true);
    if (msDistrict) msDistrict.clear(true);
    if (msPC) msPC.clear(true);
    if (msAC) msAC.clear(true);
    if (msBlock) msBlock.clear(true);
    if (msReservation) msReservation.clear(true);

    updateFilters('zone', true);
    updateActiveKPICard();
    renderDashboard();
}

// Interactive KPI Card Clicks
cardTotalSeats.addEventListener('click', () => {
    if (msCandidateStatus) msCandidateStatus.clear();
    updateActiveKPICard();
    renderDashboard();
});

cardSeatsIdentified.addEventListener('click', () => {
    if (msCandidateStatus) {
        const cur = msCandidateStatus.getSelected();
        if (cur.includes('single') || cur.includes('multi')) {
            msCandidateStatus.clear();
        } else {
            msCandidateStatus.setSelected(['single', 'multi']);
        }
    }
    updateActiveKPICard();
    renderDashboard();
});

cardMultiCandidates.addEventListener('click', () => {
    if (msCandidateStatus) {
        const cur = msCandidateStatus.getSelected();
        if (cur.includes('multi') && cur.length === 1) {
            msCandidateStatus.clear();
        } else {
            msCandidateStatus.setSelected(['multi']);
        }
    }
    updateActiveKPICard();
    renderDashboard();
});

cardGapSeats.addEventListener('click', () => {
    if (msCandidateStatus) {
        const cur = msCandidateStatus.getSelected();
        if (cur.includes('gap') && cur.length === 1) {
            msCandidateStatus.clear();
        } else {
            msCandidateStatus.setSelected(['gap']);
        }
    }
    updateActiveKPICard();
    renderDashboard();
});

function updateActiveKPICard() {
    if (!msCandidateStatus) return;
    const selected = msCandidateStatus.getSelected();
    cardTotalSeats.classList.toggle('active-kpi', selected.length === 0);
    cardMultiCandidates.classList.toggle('active-kpi', selected.length === 1 && selected.includes('multi'));
    cardGapSeats.classList.toggle('active-kpi', selected.length === 1 && selected.includes('gap'));
    cardSeatsIdentified.classList.toggle('active-kpi', selected.includes('single'));
}

// --- UNIVERSAL SEARCH ENGINE (English / Hindi / Devanagari) ---
const topUniversalSearch = document.getElementById('topUniversalSearch');
const universalSearchDropdown = document.getElementById('universalSearchDropdown');
const clearTopSearch = document.getElementById('clearTopSearch');

// Hindi (Devanagari) to Latin transliteration mapping
const DEVANAGARI_MAP = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', '्': '',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy', 'श्र': 'shr',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f'
};

// Common political & geographical synonyms between Hindi and English
const HINDI_SYNONYMS = {
    'भाजपा': 'bjp', 'भाजपा ': 'bjp',
    'राजद': 'rjd', 'जदयू': 'jdu', 'कांग्रेस': 'congress',
    'जन सुराज': 'jsp', 'जनसुराज': 'jsp', 'माले': 'cpiml', 'लोजपा': 'ljp',
    'पूर्वी चंपारण': 'east champaran', 'मोतिहारी': 'motihari', 'बेतिया': 'bettiah',
    'पश्चिमी चंपारण': 'west champaran', 'मुजफ्फरपुर': 'muzaffarpur', 'सीतामढ़ी': 'sitamarhi',
    'शिवहर': 'sheohar', 'वैशाली': 'vaishali', 'हाजीपुर': 'hajipur', 'सीवान': 'siwan',
    'सारण': 'saran', 'छपरा': 'chhapra', 'गोपालगंज': 'gopalganj', 'दरभंगा': 'darbhanga',
    'मधुबनी': 'madhubani', 'समस्तीपुर': 'samastipur', 'रोहतास': 'rohtas', 'सासाराम': 'sasaram',
    'कैमूर': 'kaimur', 'भभुआ': 'bhabhua', 'बक्सर': 'buxar', 'भोजपुर': 'bhojpur', 'आरा': 'arrah',
    'अध्यक्ष': 'chairman', 'उपाध्यक्ष': 'vice chairman', 'निवर्तमान': 'incumbent',
    'उम्मीदवार': 'candidate', 'महिला': 'female', 'अनारक्षित': 'unreserved', 'पिछड़ा': 'bc',
    'अति पिछड़ा': 'ebc', 'अनुसूचित जाति': 'sc', 'अनुसूचित जनजाति': 'st'
};

function transliterateHindi(text) {
    if (!text) return '';
    let str = String(text).trim().toLowerCase();
    for (const [hi, en] of Object.entries(HINDI_SYNONYMS)) {
        if (str.includes(hi)) {
            str = str.replaceAll(hi, en);
        }
    }
    let res = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (DEVANAGARI_MAP[ch] !== undefined) {
            res += DEVANAGARI_MAP[ch];
        } else {
            res += ch;
        }
    }
    return res.toLowerCase().replace(/[^a-z0-9\s_]/g, '');
}

function normalizeSearch(str) {
    if (!str) return '';
    return String(str).toLowerCase().trim().replace(/[^a-z0-9\s_]/g, '');
}

function highlightMatch(text, query) {
    if (!text || !query) return text || '';
    const str = String(text);
    const idx = str.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return str;
    const before = str.substring(0, idx);
    const match = str.substring(idx, idx + query.length);
    const after = str.substring(idx + query.length);
    return `${before}<span class="us-highlight">${match}</span>${after}`;
}

/**
 * Checks if a candidate row matches universal search in ANY field (English/Hindi).
 */
function rowMatchesUniversalQuery(row, rawQuery, translitQuery) {
    if (!rawQuery && !translitQuery) return true;
    
    // 1. Direct candidate row fields
    const directFields = [
        row['ZP Seat Number'],
        row['Probable ZP Candidate Name'],
        row['Contact No'],
        row['Brief Profile'],
        row['Remarks'],
        row['Recommendation Source Categories'],
        row['JS Designation'],
        row['Seat Reservation Status'],
        row['Block'],
        row['AC'],
        row['PC'],
        row['District'],
        row['Zone']
    ];

    for (const f of directFields) {
        if (!f) continue;
        const norm = normalizeSearch(f);
        if (norm.includes(rawQuery) || (translitQuery && norm.includes(translitQuery))) {
            return true;
        }
    }

    // 2. Incumbent info
    const seat = String(row['ZP Seat Number'] || '').trim();
    const inc = incumbentMap.get(seat);
    if (inc) {
        const incFields = [
            inc.incumbentName,
            inc.incumbentNumber,
            inc.party,
            inc.chairman,
            inc.viceChairman,
            inc.runnerupName,
            inc.runnerupNumber,
            inc.remarks
        ];
        for (const f of incFields) {
            if (!f) continue;
            const norm = normalizeSearch(f);
            if (norm.includes(rawQuery) || (translitQuery && norm.includes(translitQuery))) {
                return true;
            }
        }
    }

    // 3. District Chairman info
    const dist = String(row['District'] || '').trim();
    const ch = chairmanMap.get(dist);
    if (ch) {
        const chFields = [ch.chairman, ch.viceChairman, ch.party, ch.profile];
        for (const f of chFields) {
            if (!f) continue;
            const norm = normalizeSearch(f);
            if (norm.includes(rawQuery) || (translitQuery && norm.includes(translitQuery))) {
                return true;
            }
        }
    }

    // 4. Runner Up
    const ru = runnerUpMap.get(seat);
    if (ru) {
        const ruFields = [ru.name, ru.contact, ru.party, ru.remarks];
        for (const f of ruFields) {
            if (!f) continue;
            const norm = normalizeSearch(f);
            if (norm.includes(rawQuery) || (translitQuery && norm.includes(translitQuery))) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Builds categorized real-time suggestion list for Universal Search.
 */
function buildUniversalSuggestions(query) {
    if (!query) return null;
    const rawQ = normalizeSearch(query);
    const translitQ = transliterateHindi(query);

    const matchCandidate = [];
    const matchChairman = [];
    const matchIncumbent = [];
    const matchSeat = [];
    const seenSeats = new Set();
    const seenCandidates = new Set();
    const seenChairmen = new Set();

    // Scan all candidate rows
    candidatesData.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const name = String(row['Probable ZP Candidate Name'] || '').trim();
        const dist = String(row['District'] || '').trim();
        const zone = String(row['Zone'] || '').trim();
        const phone = String(row['Contact No'] || '').trim();
        const profile = String(row['Brief Profile'] || '').trim();
        const block = String(row['Block'] || '').trim();
        const ac = String(row['AC'] || '').trim();

        // 1. Candidate Name match
        if (name && !seenCandidates.has(`${seat}_${name}`)) {
            const normName = normalizeSearch(name);
            const normPhone = normalizeSearch(phone);
            const normProfile = normalizeSearch(profile);
            if (normName.includes(rawQ) || (translitQ && normName.includes(translitQ)) || normPhone.includes(rawQ) || normProfile.includes(rawQ)) {
                seenCandidates.add(`${seat}_${name}`);
                matchCandidate.push({
                    type: 'candidate',
                    title: name,
                    subtitle: `${seat} • ${dist} (${zone}) ${phone ? '• 📞 ' + phone : ''}`,
                    seat: seat,
                    candidateRow: row
                });
            }
        }

        // 2. Seat / Block / AC match
        if (seat && !seenSeats.has(seat)) {
            const normSeat = normalizeSearch(seat);
            const normBlock = normalizeSearch(block);
            const normAC = normalizeSearch(ac);
            const normDist = normalizeSearch(dist);
            const normZone = normalizeSearch(zone);

            if (normSeat.includes(rawQ) || normBlock.includes(rawQ) || normAC.includes(rawQ) || normDist.includes(rawQ) || normZone.includes(rawQ) ||
                (translitQ && (normSeat.includes(translitQ) || normBlock.includes(translitQ) || normDist.includes(translitQ) || normZone.includes(translitQ)))) {
                seenSeats.add(seat);
                matchSeat.push({
                    type: 'seat',
                    title: seat,
                    subtitle: `${block ? block + ', ' : ''}${ac ? ac + ', ' : ''}${dist} (${zone})`,
                    seat: seat
                });
            }
        }
    });

    // Scan Chairmen
    chairmanMap.forEach((ch, dist) => {
        if (!seenChairmen.has(dist)) {
            const normCh = normalizeSearch(ch.chairman);
            const normVc = normalizeSearch(ch.viceChairman);
            const normParty = normalizeSearch(ch.party);
            const normDist = normalizeSearch(dist);

            if (normCh.includes(rawQ) || normVc.includes(rawQ) || normParty.includes(rawQ) || normDist.includes(rawQ) ||
                (translitQ && (normCh.includes(translitQ) || normVc.includes(translitQ) || normDist.includes(translitQ)))) {
                seenChairmen.add(dist);
                matchChairman.push({
                    type: 'chairman',
                    title: `👑 ${ch.chairman || 'Chairman'} (${dist})`,
                    subtitle: `Vice Chairman: ${ch.viceChairman || 'N/A'} • Party: ${ch.party || 'N/A'}`,
                    district: dist
                });
            }
        }
    });

    // Scan Incumbents
    incumbentMap.forEach((inc, seat) => {
        const normInc = normalizeSearch(inc.incumbentName);
        const normRu = normalizeSearch(inc.runnerupName);
        const normPhone = normalizeSearch(inc.incumbentNumber);
        const normParty = normalizeSearch(inc.party);

        if (normInc.includes(rawQ) || normRu.includes(rawQ) || normPhone.includes(rawQ) || normParty.includes(rawQ) ||
            (translitQ && (normInc.includes(translitQ) || normRu.includes(translitQ)))) {
            matchIncumbent.push({
                type: 'incumbent',
                title: `🏛️ ${inc.incumbentName || 'Incumbent'} (${seat})`,
                subtitle: `Party: ${inc.party || 'N/A'} • Runner-up: ${inc.runnerupName || 'N/A'} ${inc.incumbentNumber ? '• 📞 ' + inc.incumbentNumber : ''}`,
                seat: seat
            });
        }
    });

    return {
        candidates: matchCandidate.slice(0, 5),
        chairmen: matchChairman.slice(0, 3),
        incumbents: matchIncumbent.slice(0, 4),
        seats: matchSeat.slice(0, 4)
    };
}

function renderUniversalDropdown(results, query, container) {
    if (!container) return;
    if (!results || (!results.candidates.length && !results.chairmen.length && !results.incumbents.length && !results.seats.length)) {
        container.innerHTML = `<div class="us-no-results">No matches for "<strong>${query}</strong>" across Candidates, Chairmen, Seats or Incumbents</div>`;
        container.classList.add('show');
        return;
    }

    let html = '';

    if (results.candidates.length > 0) {
        html += `<div class="us-group-header">👤 Candidates / संभावित उम्मीदवार (${results.candidates.length})</div>`;
        results.candidates.forEach(c => {
            html += `
                <div class="us-item" data-action="seat" data-seat="${c.seat}">
                    <div class="us-item-left">
                        <div class="us-item-title">${highlightMatch(c.title, query)}</div>
                        <div class="us-item-subtitle">${highlightMatch(c.subtitle, query)}</div>
                    </div>
                    <span class="us-item-badge us-badge-candidate">Candidate</span>
                </div>
            `;
        });
    }

    if (results.chairmen.length > 0) {
        html += `<div class="us-group-header">👑 District Chairmen / अध्यक्ष व नेतृत्व (${results.chairmen.length})</div>`;
        results.chairmen.forEach(c => {
            html += `
                <div class="us-item" data-action="district" data-district="${c.district}">
                    <div class="us-item-left">
                        <div class="us-item-title">${highlightMatch(c.title, query)}</div>
                        <div class="us-item-subtitle">${highlightMatch(c.subtitle, query)}</div>
                    </div>
                    <span class="us-item-badge us-badge-chairman">Chairman</span>
                </div>
            `;
        });
    }

    if (results.incumbents.length > 0) {
        html += `<div class="us-group-header">🏛️ Incumbents & Runner-ups / निवर्तमान (${results.incumbents.length})</div>`;
        results.incumbents.forEach(inc => {
            html += `
                <div class="us-item" data-action="seat" data-seat="${inc.seat}">
                    <div class="us-item-left">
                        <div class="us-item-title">${highlightMatch(inc.title, query)}</div>
                        <div class="us-item-subtitle">${highlightMatch(inc.subtitle, query)}</div>
                    </div>
                    <span class="us-item-badge us-badge-incumbent">Incumbent</span>
                </div>
            `;
        });
    }

    if (results.seats.length > 0) {
        html += `<div class="us-group-header">🎯 ZP Seats & Blocks / सीटें व ब्लॉक (${results.seats.length})</div>`;
        results.seats.forEach(s => {
            html += `
                <div class="us-item" data-action="seat" data-seat="${s.seat}">
                    <div class="us-item-left">
                        <div class="us-item-title">${highlightMatch(s.title, query)}</div>
                        <div class="us-item-subtitle">${highlightMatch(s.subtitle, query)}</div>
                    </div>
                    <span class="us-item-badge us-badge-seat">ZP Seat</span>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    container.classList.add('show');
}

/**
 * Executes a universal search query (Middle Header Search) across the entire dashboard.
 */
function executeUniversalSearch(query) {
    const q = (query || '').trim();
    universalSearchQuery = q;

    if (topUniversalSearch) {
        topUniversalSearch.value = q;
        const box = topUniversalSearch.closest('.universal-search-box');
        if (box) box.classList.toggle('has-value', Boolean(q));
    }
    if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');

    if (!q) {
        universalSearchQuery = '';
        renderDashboard();
        return;
    }

    // Clear left pane ZP seat search so they do not conflict
    selectedSeatNumber = '';
    if (seatSearch) {
        seatSearch.value = '';
        const wrapper = seatSearch.closest('.search-input-wrapper');
        if (wrapper) wrapper.classList.remove('has-value');
    }
    if (seatSuggestions) seatSuggestions.classList.remove('show');

    renderDashboard();
    autoDismissMobileDrawer();
}

// Top Universal Search Listeners (Middle Bar Only)
if (topUniversalSearch) {
    topUniversalSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const box = topUniversalSearch.closest('.universal-search-box');
        if (box) box.classList.toggle('has-value', Boolean(query));

        if (!query) {
            if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');
            if (universalSearchQuery) {
                universalSearchQuery = '';
                renderDashboard();
            }
            return;
        }
        const results = buildUniversalSuggestions(query);
        renderUniversalDropdown(results, query, universalSearchDropdown);
    });

    topUniversalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeUniversalSearch(topUniversalSearch.value);
        }
        if (e.key === 'Escape') {
            if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');
            topUniversalSearch.blur();
        }
    });
}

if (clearTopSearch) {
    clearTopSearch.addEventListener('click', () => {
        executeUniversalSearch('');
    });
}

if (universalSearchDropdown) {
    universalSearchDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.us-item');
        if (!item) return;
        const action = item.dataset.action;
        if (action === 'seat') {
            const seat = item.dataset.seat;
            selectSeat(seat);
        } else if (action === 'district') {
            const dist = item.dataset.district;
            if (msDistrict) msDistrict.setSelected([dist]);
            executeUniversalSearch(dist);
        }
        universalSearchDropdown.classList.remove('show');
    });
}

// --- LEFT PANE: ZP SEAT SEARCH ONLY ---
if (seatSearch) {
    seatSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        const wrapper = seatSearch.closest('.search-input-wrapper');
        if (wrapper) wrapper.classList.toggle('has-value', Boolean(query));

        if (!query) {
            seatSuggestions.classList.remove('show');
            seatSuggestions.innerHTML = '';
            if (selectedSeatNumber) {
                selectedSeatNumber = '';
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
            seatSuggestions.innerHTML = '<li class="no-match">No matching ZP seat found</li>';
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
}

if (seatSuggestions) {
    seatSuggestions.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-seat]');
        if (li) selectSeat(li.dataset.seat);
    });
}

if (clearSearch) {
    clearSearch.addEventListener('click', () => {
        seatSearch.value = '';
        const wrapper = seatSearch.closest('.search-input-wrapper');
        if (wrapper) wrapper.classList.remove('has-value');
        seatSuggestions.classList.remove('show');
        selectedSeatNumber = '';
        renderDashboard();
    });
}

// Global Keyboard Shortcut: Ctrl+K to focus universal search
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (topUniversalSearch) {
            topUniversalSearch.focus();
            topUniversalSearch.select();
        }
    }
});

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-universal-search')) {
        if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');
    }
    if (!e.target.closest('.seat-search-group')) {
        if (seatSuggestions) seatSuggestions.classList.remove('show');
    }
});

function selectSeat(seat) {
    selectedSeatNumber = seat;
    if (seatSearch) {
        seatSearch.value = seat;
        const wrapper = seatSearch.closest('.search-input-wrapper');
        if (wrapper) wrapper.classList.add('has-value');
    }
    if (seatSuggestions) seatSuggestions.classList.remove('show');

    // Clear universal search so they remain independent
    universalSearchQuery = '';
    if (topUniversalSearch) {
        topUniversalSearch.value = '';
        const box = topUniversalSearch.closest('.universal-search-box');
        if (box) box.classList.remove('has-value');
    }
    if (universalSearchDropdown) universalSearchDropdown.classList.remove('show');

    if (msCandidateStatus) msCandidateStatus.clear(true);
    if (msIncumbent) msIncumbent.clear(true);
    if (msZone) msZone.clear(true);
    if (msDistrict) msDistrict.clear(true);
    if (msPC) msPC.clear(true);
    if (msAC) msAC.clear(true);
    if (msBlock) msBlock.clear(true);
    if (msReservation) msReservation.clear(true);

    updateActiveKPICard();
    renderDashboard();
    autoDismissMobileDrawer();
}

function getUniqueValues(data, key) {
    const values = data.map(item => String(item[key]).trim()).filter(val => val && val !== 'undefined');
    return [...new Set(values)].sort();
}

function populateInitialFilters() {
    if (msZone) {
        const zones = getUniqueValues(candidatesData, 'Zone').map(z => ({ value: z, label: z }));
        msZone.setOptions(zones, true);
    }
    if (msReservation) {
        const res = getUniqueValues(candidatesData, 'Seat Reservation Status').map(r => ({ value: r, label: r }));
        msReservation.setOptions(res, true);
    }
    updateFilters('zone', true);
}

function updateFilters(changedLevel, isInitial = false) {
    const selectedZones = msZone ? msZone.getSelected() : [];
    let filteredForDistrict = candidatesData;
    if (selectedZones.length > 0) {
        filteredForDistrict = filteredForDistrict.filter(row => selectedZones.includes(String(row.Zone).trim()));
    }
    if (changedLevel === 'zone' || isInitial) {
        const districts = getUniqueValues(filteredForDistrict, 'District').map(d => ({ value: d, label: d }));
        if (msDistrict) msDistrict.setOptions(districts, true);
    }

    const selectedDistricts = msDistrict ? msDistrict.getSelected() : [];
    let filteredForPC = filteredForDistrict;
    if (selectedDistricts.length > 0) {
        filteredForPC = filteredForPC.filter(row => selectedDistricts.includes(String(row.District).trim()));
    }
    if (changedLevel === 'zone' || changedLevel === 'district' || isInitial) {
        const pcs = getUniqueValues(filteredForPC, 'PC').map(p => ({ value: p, label: p }));
        if (msPC) msPC.setOptions(pcs, true);
    }

    const selectedPCs = msPC ? msPC.getSelected() : [];
    let filteredForAC = filteredForPC;
    if (selectedPCs.length > 0) {
        filteredForAC = filteredForAC.filter(row => selectedPCs.includes(String(row.PC).trim()));
    }
    if (changedLevel === 'zone' || changedLevel === 'district' || changedLevel === 'pc' || isInitial) {
        const acs = getUniqueValues(filteredForAC, 'AC').map(a => ({ value: a, label: a }));
        if (msAC) msAC.setOptions(acs, true);
    }

    const selectedACs = msAC ? msAC.getSelected() : [];
    let filteredForBlock = filteredForAC;
    if (selectedACs.length > 0) {
        filteredForBlock = filteredForBlock.filter(row => selectedACs.includes(String(row.AC).trim()));
    }
    if (changedLevel !== 'block') {
        const blocks = getUniqueValues(filteredForBlock, 'Block').map(b => ({ value: b, label: b }));
        if (msBlock) msBlock.setOptions(blocks, true);
    }
}

function getFilteredCandidates(applyStatusFilter = true) {
    // 1. Left Pane: ZP Seat Search Active
    if (selectedSeatNumber) {
        return candidatesData.filter(row => String(row['ZP Seat Number']).trim().toLowerCase() === selectedSeatNumber.toLowerCase());
    }

    // 2. Middle Header: Universal Search Active
    if (universalSearchQuery) {
        const rawQ = normalizeSearch(universalSearchQuery);
        const translitQ = transliterateHindi(universalSearchQuery);
        return candidatesData.filter(row => rowMatchesUniversalQuery(row, rawQ, translitQ));
    }

    let filtered = candidatesData;
    
    const selectedZones = msZone ? msZone.getSelected() : [];
    if (selectedZones.length > 0) {
        filtered = filtered.filter(row => selectedZones.includes(String(row.Zone).trim()));
    }

    const selectedDistricts = msDistrict ? msDistrict.getSelected() : [];
    if (selectedDistricts.length > 0) {
        filtered = filtered.filter(row => selectedDistricts.includes(String(row.District).trim()));
    }

    const selectedPCs = msPC ? msPC.getSelected() : [];
    if (selectedPCs.length > 0) {
        filtered = filtered.filter(row => selectedPCs.includes(String(row.PC).trim()));
    }

    const selectedACs = msAC ? msAC.getSelected() : [];
    if (selectedACs.length > 0) {
        filtered = filtered.filter(row => selectedACs.includes(String(row.AC).trim()));
    }

    const selectedBlocks = msBlock ? msBlock.getSelected() : [];
    if (selectedBlocks.length > 0) {
        filtered = filtered.filter(row => selectedBlocks.includes(String(row.Block).trim()));
    }

    const selectedReservations = msReservation ? msReservation.getSelected() : [];
    if (selectedReservations.length > 0) {
        filtered = filtered.filter(row => selectedReservations.includes(String(row['Seat Reservation Status']).trim()));
    }

    // Apply Incumbent Status filter if selected
    const selectedIncumbents = msIncumbent ? msIncumbent.getSelected() : [];
    if (selectedIncumbents.length > 0) {
        filtered = filtered.filter(row => {
            const seat = String(row['ZP Seat Number']).trim();
            const inc = incumbentMap.get(seat);
            if (!inc) return false;
            
            return selectedIncumbents.some(incVal => {
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
        });
    }

    // Apply Candidate Status filter (multi / single / gap) only if requested
    const selectedCandidateStatuses = msCandidateStatus ? msCandidateStatus.getSelected() : [];
    if (applyStatusFilter && selectedCandidateStatuses.length > 0) {
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
            return selectedCandidateStatuses.some(status => {
                if (status === 'multi') return count >= 2;
                if (status === 'single') return count === 1;
                if (status === 'gap') return count === 0;
                return true;
            });
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
            if (msZone) msZone.setSelected([zone]);
            selectedSeatNumber = '';
            universalSearchQuery = '';
            if (seatSearch) seatSearch.value = '';
            if (topUniversalSearch) topUniversalSearch.value = '';
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
            if (d.zone && d.zone !== 'undefined' && msZone) {
                msZone.setSelected([d.zone]);
                updateFilters('zone');
            }
            if (msDistrict) msDistrict.setSelected([district]);
            selectedSeatNumber = '';
            universalSearchQuery = '';
            if (seatSearch) seatSearch.value = '';
            if (topUniversalSearch) topUniversalSearch.value = '';
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
    const selStatus = msCandidateStatus ? msCandidateStatus.getSelected() : [];
    const selInc = msIncumbent ? msIncumbent.getSelected() : [];
    let badgeParts = [];
    if (selStatus.length > 0) {
        const labels = {
            'multi': '2+ Candidates',
            'single': '1 Candidate',
            'gap': 'Gap (0 Candidates)'
        };
        badgeParts.push(selStatus.map(s => labels[s] || s).join(', '));
    }
    if (selInc.length > 0) {
        const incLabels = {
            'inFinalList': 'In Final List',
            'jsp': 'JSP Leaning',
            'otherParty': 'Other Party'
        };
        badgeParts.push(selInc.map(i => incLabels[i] || i).join(', '));
    }
    let badgeText = badgeParts.join(' + ');
    if (selectedSeatNumber) {
        badgeText = `🎯 ZP Seat: "${selectedSeatNumber}" (${data.length} records)` + (badgeText ? ` • ${badgeText}` : '');
    } else if (universalSearchQuery) {
        badgeText = `🔍 Universal Search: "${universalSearchQuery}" (${data.length} found)` + (badgeText ? ` • ${badgeText}` : '');
    }

    if (badgeText) {
        activeFilterBadge.textContent = badgeText;
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

        // Build candidate name tags or detailed profile cards
        let candidateTags = '';
        if (candCount > 0) {
            if (isDetailedProfileView) {
                candidateTags = candidateRows.map((row, idx) => {
                    const name = String(row['Probable ZP Candidate Name'] || '').trim();
                    const phone = String(row['Contact No'] || '').trim();
                    const jsDesig = String(row['JS Designation'] || '').trim();
                    const source = String(row['Recommendation Source Categories'] || '').trim();
                    const profile = String(row['Brief Profile'] || '').trim();
                    const remarks = String(row['Remarks'] || '').trim();
                    totalCandidateCount++;

                    return `
                        <div class="detailed-candidate-card" data-seat="${seat}" data-idx="${idx}" title="Click to view complete details of ${name}">
                            <div class="d-cand-header">
                                <div class="d-cand-title">
                                    <span class="d-cand-num">#${idx + 1}</span>
                                    <strong class="d-cand-name">${name}</strong>
                                    ${phone && phone !== '-' ? `<a href="tel:${phone}" class="d-cand-phone" onclick="event.stopPropagation();" title="Call ${name}">📞 ${phone}</a>` : ''}
                                </div>
                                <div class="d-cand-badges">
                                    ${jsDesig && jsDesig !== '-' ? `<span class="d-badge d-badge-designation" title="JS Designation">${jsDesig}</span>` : ''}
                                    ${source && source !== '-' ? `<span class="d-badge d-badge-source" title="Recommendation Source">${source}</span>` : ''}
                                </div>
                            </div>
                            <div class="d-cand-body">
                                ${profile && profile !== '-' ? `<div class="d-cand-profile"><span class="d-lbl">Profile:</span> ${profile}</div>` : ''}
                                ${remarks && remarks !== '-' ? `<div class="d-cand-remarks"><span class="d-lbl">Remarks:</span> ${remarks}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
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
            }
        } else {
            candidateTags = '<span class="no-candidate-text">⚠️ No candidate identified yet (Gap)</span>';
        }

        const tr = document.createElement('tr');
        if (selectedSeatNumber || universalSearchQuery) tr.classList.add('search-highlight');
        if (candCount === 0) tr.classList.add('no-candidate-row');
        if (candCount >= 2) tr.classList.add('multi-candidate-row');

        tr.innerHTML = `
            <td><strong class="seat-title">${seat}</strong></td>
            <td>${reservationStatus ? `<span class="reservation-badge ${badgeClass}">${reservationStatus}</span>` : '-'}</td>
            <td>${district || '-'}</td>
            <td>${block || '-'}</td>
            <td class="incumbent-td">${incumbentDisplay}</td>
            <td>${countPill}</td>
            <td class="candidates-cell ${isDetailedProfileView ? 'detailed-mode' : ''}">${candidateTags}</td>
        `;

        candidateTableBody.appendChild(tr);
    });

    resultCount.textContent = `${totalCandidateCount} candidate${totalCandidateCount !== 1 ? 's' : ''} in ${sortedSeats.length} seat${sortedSeats.length !== 1 ? 's' : ''}`;

    // Attach click handlers to candidate tags and detailed cards
    candidateTableBody.querySelectorAll('.candidate-tag, .detailed-candidate-card').forEach(tag => {
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
