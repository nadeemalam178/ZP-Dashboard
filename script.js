const GOOGLE_SHEET_URLS = [
    { id: 'sheet1', name: 'Sheet 1 (Champaran, Saran, Sahabad)', url: 'https://docs.google.com/spreadsheets/d/1ZtME2kaltetF-VNuuH4NATAHx6qSsxFkbZ5fSPSG-CM/export?format=xlsx' },
    { id: 'sheet2', name: 'Sheet 2 (Samastipur, Tirhut, Mithilanchal)', url: 'https://docs.google.com/spreadsheets/d/1ebxTaRpQOgCNWm2mpwk4qSviNiM4c_HAZX-xuiumlYA/export?format=xlsx' },
    { id: 'sheet3', name: 'Sheet 3 (Munger, Magadh, Nalanda)', url: 'https://docs.google.com/spreadsheets/d/1LEMvWv8B0j6zP7ZmkKSn1zDg1M02XclSlQbwPIOmnvs/export?format=xlsx' }
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

// Mobile Sidebar & Nav Elements
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarElement = document.querySelector('.sidebar');

function openMobileSidebar() {
    if (sidebarElement) sidebarElement.classList.add('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
    if (mobileFilterToggle) mobileFilterToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    if (sidebarElement) sidebarElement.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
    if (mobileFilterToggle) mobileFilterToggle.classList.remove('active');
    document.body.style.overflow = '';
}

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
 * =========================================================
 * CLIENT-SIDE INSTANT CACHE (IndexedDB + JSON Fallback)
 * =========================================================
 */
const APP_DATA_VERSION = 'v5.1_20260918';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes: fast instant boot, silent background revalidation if older
const DB_NAME = 'ZP_DASHBOARD_DB';
const DB_VERSION = 2; // Incremented from 1 to 2 to invalidate stale schemas
const STORE_NAME = 'dashboard_cache';
let isSyncingData = false;

function openDashboardDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }
                db.createObjectStore(STORE_NAME);
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function getCachedDashboardPayload() {
    try {
        const db = await openDashboardDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get('latest_payload');
            req.onsuccess = () => {
                const data = req.result;
                if (!data || data.version !== APP_DATA_VERSION) {
                    console.log(`[Cache] Discarding stale cache (stored: ${data?.version}, required: ${APP_DATA_VERSION})`);
                    resolve(null);
                    return;
                }
                resolve(data);
            };
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function saveCachedDashboardPayload(payload) {
    try {
        const db = await openDashboardDB();
        if (!db) return;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
            ...payload,
            version: APP_DATA_VERSION,
            timestamp: payload.timestamp || Date.now()
        }, 'latest_payload');
    } catch (e) {
        console.warn("Could not save to IndexedDB:", e);
    }
}

function applyDashboardPayload(payload) {
    candidatesData = payload.candidatesData || [];
    
    // Unpack Maps
    incumbentMap.clear();
    if (Array.isArray(payload.incumbentMap)) {
        payload.incumbentMap.forEach(([k, v]) => incumbentMap.set(k, v));
    } else if (payload.incumbentMap && typeof payload.incumbentMap === 'object') {
        Object.entries(payload.incumbentMap).forEach(([k, v]) => incumbentMap.set(k, v));
    }

    chairmanMap.clear();
    if (Array.isArray(payload.chairmanMap)) {
        payload.chairmanMap.forEach(([k, v]) => chairmanMap.set(k, v));
    } else if (payload.chairmanMap && typeof payload.chairmanMap === 'object') {
        Object.entries(payload.chairmanMap).forEach(([k, v]) => chairmanMap.set(k, v));
    }

    runnerUpMap.clear();
    if (Array.isArray(payload.runnerUpMap)) {
        payload.runnerUpMap.forEach(([k, v]) => runnerUpMap.set(k, v));
    } else if (payload.runnerUpMap && typeof payload.runnerUpMap === 'object') {
        Object.entries(payload.runnerUpMap).forEach(([k, v]) => runnerUpMap.set(k, v));
    }

    pkData = payload.pkData || [];

    populateIncumbentsFromCandidates();
    allSeatNumbers = getUniqueValues(candidatesData, 'ZP Seat Number');
    populateInitialFilters();
    updateActiveKPICard();
    renderDashboard();
    if (typeof auditSheetData === 'function') auditSheetData();
}

/**
 * Data Loader: Fast boot with Stale-While-Revalidate architecture.
 * Renders instantly from verified cache (<50ms), then automatically revalidates
 * against live Google Sheets if cache is older than TTL or during explicit sync.
 */
async function loadData(forceReload = false) {
    if (isSyncingData && !forceReload) return;
    const syncBadge = document.getElementById('syncStatusBadge');
    let loadedFromCache = false;
    let cacheTimestamp = 0;

    try {
        // 1. Instant Boot from Verified IndexedDB or data_cache.json
        if (!forceReload) {
            const idbData = await getCachedDashboardPayload();
            if (idbData && idbData.candidatesData && idbData.candidatesData.length > 0) {
                applyDashboardPayload(idbData);
                loadedFromCache = true;
                cacheTimestamp = idbData.timestamp || 0;
                if (syncBadge) {
                    const numZones = getUniqueValues(candidatesData, 'Zone').length;
                    const ageMins = Math.round((Date.now() - cacheTimestamp) / 60000);
                    syncBadge.innerHTML = ageMins > 0 
                        ? `⚡ Instant Cache (${ageMins}m ago, All ${numZones || 9} Zones)`
                        : `⚡ Instant Cache (All ${numZones || 9} Zones)`;
                    syncBadge.classList.remove('offline');
                }
            } else {
                // Try fetching local data_cache.json fallback (super fast ~30ms)
                try {
                    const localResp = await fetch(`data_cache.json?v=${APP_DATA_VERSION}&_t=${Date.now()}`, { cache: 'no-cache' });
                    if (localResp.ok) {
                        const localData = await localResp.json();
                        if (localData && localData.candidatesData && localData.candidatesData.length > 0) {
                            applyDashboardPayload(localData);
                            await saveCachedDashboardPayload(localData);
                            loadedFromCache = true;
                            cacheTimestamp = localData.timestamp || Date.now();
                            if (syncBadge) {
                                const numZones = getUniqueValues(candidatesData, 'Zone').length;
                                syncBadge.innerHTML = `⚡ Fast Boot (All ${numZones || 9} Zones)`;
                                syncBadge.classList.remove('offline');
                            }
                        }
                    }
                } catch (cacheErr) {
                    console.warn("Could not fetch local cache fallback:", cacheErr);
                }
            }
        }

        // Stale-While-Revalidate: If we have a fresh cache (<10m) and not forcing reload, we're done!
        const isCacheStale = !loadedFromCache || (Date.now() - cacheTimestamp > CACHE_TTL_MS);
        if (loadedFromCache && !isCacheStale) {
            if (loadingIndicator) loadingIndicator.classList.remove('show');
            return;
        }

        // If not loaded from cache (first time or forceReload), show spinner.
        // If loaded from cache but stale, do NOT block user with spinner; revalidate quietly in background!
        if (!loadedFromCache) {
            if (loadingIndicator) loadingIndicator.classList.add('show');
        }

        isSyncingData = true;
        if (syncBadge) {
            syncBadge.innerHTML = '🔄 Syncing Live Google Sheets...';
            syncBadge.classList.remove('offline');
        }

        // 2. Fetch live Google Sheets in parallel over the network
        candidatesData = [];
        incumbentMap.clear();
        chairmanMap.clear();
        runnerUpMap.clear();
        pkData = [];

        let liveSuccessCount = 0;
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

        populateIncumbentsFromCandidates();
        allSeatNumbers = getUniqueValues(candidatesData, 'ZP Seat Number');
        populateInitialFilters();
        updateActiveKPICard();
        renderDashboard();
        if (typeof auditSheetData === 'function') auditSheetData();

        // Save fresh payload to IndexedDB for next instant boot
        const freshPayload = {
            version: APP_DATA_VERSION,
            timestamp: Date.now(),
            lastSync: new Date().toLocaleString(),
            candidatesData: candidatesData,
            incumbentMap: Array.from(incumbentMap.entries()),
            chairmanMap: Array.from(chairmanMap.entries()),
            runnerUpMap: Array.from(runnerUpMap.entries()),
            pkData: pkData
        };
        await saveCachedDashboardPayload(freshPayload);

        // Update Sync Status Badge
        if (syncBadge) {
            const numZones = getUniqueValues(candidatesData, 'Zone').length;
            syncBadge.innerHTML = `● Live Synced (All ${numZones || 9} Zones)`;
            syncBadge.classList.remove('offline');
        }
    } catch (error) {
        console.error("Error loading live Google Sheets:", error);
        if (syncBadge) {
            syncBadge.innerHTML = '⚠️ Sync Notice (Check Network)';
            syncBadge.classList.add('offline');
        }
        // Fallback to cache if available
        if (candidatesData.length === 0) {
            try {
                const localResp = await fetch(`data_cache.json?v=${APP_DATA_VERSION}&_t=${Date.now()}`);
                if (localResp.ok) {
                    const localData = await localResp.json();
                    applyDashboardPayload(localData);
                    if (syncBadge) syncBadge.innerHTML = '⚡ Cache Active (Offline)';
                    return;
                }
            } catch (e) {}
            alert(`Google Sheets Sync:\n${error.message}\n\nPlease click "Sync Live Google Sheets" to retry.`);
        }
    } finally {
        isSyncingData = false;
        if (loadingIndicator) loadingIndicator.classList.remove('show');
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
            rows.forEach((r, idx) => {
                r['_sourceSheet'] = sourceName;
                r['_sheetRow'] = idx + 2;
                if (!r['Zone'] && (r['sc'] || r['SC'] || r['Sc'])) {
                    r['Zone'] = String(r['sc'] || r['SC'] || r['Sc']).trim();
                }
            });
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
                    party: String(row['Party Inclination'] || row['Current Party Association '] || row['Current Party Association'] || '').trim(),
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
 * Extracts first clean 10-digit phone number if present.
 */
function extractPrimaryPhone(phoneStr) {
    if (!phoneStr) return '';
    const match = String(phoneStr).match(/\b\d{10}\b/);
    if (match) return match[0];
    const digits = String(phoneStr).replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(0, 10);
    return digits;
}

/**
 * Generates a comprehensive unique key for candidate deduplication.
 * Ensures that two distinct candidates sharing the same name on the same seat
 * (with different phones, caste, age, or profiles) are BOTH preserved.
 */
function getCandidateRowKey(row) {
    const seat = String(row['ZP Seat Number'] || '').trim().toLowerCase();
    const name = String(row['Probable ZP Candidate Name'] || '').trim().toLowerCase();

    // If blank placeholder row (no candidate name), only retain one placeholder per seat for gap seats
    if (!name || name === 'undefined' || name === 'nan' || name === '-') {
        return `__blank_${seat}__`;
    }

    const phone = extractPrimaryPhone(row['Contact No']);
    const caste = String(row['Caste'] || '').trim().toLowerCase();
    const age = String(row['Age'] || '').trim();
    const profile = String(row['Brief Profile'] || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30);

    // If phone exists, seat + name + phone uniquely identifies a real candidate
    if (phone) {
        return `${seat}_${name}_${phone}`;
    }

    // If no phone, distinguish by caste, age, and profile snippet
    return `${seat}_${name}_${caste}_${age}_${profile}`;
}

/**
 * Merges candidate rows with intelligent multi-field deduplication.
 * Preserves same-name candidates with different details while filtering true duplicates.
 */
function mergeCandidateRows(newRows) {
    if (!newRows || newRows.length === 0) return 0;
    
    // Ensure all candidate names are cleanly transliterated to English and Zone is normalized
    newRows.forEach(row => {
        if (!row['Zone'] && (row['sc'] || row['SC'] || row['Sc'])) {
            row['Zone'] = String(row['sc'] || row['SC'] || row['Sc']).trim();
        }
        if (row['Probable ZP Candidate Name']) {
            row['Probable ZP Candidate Name'] = transliterateCandidateNameToEnglish(row['Probable ZP Candidate Name']);
        }
    });

    const existing = new Set(candidatesData.map(r => getCandidateRowKey(r)));
    let count = 0;
    newRows.forEach(row => {
        const key = getCandidateRowKey(row);
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
const viewAnalyticsBtn = document.getElementById('viewAnalyticsBtn');
const viewReportBtn = document.getElementById('viewReportBtn');
const viewGapBtn = document.getElementById('viewGapBtn');
const viewAuditBtn = document.getElementById('viewAuditBtn');
const dashboardViewContainer = document.getElementById('dashboardViewContainer');
const analyticsViewContainer = document.getElementById('analyticsViewContainer');
const reportViewContainer = document.getElementById('reportViewContainer');
const gapViewContainer = document.getElementById('gapViewContainer');
const auditViewContainer = document.getElementById('auditViewContainer');
const viewTitle = document.getElementById('viewTitle');
const viewSubtitle = document.getElementById('viewSubtitle');
const gapBadgeCount = document.getElementById('gapBadgeCount');

// Mobile Bottom Nav Elements
const mobNavDashboard = document.getElementById('mobNavDashboard');
const mobNavAnalytics = document.getElementById('mobNavAnalytics');
const mobNavReport = document.getElementById('mobNavReport');
const mobNavGap = document.getElementById('mobNavGap');
const mobNavAudit = document.getElementById('mobNavAudit');
const mobGapBadge = document.getElementById('mobGapBadge');
const mobNavFilterBtn = document.getElementById('mobNavFilterBtn');
const mobActiveFilterBadge = document.getElementById('mobActiveFilterBadge');
const mobApplyFiltersBtn = document.getElementById('mobApplyFiltersBtn');

// Gap Report Elements
const exportGapExcelBtn = document.getElementById('exportGapExcelBtn');
const printGapBtn = document.getElementById('printGapBtn');
const gapZoneFilter = document.getElementById('gapZoneFilter');
const gapDistrictFilter = document.getElementById('gapDistrictFilter');
const gapSearchInput = document.getElementById('gapSearchInput');
const gapClearSearch = document.getElementById('gapClearSearch');
const gapResetFiltersBtn = document.getElementById('gapResetFiltersBtn');
const gapPillTabs = document.getElementById('gapPillTabs');
const gapTableBody = document.getElementById('gapTableBody');

// Audit Action Elements
const exportAuditExcelBtn = document.getElementById('exportAuditExcelBtn');
const reAuditBtn = document.getElementById('reAuditBtn');
const auditSheetFilter = document.getElementById('auditSheetFilter');
const auditDistrictFilter = document.getElementById('auditDistrictFilter');
const auditSeatFilter = document.getElementById('auditSeatFilter');
const auditTypeFilter = document.getElementById('auditTypeFilter');
const auditSearchInput = document.getElementById('auditSearchInput');
const clearAuditSearch = document.getElementById('clearAuditSearch');
const resetAuditFiltersBtn = document.getElementById('resetAuditFiltersBtn');

if (viewDashboardBtn) viewDashboardBtn.addEventListener('click', () => switchMainView('dashboard'));
if (viewAnalyticsBtn) viewAnalyticsBtn.addEventListener('click', () => switchMainView('analytics'));
if (viewReportBtn) viewReportBtn.addEventListener('click', () => switchMainView('report'));
if (viewGapBtn) viewGapBtn.addEventListener('click', () => switchMainView('gap'));
if (viewAuditBtn) viewAuditBtn.addEventListener('click', () => switchMainView('audit'));

if (mobNavDashboard) mobNavDashboard.addEventListener('click', () => switchMainView('dashboard'));
if (mobNavAnalytics) mobNavAnalytics.addEventListener('click', () => switchMainView('analytics'));
if (mobNavReport) mobNavReport.addEventListener('click', () => switchMainView('report'));
if (mobNavGap) mobNavGap.addEventListener('click', () => switchMainView('gap'));
if (mobNavAudit) mobNavAudit.addEventListener('click', () => switchMainView('audit'));
if (mobNavFilterBtn) {
    mobNavFilterBtn.addEventListener('click', () => {
        if (sidebarElement && sidebarElement.classList.contains('mobile-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    });
}
if (mobApplyFiltersBtn) {
    mobApplyFiltersBtn.addEventListener('click', closeMobileSidebar);
}

// Audit Action Listeners (Cascading / Dependent Filters)
if (exportAuditExcelBtn) exportAuditExcelBtn.addEventListener('click', exportAuditToExcel);
if (reAuditBtn) {
    reAuditBtn.addEventListener('click', async () => {
        const originalHtml = reAuditBtn.innerHTML;
        reAuditBtn.disabled = true;
        reAuditBtn.classList.add('is-syncing');
        reAuditBtn.innerHTML = `
            <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.05l5.67-5.67"></path>
            </svg>
            Syncing Live Sheets...
        `;

        try {
            // 1. Force network reload directly from live Google Sheets
            await loadData(true);

            // 2. Refresh dependent cascading filters and audit table
            updateAuditDependentFilters('sync');
            renderAuditTable();

            reAuditBtn.classList.remove('is-syncing');
            reAuditBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Synced & Audited!
            `;

            const resultCountEl = document.getElementById('auditResultCount');
            if (resultCountEl) {
                resultCountEl.innerHTML = `<strong style="color:#16a34a;">✅ Live Google Sheets synced! Audit updated with latest edits.</strong>`;
                setTimeout(() => {
                    renderAuditTable();
                }, 3000);
            }

            setTimeout(() => {
                reAuditBtn.disabled = false;
                reAuditBtn.innerHTML = originalHtml;
            }, 2500);
        } catch (err) {
            console.error("Live sync failed during re-audit:", err);
            // Fallback: re-audit current local data
            auditSheetData();
            reAuditBtn.classList.remove('is-syncing');
            reAuditBtn.innerHTML = `⚠️ Sync Failed (Local Audited)`;
            setTimeout(() => {
                reAuditBtn.disabled = false;
                reAuditBtn.innerHTML = originalHtml;
            }, 3000);
        }
    });
}
if (auditSheetFilter) {
    auditSheetFilter.addEventListener('change', () => {
        updateAuditDependentFilters('sheet');
        renderAuditTable();
    });
}
if (auditDistrictFilter) {
    auditDistrictFilter.addEventListener('change', () => {
        updateAuditDependentFilters('district');
        renderAuditTable();
    });
}
if (auditSeatFilter) {
    auditSeatFilter.addEventListener('change', () => {
        updateAuditDependentFilters('seat');
        renderAuditTable();
    });
}
if (auditTypeFilter) {
    auditTypeFilter.addEventListener('change', renderAuditTable);
}
if (auditSearchInput) {
    auditSearchInput.addEventListener('input', () => {
        if (clearAuditSearch) clearAuditSearch.style.display = auditSearchInput.value ? 'flex' : 'none';
        renderAuditTable();
    });
}
if (clearAuditSearch) {
    clearAuditSearch.addEventListener('click', () => {
        if (auditSearchInput) auditSearchInput.value = '';
        clearAuditSearch.style.display = 'none';
        renderAuditTable();
    });
}
if (resetAuditFiltersBtn) {
    resetAuditFiltersBtn.addEventListener('click', () => {
        if (auditSheetFilter) auditSheetFilter.value = '';
        if (auditDistrictFilter) auditDistrictFilter.value = '';
        if (auditSeatFilter) auditSeatFilter.value = '';
        if (auditTypeFilter) auditTypeFilter.value = '';
        if (auditSearchInput) auditSearchInput.value = '';
        if (clearAuditSearch) clearAuditSearch.style.display = 'none';
        updateAuditDependentFilters('reset');
        renderAuditTable();
    });
}

// Audit KPI Card interactive click handlers
const kpiCritCard = document.getElementById('kpiAuditCriticalCard');
if (kpiCritCard) {
    kpiCritCard.style.cursor = 'pointer';
    kpiCritCard.title = 'Filter by Critical Column Shifts';
    kpiCritCard.addEventListener('click', () => {
        if (auditTypeFilter) {
            auditTypeFilter.value = 'critical';
            renderAuditTable();
        }
    });
}
const kpiSpellCard = document.getElementById('kpiAuditSpellingCard');
if (kpiSpellCard) {
    kpiSpellCard.style.cursor = 'pointer';
    kpiSpellCard.title = 'Filter by Category Spelling Inconsistencies';
    kpiSpellCard.addEventListener('click', () => {
        if (auditTypeFilter) {
            auditTypeFilter.value = 'spelling';
            renderAuditTable();
        }
    });
}
const kpiPhoneCard = document.getElementById('kpiAuditPhoneCard');
if (kpiPhoneCard) {
    kpiPhoneCard.style.cursor = 'pointer';
    kpiPhoneCard.title = 'Filter by Invalid Phone Numbers';
    kpiPhoneCard.addEventListener('click', () => {
        if (auditTypeFilter) {
            auditTypeFilter.value = 'contact';
            renderAuditTable();
        }
    });
}
const kpiTotalCard = document.getElementById('kpiAuditTotalCard');
if (kpiTotalCard) {
    kpiTotalCard.style.cursor = 'pointer';
    kpiTotalCard.title = 'Show all discrepancies';
    kpiTotalCard.addEventListener('click', () => {
        if (auditTypeFilter) {
            auditTypeFilter.value = '';
            renderAuditTable();
        }
    });
}

// Subtab switcher inside Analytics Hub
const analyticsSubtabBtns = document.querySelectorAll('.analytics-subtab-btn');
const analyticsSubtabPanels = document.querySelectorAll('.analytics-subtab-panel');

analyticsSubtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetSubtab = btn.dataset.subtab;
        analyticsSubtabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        analyticsSubtabPanels.forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`subtab-${targetSubtab}`);
        if (panel) panel.classList.add('active');
    });
});

function switchMainView(view) {
    // Reset top switcher buttons
    if (viewDashboardBtn) viewDashboardBtn.classList.toggle('active', view === 'dashboard');
    if (viewAnalyticsBtn) viewAnalyticsBtn.classList.toggle('active', view === 'analytics');
    if (viewReportBtn) viewReportBtn.classList.toggle('active', view === 'report');
    if (viewGapBtn) viewGapBtn.classList.toggle('active', view === 'gap');
    if (viewAuditBtn) viewAuditBtn.classList.toggle('active', view === 'audit');

    // Reset view containers
    if (dashboardViewContainer) dashboardViewContainer.classList.toggle('active-panel', view === 'dashboard');
    if (analyticsViewContainer) analyticsViewContainer.classList.toggle('active-panel', view === 'analytics');
    if (reportViewContainer) reportViewContainer.classList.toggle('active-panel', view === 'report');
    if (gapViewContainer) gapViewContainer.classList.toggle('active-panel', view === 'gap');
    if (auditViewContainer) auditViewContainer.classList.toggle('active-panel', view === 'audit');

    // Sync mobile bottom nav items
    if (mobNavDashboard) mobNavDashboard.classList.toggle('active', view === 'dashboard');
    if (mobNavAnalytics) mobNavAnalytics.classList.toggle('active', view === 'analytics');
    if (mobNavReport) mobNavReport.classList.toggle('active', view === 'report');
    if (mobNavGap) mobNavGap.classList.toggle('active', view === 'gap');
    if (mobNavAudit) mobNavAudit.classList.toggle('active', view === 'audit');

    if (view === 'dashboard') {
        if (viewTitle) viewTitle.textContent = 'Candidate & Incumbent Overview';
        if (viewSubtitle) viewSubtitle.textContent = 'Comprehensive analysis of ZP Seats, Probable Candidates, Sitting Incumbents & Leadership';
    } else if (view === 'analytics') {
        if (viewTitle) viewTitle.textContent = 'Analytics & Demographics Hub';
        if (viewSubtitle) viewSubtitle.textContent = 'In-depth Caste Composition, Age Profiles, Gender Representation & Seat Readiness';
        renderAnalyticsHub(getFilteredCandidates(false));
    } else if (view === 'report') {
        if (viewTitle) viewTitle.textContent = 'Executive Summary Report';
        if (viewSubtitle) viewSubtitle.textContent = 'Numerical State & District Breakdown | Social Category & Recommendation Channel Analysis';
        renderExecutiveReport(candidatesData);
    } else if (view === 'gap') {
        if (viewTitle) viewTitle.textContent = 'ZP Seat & Candidate Gap Report';
        if (viewSubtitle) viewSubtitle.textContent = 'Zero-Candidate Seat Gaps | Mandatory Profile Completeness (Contact No, Category, Caste, Age, Brief Profile)';
        renderGapReport();
    } else if (view === 'audit') {
        if (viewTitle) viewTitle.textContent = 'Data Quality & Sheet Discrepancy Audit';
        if (viewSubtitle) viewSubtitle.textContent = 'Live audit of cell shifts, invalid categories, abnormal ages & corrupt phone numbers to fix in Google Sheets';
        auditSheetData();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateMobileFilterBadge() {
    if (!mobActiveFilterBadge) return;
    let count = 0;
    if (msZone && msZone.getSelected().length > 0) count += msZone.getSelected().length;
    if (msDistrict && msDistrict.getSelected().length > 0) count += msDistrict.getSelected().length;
    if (msPC && msPC.getSelected().length > 0) count += msPC.getSelected().length;
    if (msAC && msAC.getSelected().length > 0) count += msAC.getSelected().length;
    if (msBlock && msBlock.getSelected().length > 0) count += msBlock.getSelected().length;
    if (msReservation && msReservation.getSelected().length > 0) count += msReservation.getSelected().length;
    if (msCandidateStatus && msCandidateStatus.getSelected().length > 0) count += msCandidateStatus.getSelected().length;
    if (msIncumbent && msIncumbent.getSelected().length > 0) count += msIncumbent.getSelected().length;
    if (selectedSeatNumber) count += 1;
    if (universalSearchQuery) count += 1;

    if (count > 0) {
        mobActiveFilterBadge.textContent = count;
        mobActiveFilterBadge.style.display = 'flex';
    } else {
        mobActiveFilterBadge.style.display = 'none';
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

// Hindi candidate name translation dictionary for exact, verified English transliterations
const HINDI_NAME_TRANSLATIONS = {
    'रवि रौशन कुमार': 'Ravi Raushan Kumar',
    'नवीता देवी': 'Navita Devi',
    'संगीता कुमारी': 'Sangeeta Kumari',
    'सुनीता देवी': 'Sunita Devi',
    'मन्जु देवी': 'Manju Devi',
    'ठाकुर उदय शंकर': 'Thakur Uday Shankar',
    'धर्मेन्द्र पासवान': 'Dharmendra Paswan',
    'अरुण कुमार गुप्ता': 'Arun Kumar Gupta',
    'राज केश्वर पासवान': 'Raj Keshwar Paswan',
    'राज केश्\u200dवर पासवान': 'Raj Keshwar Paswan',
    'स्वर्णिमा सिंह (Lal Babu)': 'Swarnima Singh (Lal Babu)',
    'स्वर्णिमा सिंह': 'Swarnima Singh',
    'प्रियंका कुमारी (Satyanarayan Sahani)': 'Priyanka Kumari (Satyanarayan Sahani)',
    'वीणा देवी': 'Veena Devi',
    'Vivek Chaurasiya\nदिनेश चौरसिया': 'Vivek Chaurasiya / Dinesh Chaurasiya',
    'दिनेश चौरसिया': 'Dinesh Chaurasiya',
    'संजीव कुमार शर्मा': 'Sanjeev Kumar Sharma',
    'घनश्याम रॉय': 'Ghanshyam Roy',
    'किरण देवी / Rajendra Sharma': 'Kiran Devi / Rajendra Sharma',
    'किरण देवी': 'Kiran Devi',
    'शिल्पी कुमारी / Raushan Kumar': 'Shilpi Kumari / Raushan Kumar',
    'शिल्पी कुमारी': 'Shilpi Kumari',
    'प्रवीण शेखर': 'Praveen Shekhar',
    'राजीव कुमार सिंह': 'Rajeev Kumar Singh',
    'पुष्पा कुमारी': 'Pushpa Kumari',
    'संजय चौपाल': 'Sanjay Chaupal',
    'विष्णु देव चौपाल': 'Vishnu Dev Chaupal',
    'बिन्देश्वर राम': 'Bindeshwar Ram',
    'बिन्देश्\u200dवर राम': 'Bindeshwar Ram',
    'मुकेश राम': 'Mukesh Ram',
    'बिपिन भास्कर': 'Bipin Bhaskar',
    'श्री ब्रजेश राउत': 'Shri Brajesh Raut',
    'श्री विनायक यादव': 'Shri Vinayak Yadav',
    'श्री राम प्रसाद चौपाल': 'Shri Ram Prasad Chaupal',
    'श्री डॉ सरफराज आलम': 'Shri Dr. Sarfaraz Alam',
    'श्री सुपेंद्र राम': 'Shri Supendra Ram',
    'सुमित कुमार झा': 'Sumit Kumar Jha',
    'सुरेंद्र कुमार झा': 'Surendra Kumar Jha',
    'प्रशांत सिंह': 'Prashant Singh',
    'श्री रीक्षाव  कुमार  वत्स': 'Shri Rikshav Kumar Vats',
    'श्री रीक्षाव कुमार वत्स': 'Shri Rikshav Kumar Vats',
    'त्रिवेणी कुमार रमण': 'Triveni Kumar Raman',
    'अभिषेक कुमार गुप्ता': 'Abhishek Kumar Gupta',
    'जामुन प्रसाद साहू': 'Jamun Prasad Sahu',
    'भोला साहू': 'Bhola Sahu',
    'गंगा प्रसाद साहू': 'Ganga Prasad Sahu',
    'अशोक साहु': 'Ashok Sahu',
    'ममता कुमारी / Santosh Singh': 'Mamta Kumari / Santosh Singh',
    'ममता कुमारी': 'Mamta Kumari',
    'लाल बाबू यादव': 'Lal Babu Yadav',
    'कुमार गौरव': 'Kumar Gaurav',
    'चंदन कुमार ठाकुर': 'Chandan Kumar Thakur',
    'नीलम दुसाध': 'Neelam Dusadh',
    'पिंटू कुमार यादव': 'Pintu Kumar Yadav',
    'प्रतिभा सिंह': 'Pratibha Singh',
    'प्रमीला देवी': 'Pramila Devi',
    'विनोद कुमार साह': 'Vinod Kumar Sah',
    'सिंकू कुमारी': 'Sinku Kumari',
    'अवधेश कुमार': 'Awadhesh Kumar',
    'अरुण पासवान': 'Arun Paswan',
    'जय नारायण राम': 'Jai Narayan Ram',
    'मुरारी पासवान': 'Murari Paswan',
    'दिलीप कुमार': 'Dilip Kumar',
    'पुरुषोत्तम कुमार': 'Purushottam Kumar',
    'अनिल कुमार सिंह': 'Anil Kumar Singh',
    'मुकेश कुमार': 'Mukesh Kumar',
    'रंजना चौधरी': 'Ranjana Choudhary',
    'आरती देवी': 'Aarti Devi',
    'अंगूरी खातुन': 'Angoori Khatun',
    'आमिरुल हक': 'Aamirul Haq',
    'मो. इरशाद': 'Md. Irshad',
    'मो. मुस्तफा': 'Md. Mustafa',
    'मो. शहनवाज़': 'Md. Shahnawaz',
    'Shahjaha Khaatoon //मंजूर आलम खान': 'Shahjaha Khatoon // Manjoor Alam Khan',
    'मंजूर आलम खान': 'Manjoor Alam Khan',
    'Mainejar Yadav / कुलपति देवी': 'Mainejar Yadav / Kulpati Devi',
    'कुलपति देवी': 'Kulpati Devi',
    'नुर मोहम्मद अंसारी': 'Noor Mohammad Ansari',
    'सुनिता देवी': 'Sunita Devi',
    'सुषमा गुप्ता': 'Sushma Gupta',
    'ददन प्रसाद आजाद': 'Dadan Prasad Azad',
    'डॉ शैलेश कुमार सागर': 'Dr. Shailesh Kumar Sagar',
    'प्रमोद कुमार सिंह': 'Pramod Kumar Singh',
    'मुस्कान कुमारी': 'Muskan Kumari'
};

const DEVANAGARI_PHONETIC_VOWELS = {
    'अ': 'A', 'आ': 'Aa', 'इ': 'I', 'ई': 'Ee', 'उ': 'U', 'ऊ': 'Oo', 'ऋ': 'Ri',
    'ए': 'E', 'ऐ': 'Ai', 'ओ': 'O', 'औ': 'Au', 'अं': 'An', 'अः': 'Ah'
};
const DEVANAGARI_PHONETIC_MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h'
};
const DEVANAGARI_PHONETIC_CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f'
};

function transliteratePhoneticWord(w) {
    if (!/[\u0900-\u097F]/.test(w)) return w;
    let out = '';
    const chars = Array.from(w.replace(/[\u200D\u200C]/g, ''));
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const next = chars[i + 1];
        if (DEVANAGARI_PHONETIC_VOWELS[c]) {
            out += DEVANAGARI_PHONETIC_VOWELS[c];
        } else if (DEVANAGARI_PHONETIC_CONSONANTS[c]) {
            const base = DEVANAGARI_PHONETIC_CONSONANTS[c];
            if (next === '्') {
                out += base;
                i++;
            } else if (DEVANAGARI_PHONETIC_MATRAS[next]) {
                out += base + DEVANAGARI_PHONETIC_MATRAS[next];
                i++;
                if (chars[i + 1] === 'ं' || chars[i + 1] === 'ँ') {
                    out += 'n';
                    i++;
                }
            } else {
                if (i === chars.length - 1) {
                    out += base;
                } else {
                    out += base + 'a';
                }
            }
        } else if (DEVANAGARI_PHONETIC_MATRAS[c]) {
            out += DEVANAGARI_PHONETIC_MATRAS[c];
        } else {
            out += c;
        }
    }
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
}

/**
 * Converts Hindi/Devanagari candidate names to clean, readable English.
 */
function transliterateCandidateNameToEnglish(text) {
    if (!text) return '';
    let str = String(text).trim();
    if (!/[\u0900-\u097F]/.test(str)) return str;

    // 1. Direct dictionary match
    if (HINDI_NAME_TRANSLATIONS[str]) return HINDI_NAME_TRANSLATIONS[str];

    // 2. Normalized space match
    const norm = str.replace(/\s+/g, ' ');
    if (HINDI_NAME_TRANSLATIONS[norm]) return HINDI_NAME_TRANSLATIONS[norm];

    // 3. Substring replacement for multi-part names
    let replaced = str;
    for (const [hi, en] of Object.entries(HINDI_NAME_TRANSLATIONS)) {
        if (replaced.includes(hi)) {
            replaced = replaced.split(hi).join(en);
        }
    }
    if (!/[\u0900-\u097F]/.test(replaced)) {
        return replaced.replace(/\s+/g, ' ').trim();
    }

    // 4. Algorithmic transliteration for remaining Devanagari words
    return replaced.split(/(\s+|[/\-,()]+)/).map(part => transliteratePhoneticWord(part)).join('').replace(/\s+/g, ' ').trim();
}

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
    'मुंगेर': 'munger', 'भागलपुर': 'bhagalpur', 'बांका': 'banka', 'जमुई': 'jamui',
    'लखीसराय': 'lakhisarai', 'शेखपुरा': 'sheikhpura', 'नालंदा': 'nalanda', 'बिहारशरीफ': 'biharsharif',
    'गया': 'gaya', 'नवादा': 'nawada', 'औरंगाबाद': 'aurangabad', 'जहानाबाद': 'jehanabad', 'अरवल': 'arwal',
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

        // 1. Candidate Name match (distinguish multiple candidates with same name on same seat)
        const candPhone = extractPrimaryPhone(phone);
        const candKey = `${seat}_${name}_${candPhone || row['Caste'] || row['Age'] || profile.slice(0, 20)}`;
        if (name && !seenCandidates.has(candKey)) {
            const normName = normalizeSearch(name);
            const normPhone = normalizeSearch(phone);
            const normProfile = normalizeSearch(profile);
            if (normName.includes(rawQ) || (translitQ && normName.includes(translitQ)) || normPhone.includes(rawQ) || normProfile.includes(rawQ)) {
                seenCandidates.add(candKey);
                const casteHint = row['Caste'] && row['Caste'] !== '-' ? ` (${row['Caste']})` : '';
                matchCandidate.push({
                    type: 'candidate',
                    title: `${name}${casteHint}`,
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
    renderGapReport();
    renderAnalyticsHub(geoFiltered);
    renderSeatTable(tableFiltered);
    renderReservationBreakdown(geoFiltered);
    updateMobileFilterBadge();
}

// ===========================================
// EXECUTIVE NUMERICAL REPORT (1-Page Print Ready)
// ===========================================
function renderExecutiveReport(data) {
    if (!data) {
        data = (typeof candidatesData !== 'undefined' && Array.isArray(candidatesData)) ? candidatesData : [];
    }
    const reportKpiBar = document.getElementById('reportKpiBar');
    const reportZoneDistrictBody1 = document.getElementById('reportZoneDistrictBody1');
    const reportZoneDistrictBody2 = document.getElementById('reportZoneDistrictBody2');
    const reportZoneDistrictBody = document.getElementById('reportZoneDistrictBody');
    const reportCategoryBody = document.getElementById('reportCategoryBody');
    const reportSourceBody = document.getElementById('reportSourceBody');

    if (!reportKpiBar || (!reportZoneDistrictBody1 && !reportZoneDistrictBody) || !data || !data.length) return;

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

    // 2. Zone & District Table (Hierarchical numerical summary split into 2 balanced columns)
    const sortedZones = Array.from(zoneDistrictsMap.keys()).sort();
    const midIdx = Math.ceil(sortedZones.length / 2);
    const zonesPart1 = sortedZones.slice(0, midIdx);
    const zonesPart2 = sortedZones.slice(midIdx);

    function buildZoneHtml(zonesList) {
        let html = '';
        zonesList.forEach(zone => {
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
                const dCompletionPct = dTotalSeats > 0 ? (((dSeats1Plus + dSeats2Plus) / (dTotalSeats * 2)) * 100).toFixed(1) : '0.0';

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
            const zoneCompletionPct = zoneSeatsTotal > 0 ? (((zoneSeats1Plus + zoneSeats2Plus) / (zoneSeatsTotal * 2)) * 100).toFixed(1) : '0.0';

            // Zone Header Row
            html += `
                <tr class="report-zone-header-row">
                    <td><strong>${zone} (${sortedDistricts.length} Dist.)</strong></td>
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
        return html;
    }

    let zoneDistrictHtml1 = buildZoneHtml(zonesPart1);
    let zoneDistrictHtml2 = buildZoneHtml(zonesPart2);

    // Grand Total Row attached to Part 2
    const grandTotalRow = `
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
    zoneDistrictHtml2 += grandTotalRow;

    if (reportZoneDistrictBody1) reportZoneDistrictBody1.innerHTML = zoneDistrictHtml1;
    if (reportZoneDistrictBody2) reportZoneDistrictBody2.innerHTML = zoneDistrictHtml2;
    if (reportZoneDistrictBody) reportZoneDistrictBody.innerHTML = zoneDistrictHtml1 + zoneDistrictHtml2;

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
                                    ${phone && phone !== '-' ? `<a href="tel:${extractPrimaryPhone(phone)}" class="d-cand-phone" onclick="event.stopPropagation();" title="Call ${name}">📞 ${phone.replace(/[\r\n]+/g, ' / ')}</a>` : ''}
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
                // Check if any candidate name appears multiple times in this seat
                const nameCounts = {};
                candidateRows.forEach(r => {
                    const n = String(r['Probable ZP Candidate Name']).trim().toLowerCase();
                    nameCounts[n] = (nameCounts[n] || 0) + 1;
                });

                candidateTags = candidateRows.map((row, idx) => {
                    const name = String(row['Probable ZP Candidate Name']).trim();
                    const phone = String(row['Contact No'] || '').trim();
                    const caste = String(row['Caste'] || '').trim();
                    const isDup = nameCounts[name.toLowerCase()] > 1;
                    const distinguishHint = isDup ? (caste && caste !== '-' ? ` (${caste})` : (phone && phone !== '-' ? ` (${phone.slice(-4)})` : ` (#${idx + 1})`)) : '';

                    totalCandidateCount++;
                    return `<span class="candidate-tag" data-seat="${seat}" data-idx="${idx}" title="Click to view full details of ${name}${caste ? ' • Caste: ' + caste : ''}${phone ? ' • 📞 ' + phone : ''}">
                        <span class="candidate-num">${idx + 1}</span>
                        <span class="candidate-name-text">${name}${distinguishHint ? `<span class="cand-distinguish-hint" style="font-weight: 500; opacity: 0.85; font-size: 0.82em; margin-left: 3px; color: var(--accent-light, #38bdf8);">${distinguishHint}</span>` : ''}</span>
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
                <span class="detail-value">${contact && contact !== '-' ? contact.split(/[\/\,\n\r\\\\;&]+/).map(s => s.trim()).filter(Boolean).map(num => {
                    const clean = extractPrimaryPhone(num);
                    return clean ? `<a href="tel:${clean}" style="color:var(--primary); font-weight:600; text-decoration:none;" title="Call ${clean}">📞 ${escapeHtml(num)}</a>` : escapeHtml(num);
                }).join(' <span style="color:var(--text-muted); margin:0 4px;">/</span> ') : '-'}</span>
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

    // Update contextual intelligence chips
    const chipCoverage = document.getElementById('kpi-chip-coverage');
    const chipMulti = document.getElementById('kpi-chip-multi');
    const chipGap = document.getElementById('kpi-chip-gap');

    if (chipCoverage && totalZPSeats > 0) {
        const pct = ((seatsWithAtLeastOne / totalZPSeats) * 100).toFixed(1);
        chipCoverage.textContent = `${pct}% Coverage`;
    }
    if (chipMulti && totalZPSeats > 0) {
        const pct = ((seatsWith2Plus / totalZPSeats) * 100).toFixed(1);
        chipMulti.textContent = `${pct}% Target Met`;
    }
    if (chipGap && totalZPSeats > 0) {
        const pct = ((gapSeats / totalZPSeats) * 100).toFixed(1);
        chipGap.textContent = gapSeats === 0 ? '0 Gaps' : `${pct}% Attention`;
    }
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
        const totalSeats = Object.values(counts).reduce((a, b) => a + b, 0);
        reservationChips.innerHTML = entries.map(([status, count]) => {
            const badgeClass = getReservationBadgeClass(status);
            const pct = totalSeats > 0 ? ((count / totalSeats) * 100).toFixed(1) : '0.0';
            return `<div class="res-card ${badgeClass}">
                <div class="res-card-top">
                    <span class="res-card-label">${status}</span>
                    <span class="res-card-count">${count}</span>
                </div>
                <div class="res-card-bottom">
                    <div class="res-card-bar">
                        <div class="res-card-fill" style="width: ${pct}%;"></div>
                    </div>
                    <span class="res-card-pct">${pct}%</span>
                </div>
            </div>`;
        }).join('');
        reservationBreakdown.style.display = 'block';
    } else {
        reservationBreakdown.style.display = 'none';
    }
}

// ===========================================
// ANALYTICS & DEMOGRAPHICS HUB
// ===========================================

let cachedSeatCasteData = []; // for real-time filtering in Seat Caste Explorer

function renderAnalyticsHub(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    if (!candidateRows || candidateRows.length === 0) return;

    try { renderCasteAnalytics(candidateRows); } catch (e) { console.error('Error in renderCasteAnalytics:', e); }
    try { renderAgeAnalytics(candidateRows); } catch (e) { console.error('Error in renderAgeAnalytics:', e); }
    try { renderGenderAnalytics(candidateRows); } catch (e) { console.error('Error in renderGenderAnalytics:', e); }
    try { renderReadinessAnalytics(candidateRows); } catch (e) { console.error('Error in renderReadinessAnalytics:', e); }
    try { renderBackgroundAnalytics(candidateRows); } catch (e) { console.error('Error in renderBackgroundAnalytics:', e); }
}

// -------------------------------------------
// Canonical Category Standardizer & Normalizer
// -------------------------------------------
function normalizeCategory(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s || s === '-' || s === 'NA' || s === 'N/A' || s === 'undefined') return '';
    const l = s.toLowerCase();

    // Check if phone number, age, or corrupt entry (diverted to error report)
    if (/^\d+$/.test(s) || /^[6-9]\d{9}$/.test(s) || ['bdc ladenge', 'identify', 'male', 'female'].includes(l)) {
        return '(Invalid Data)';
    }

    // 1. General & all spelling variants (Gen, GEN, Genral, Genernal, Generaal, UR, सामान्य)
    if (l.includes('general') || l === 'gen' || l === 'gen.' || l === 'genral' || l === 'genernal' || l === 'generaal' || l === 'ur' || l === 'unreserved' || l === 'सामान्य') {
        return 'General';
    }

    // 2. Minority & all spelling variants (Minoriy, Monority, Muslim, अल्पसंख्यक)
    if (l.includes('minority') || l === 'minoriy' || l === 'monority' || l.includes('अल्पसंख्यक') || l === 'muslim') {
        return 'Minority';
    }

    // 3. EBC & Most Backward (अति पिछड़ा वर्ग)
    if (l.includes('ebc') || l.includes('अति पिछड़ा') || l.includes('most backward')) {
        return 'EBC';
    }

    // 4. OBC & Backward (पिछड़ा वर्ग, BC, BC-1, BC-2, ओबीसी)
    if (l.includes('obc') || l.includes('पिछड़ा') || l.includes('पिछड़ा') || l === 'bc' || l.startsWith('bc-') || l.includes('ओबीसी')) {
        return 'OBC';
    }

    // 5. SC & Scheduled Caste (अनुसूचित जाति)
    if (l.includes('sc') || l.includes('अनुसूचित जाति')) {
        return 'SC';
    }

    // 6. ST & Scheduled Tribe (अनुसूचित जनजाति)
    if (l.includes('st') || l.includes('अनुसूचित जनजाति')) {
        return 'ST';
    }

    return s.charAt(0).toUpperCase() + s.slice(1);
}

// -------------------------------------------
// 1. Caste & Social Category Analytics
// -------------------------------------------
function renderCasteAnalytics(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    const casteCategoryGrid = document.getElementById('categoryShareCards') || document.getElementById('casteCategoryGrid');
    const topCastesChart = document.getElementById('topCastesChart');
    const casteCategorySelect = document.getElementById('casteCategorySelect');

    if (!topCastesChart) return;

    const categoryCounts = {};
    const casteCounts = {};
    const casteCategoryMap = {};
    let totalCategorized = 0;
    let totalCasteCandidates = 0;
    let invalidCategoryCount = 0;

    candidateRows.forEach(row => {
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!candName || candName === 'undefined') return;

        // Category standardizer
        const rawCat = String(row['Category'] || '').trim();
        const cat = normalizeCategory(rawCat);
        if (cat && cat !== '(Invalid Data)') {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            totalCategorized++;
        } else if (cat === '(Invalid Data)') {
            invalidCategoryCount++;
        }

        // Caste
        let caste = String(row['Caste'] || '').trim();
        if (caste && caste !== '-' && caste !== 'NA' && caste !== 'undefined') {
            caste = caste.charAt(0).toUpperCase() + caste.slice(1);
            casteCounts[caste] = (casteCounts[caste] || 0) + 1;
            totalCasteCandidates++;
            if (cat && cat !== '(Invalid Data)') casteCategoryMap[caste] = cat;
        }
    });

    // 1. Render Canonical Category Summary Cards (6 standard constitutional categories)
    const categoryOrder = ['General', 'OBC', 'EBC', 'SC', 'Minority', 'ST'];
    const categoryColors = {
        'General': '#6366f1',
        'OBC': '#3b82f6',
        'EBC': '#06b6d4',
        'SC': '#f59e0b',
        'Minority': '#10b981',
        'ST': '#ec4899',
        'Other': '#8b5cf6'
    };

    if (casteCategoryGrid) {
        let cardsHtml = categoryOrder.map(cat => {
            const count = categoryCounts[cat] || 0;
            const pct = totalCategorized > 0 ? ((count / totalCategorized) * 100).toFixed(1) : '0.0';
            const color = categoryColors[cat] || '#6366f1';
            return `
                <div class="category-stat-card">
                    <div class="category-card-top">
                        <span class="category-card-label">${cat}</span>
                        <span class="category-card-pct">${pct}%</span>
                    </div>
                    <div class="category-card-val">${count}</div>
                    <div class="category-mini-bar-track">
                        <div class="category-mini-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                    </div>
                </div>
            `;
        }).join('');

        if (invalidCategoryCount > 0) {
            cardsHtml += `
                <div style="grid-column: 1 / -1; margin-top: 4px; padding: 7px 12px; background: rgba(225, 29, 72, 0.08); border: 1px solid rgba(225, 29, 72, 0.25); border-radius: 6px; font-size: 11px; color: #be123c; display: flex; align-items: center; justify-content: space-between; font-weight: 600;">
                    <span>⚠️ ${invalidCategoryCount} candidates have phone/age/text in Category column (excluded from cards).</span>
                    <a href="javascript:void(0)" onclick="switchMainView('audit')" style="color: #be123c; text-decoration: underline; font-weight: 700;">View in Data Audit &rarr;</a>
                </div>
            `;
        }

        casteCategoryGrid.innerHTML = cardsHtml;
    }

    // Populate category dropdown for Seat Caste Explorer
    if (casteCategorySelect) {
        const currentVal = casteCategorySelect.value;
        casteCategorySelect.innerHTML = `<option value="">All Categories (सभी श्रेणियां)</option>` +
            categoryOrder.filter(cat => (categoryCounts[cat] || 0) > 0).map(cat => 
                `<option value="${cat}" ${currentVal === cat ? 'selected' : ''}>${cat} (${categoryCounts[cat] || 0})</option>`
            ).join('');
    }

    // 2. Render Top Castes Bars
    const sortedCastes = Object.entries(casteCounts).sort((a, b) => b[1] - a[1]);
    const maxCasteCount = sortedCastes.length > 0 ? sortedCastes[0][1] : 1;

    topCastesChart.innerHTML = sortedCastes.slice(0, 16).map(([caste, count], idx) => {
        const pctOfTotal = totalCasteCandidates > 0 ? ((count / totalCasteCandidates) * 100).toFixed(1) : '0.0';
        const barWidth = ((count / maxCasteCount) * 100).toFixed(1);
        const cat = casteCategoryMap[caste] || '';
        const rankClass = idx === 0 ? 'rank-gold' : (idx === 1 ? 'rank-silver' : (idx === 2 ? 'rank-bronze' : 'rank-default'));
        const rankBadge = `<span class="caste-rank ${rankClass}">${idx + 1}</span>`;

        return `
            <div class="caste-bar-item">
                <div class="caste-bar-meta">
                    <span class="caste-bar-name">
                        ${rankBadge}
                        ${caste}
                        ${cat ? `<span class="caste-category-badge">${cat}</span>` : ''}
                    </span>
                    <div class="caste-bar-numbers">
                        <span class="caste-bar-count">${count}</span>
                        <span class="caste-bar-pct">(${pctOfTotal}%)</span>
                    </div>
                </div>
                <div class="caste-bar-track">
                    <div class="caste-bar-fill" style="width: ${barWidth}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    // 3. Prepare and Render Seat-wise Caste Explorer
    const seatsMap = new Map();
    candidateRows.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        if (!seat || seat === 'undefined') return;

        if (!seatsMap.has(seat)) {
            seatsMap.set(seat, {
                seat: seat,
                zone: String(row['Zone'] || '').trim(),
                district: String(row['District'] || '').trim(),
                block: String(row['Block'] || '').trim(),
                reservation: String(row['Seat Reservation Status'] || '').trim(),
                candidates: []
            });
        }
        const sObj = seatsMap.get(seat);
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (candName && candName !== 'undefined') {
            const rawCat = String(row['Category'] || '').trim();
            const normCat = normalizeCategory(rawCat);
            sObj.candidates.push({
                name: candName,
                caste: String(row['Caste'] || '').trim(),
                category: normCat && normCat !== '(Invalid Data)' ? normCat : (rawCat || '')
            });
        }
    });

    cachedSeatCasteData = Array.from(seatsMap.values()).sort((a, b) =>
        a.seat.localeCompare(b.seat, undefined, { numeric: true, sensitivity: 'base' })
    );

    renderSeatCasteTable();
}

function renderSeatCasteTable() {
    const searchInput = document.getElementById('casteSeatSearchInput') || document.getElementById('seatCasteSearch');
    const categorySelect = document.getElementById('casteCategorySelect');
    const tbody = document.getElementById('seatCasteTableBody') || document.getElementById('seatCasteBody');
    if (!tbody) return;

    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const selectedCategory = categorySelect ? categorySelect.value : '';

    let filtered = cachedSeatCasteData;

    if (selectedCategory) {
        filtered = filtered.filter(s =>
            s.candidates.some(c => c.category && c.category.toLowerCase().includes(selectedCategory.toLowerCase()))
        );
    }

    if (query) {
        filtered = filtered.filter(s => {
            if (s.seat.toLowerCase().includes(query) || s.district.toLowerCase().includes(query) || s.block.toLowerCase().includes(query) || s.zone.toLowerCase().includes(query)) return true;
            return s.candidates.some(c => 
                c.name.toLowerCase().includes(query) || 
                (c.caste && c.caste.toLowerCase().includes(query)) ||
                (c.category && c.category.toLowerCase().includes(query))
            );
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-results-cell">No matching seats or caste profiles found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.slice(0, 100).map(s => {
        const badgeClass = getReservationBadgeClass(s.reservation);
        const candHtml = s.candidates.length > 0 ? s.candidates.map(c => {
            const casteText = c.caste && c.caste !== '-' ? ` (${c.caste})` : '';
            const catBadge = c.category && c.category !== '-' ? `<span class="caste-category-badge" style="margin-left:4px;">${c.category}</span>` : '';
            return `<span class="candidate-tag" title="Caste: ${c.caste || 'N/A'} • Category: ${c.category || 'N/A'}">
                <span class="candidate-name-text">${c.name}<strong>${casteText}</strong>${catBadge}</span>
            </span>`;
        }).join('') : '<span class="no-candidate-text">⚠️ Gap (0 candidates)</span>';

        return `
            <tr>
                <td><strong class="seat-title">${s.seat}</strong></td>
                <td>${s.district || '-'}${s.zone ? ` <span style="color:var(--text-muted); font-size:11px;">(${s.zone})</span>` : ''}</td>
                <td>${s.block || '-'}</td>
                <td>${s.reservation ? `<span class="reservation-badge ${badgeClass}">${s.reservation}</span>` : '-'}</td>
                <td class="candidates-cell">${candHtml}</td>
                <td class="num-col font-bold">${s.candidates.length}</td>
            </tr>
        `;
    }).join('');
}

// Attach listeners for Seat Caste Explorer
const casteSeatSearchInputEl = document.getElementById('casteSeatSearchInput') || document.getElementById('seatCasteSearch');
const casteCategorySelectEl = document.getElementById('casteCategorySelect');
if (casteSeatSearchInputEl) {
    casteSeatSearchInputEl.addEventListener('input', () => renderSeatCasteTable());
}
if (casteCategorySelectEl) {
    casteCategorySelectEl.addEventListener('change', () => renderSeatCasteTable());
}

// -------------------------------------------
// 2. Age Demographics & Youth Representation
// -------------------------------------------
function renderAgeAnalytics(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    const ageKpiRow = document.getElementById('ageKpiRow');
    const ageHistogramContainer = document.getElementById('ageBracketChart') || document.getElementById('ageHistogramContainer');
    const zoneAgeList = document.getElementById('zoneAgeList');

    if (!ageHistogramContainer) return;

    let validAges = [];
    const brackets = {
        'under35': { label: '< 35 Years (Youth & Emerging Leaders)', count: 0, class: 'youth' },
        '35to44': { label: '35 – 44 Years (Dynamic Cadre)', count: 0, class: '' },
        '45to54': { label: '45 – 54 Years (Experienced Middle)', count: 0, class: '' },
        '55to64': { label: '55 – 64 Years (Senior Leadership)', count: 0, class: '' },
        '65plus': { label: '65+ Years (Veterans & Elders)', count: 0, class: 'veteran' }
    };

    const zoneAgeMap = new Map();

    candidateRows.forEach(row => {
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!candName || candName === 'undefined') return;

        let ageVal = parseInt(row['Age']);
        if (!ageVal || isNaN(ageVal) || ageVal < 21 || ageVal > 95) return;

        validAges.push(ageVal);

        if (ageVal < 35) brackets['under35'].count++;
        else if (ageVal <= 44) brackets['35to44'].count++;
        else if (ageVal <= 54) brackets['45to54'].count++;
        else if (ageVal <= 64) brackets['55to64'].count++;
        else brackets['65plus'].count++;

        const zone = String(row['Zone'] || '').trim();
        if (zone && zone !== 'undefined') {
            if (!zoneAgeMap.has(zone)) zoneAgeMap.set(zone, { sum: 0, count: 0 });
            const z = zoneAgeMap.get(zone);
            z.sum += ageVal;
            z.count++;
        }
    });

    const totalWithAge = validAges.length;
    const avgAge = totalWithAge > 0 ? (validAges.reduce((a, b) => a + b, 0) / totalWithAge).toFixed(1) : '44.9';
    const youthCount = brackets['under35'].count;
    const youthPct = totalWithAge > 0 ? ((youthCount / totalWithAge) * 100).toFixed(1) : '0.0';
    const primeCount = brackets['35to44'].count + brackets['45to54'].count;
    const primePct = totalWithAge > 0 ? ((primeCount / totalWithAge) * 100).toFixed(1) : '0.0';
    const seniorCount = brackets['55to64'].count + brackets['65plus'].count;
    const seniorPct = totalWithAge > 0 ? ((seniorCount / totalWithAge) * 100).toFixed(1) : '0.0';

    // 1. Age KPIs
    if (ageKpiRow) {
        ageKpiRow.innerHTML = `
            <div class="analytics-kpi-box youth">
                <span class="analytics-kpi-lbl">Average Candidate Age</span>
                <div class="analytics-kpi-val">${avgAge} <span style="font-size: 14px; font-weight:600; color:var(--text-muted);">Yrs</span></div>
                <span class="analytics-kpi-sub">Across ${totalWithAge} candidates with age data</span>
            </div>
            <div class="analytics-kpi-box success">
                <span class="analytics-kpi-lbl">Youth Representation (<35)</span>
                <div class="analytics-kpi-val text-success">${youthCount} <span style="font-size: 14px; font-weight:600; color:var(--text-muted);">(${youthPct}%)</span></div>
                <span class="analytics-kpi-sub">Young grassroots leaders</span>
            </div>
            <div class="analytics-kpi-box">
                <span class="analytics-kpi-lbl">Prime Age (35 – 54 Yrs)</span>
                <div class="analytics-kpi-val text-primary">${primeCount} <span style="font-size: 14px; font-weight:600; color:var(--text-muted);">(${primePct}%)</span></div>
                <span class="analytics-kpi-sub">Experienced middle leadership</span>
            </div>
            <div class="analytics-kpi-box warning">
                <span class="analytics-kpi-lbl">Senior Cadre (55+ Yrs)</span>
                <div class="analytics-kpi-val text-warning">${seniorCount} <span style="font-size: 14px; font-weight:600; color:var(--text-muted);">(${seniorPct}%)</span></div>
                <span class="analytics-kpi-sub">Panchayat veterans & elders</span>
            </div>
        `;
    }

    // 2. Age Histogram Bars
    const maxBracketCount = Math.max(...Object.values(brackets).map(b => b.count), 1);
    ageHistogramContainer.innerHTML = Object.values(brackets).map(b => {
        const pct = totalWithAge > 0 ? ((b.count / totalWithAge) * 100).toFixed(1) : '0.0';
        const barWidth = ((b.count / maxBracketCount) * 100).toFixed(1);
        return `
            <div class="age-bracket-row">
                <div class="age-bracket-header">
                    <span class="age-bracket-label">${b.label}</span>
                    <div class="age-bracket-numbers">
                        <span class="age-bracket-count">${b.count}</span>
                        <span class="age-bracket-pct">(${pct}%)</span>
                    </div>
                </div>
                <div class="age-bracket-track">
                    <div class="age-bracket-fill ${b.class}" style="width: ${barWidth}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    // 3. Zone Average Age Leaderboard
    if (zoneAgeList) {
        const sortedZones = Array.from(zoneAgeMap.entries())
            .map(([z, d]) => ({ zone: z, avg: (d.sum / d.count).toFixed(1), count: d.count }))
            .sort((a, b) => parseFloat(a.avg) - parseFloat(b.avg));

        zoneAgeList.innerHTML = sortedZones.map((z, idx) => `
            <div class="zone-ranking-item">
                <span class="zone-rank-title">#${idx + 1} ${z.zone} Zone</span>
                <span class="zone-rank-val font-bold ${parseFloat(z.avg) < 43 ? 'text-success' : 'text-primary'}">${z.avg} Yrs <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(${z.count} cand.)</span></span>
            </div>
        `).join('');
    }
}

// -------------------------------------------
// 3. Gender Representation & Women Quota
// -------------------------------------------
function detectCandidateGender(row) {
    const reservation = String(row['Seat Reservation Status'] || '').toLowerCase();
    if (reservation.includes('mahila') || reservation.includes('महिला') || reservation.includes('female') || reservation.includes('women')) {
        return 'Female';
    }

    const name = String(row['Probable ZP Candidate Name'] || '').toLowerCase();
    const femaleKeywords = [
        'devi', 'kumari', 'khatoon', 'begum', 'bibi', 'bano', 'khatun', 'fatima', 
        'parveen', 'munni', 'shanti', 'sunita', 'anita', 'pooja', 'rekha', 'renu', 
        'suman', 'kiran', 'manju', 'geeta', 'sita', 'urmila', 'lalita', 'arti', 
        'chanda', 'usha', 'meena', 'poonam', 'mamta', 'sarita', 'kanchan', 'anupama', 
        'pushpa', 'shobha', 'priyanka', 'anjali', 'vandana', 'archana', 'nitu', 
        'ranjana', 'kalawati', 'sharda', 'radha', 'ruby', 'pinki', 'sangeeta', 
        'kusum', 'mira', 'meera', 'tara', 'asha', 'babita', 'gita', 'pratibha', 
        'dropadi', 'savita', 'kanti', 'champa', 'rina', 'reena', 'madhu', 'mamata',
        'nagma', 'rubi', 'sabana', 'shabana', 'tarannum', 'yasmin', 'raushan'
    ];

    const words = name.split(/[\s,.-]+/);
    for (const w of words) {
        if (femaleKeywords.includes(w)) return 'Female';
    }

    const profile = String(row['Brief Profile'] || '').toLowerCase();
    if (profile.includes('महिला') || profile.includes('पत्नी') || profile.includes('she') || profile.includes('her') || profile.includes('बेटी') || profile.includes('बहू')) {
        return 'Female';
    }

    return 'Male';
}

function renderGenderAnalytics(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    const genderKpiRow = document.getElementById('genderKpiRow');
    const genderSplitBarContainer = document.getElementById('genderRatioVisual') || document.getElementById('genderSplitBarContainer');
    const zoneGenderBody = document.getElementById('zoneGenderBody');

    if (!genderSplitBarContainer) return;

    let femaleCount = 0;
    let maleCount = 0;
    let femaleInOpenSeats = 0;
    const uniqueSeats = new Set();
    let womenReservedSeats = 0;
    const zoneGenderMap = new Map();

    candidateRows.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const res = String(row['Seat Reservation Status'] || '').toLowerCase();
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        const isWomenSeat = res.includes('mahila') || res.includes('महिला') || res.includes('female');

        if (seat && !uniqueSeats.has(seat)) {
            uniqueSeats.add(seat);
            if (isWomenSeat) womenReservedSeats++;
        }

        if (candName && candName !== 'undefined') {
            const gender = detectCandidateGender(row);
            if (gender === 'Female') {
                femaleCount++;
                if (!isWomenSeat) femaleInOpenSeats++;
            } else {
                maleCount++;
            }

            const zone = String(row['Zone'] || '').trim();
            if (zone && zone !== 'undefined') {
                if (!zoneGenderMap.has(zone)) {
                    zoneGenderMap.set(zone, { total: 0, female: 0, male: 0 });
                }
                const z = zoneGenderMap.get(zone);
                z.total++;
                if (gender === 'Female') z.female++;
                else z.male++;
            }
        }
    });

    const totalCandidates = femaleCount + maleCount;
    const femalePct = totalCandidates > 0 ? ((femaleCount / totalCandidates) * 100).toFixed(1) : '0.0';
    const malePct = totalCandidates > 0 ? ((maleCount / totalCandidates) * 100).toFixed(1) : '0.0';
    const totalSeats = uniqueSeats.size;
    const womenQuotaPct = totalSeats > 0 ? ((womenReservedSeats / totalSeats) * 100).toFixed(1) : '50.0';

    // 1. Gender KPIs
    if (genderKpiRow) {
        genderKpiRow.innerHTML = `
            <div class="analytics-kpi-box female">
                <span class="analytics-kpi-lbl">Female Candidates</span>
                <div class="analytics-kpi-val text-female">${femaleCount} <span style="font-size:14px; font-weight:600;">(${femalePct}%)</span></div>
                <span class="analytics-kpi-sub">Active women leaders shortlisted</span>
            </div>
            <div class="analytics-kpi-box male">
                <span class="analytics-kpi-lbl">Male Candidates</span>
                <div class="analytics-kpi-val text-male">${maleCount} <span style="font-size:14px; font-weight:600;">(${malePct}%)</span></div>
                <span class="analytics-kpi-sub">Male candidate profiles</span>
            </div>
            <div class="analytics-kpi-box">
                <span class="analytics-kpi-lbl">Women Reserved Seats</span>
                <div class="analytics-kpi-val text-primary">${womenReservedSeats} <span style="font-size:14px; font-weight:600; color:var(--text-muted);">${womenQuotaPct}%</span></div>
                <span class="analytics-kpi-sub">50% Statutory Panchayati Raj Quota</span>
            </div>
            <div class="analytics-kpi-box success">
                <span class="analytics-kpi-lbl">Women in Open / UR Seats</span>
                <div class="analytics-kpi-val text-success">${femaleInOpenSeats}</div>
                <span class="analytics-kpi-sub">Contesting outside reserved quota</span>
            </div>
        `;
    }

    // 2. Gender Split Bar
    genderSplitBarContainer.innerHTML = `
        <div class="gender-meter-wrapper">
            <div class="gender-split-bar-track">
                <div class="gender-bar-female" style="width: ${femalePct}%;">
                    Female ${femalePct}% (${femaleCount})
                </div>
                <div class="gender-bar-male" style="width: ${malePct}%;">
                    Male ${malePct}% (${maleCount})
                </div>
                <div class="statutory-quota-line" title="50% Bihar Statutory Women Reservation Quota"></div>
            </div>
            <div class="gender-legend-row">
                <div class="gender-legend-item">
                    <span class="gender-dot female"></span>
                    <span>Women Candidates: <strong>${femaleCount} (${femalePct}%)</strong></span>
                </div>
                <div class="gender-legend-item">
                    <span class="gender-dot male"></span>
                    <span>Men Candidates: <strong>${maleCount} (${malePct}%)</strong></span>
                </div>
                <div class="gender-quota-tag" title="Statutory 50% Women Reservation in Bihar Panchayati Raj">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 14 14"></polyline>
                    </svg>
                    <span>50.0% Statutory Quota Benchmark</span>
                </div>
            </div>
        </div>
    `;

    // 3. Zone Gender Table
    if (zoneGenderBody) {
        const sortedZoneGender = Array.from(zoneGenderMap.entries()).map(([z, d]) => ({
            zone: z,
            total: d.total,
            female: d.female,
            male: d.male,
            pct: d.total > 0 ? ((d.female / d.total) * 100).toFixed(1) : '0.0'
        })).sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));

        zoneGenderBody.innerHTML = sortedZoneGender.map(z => `
            <tr>
                <td><strong>${z.zone}</strong></td>
                <td class="num-col font-bold">${z.total}</td>
                <td class="num-col font-bold text-female">${z.female}</td>
                <td class="num-col text-male">${z.male}</td>
                <td class="num-col font-bold text-female">${z.pct}%</td>
            </tr>
        `).join('');
    }
}

// -------------------------------------------
// 4. Seat Readiness & Depth Analytics
// -------------------------------------------
function renderReadinessAnalytics(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    const readinessKpiRow = document.getElementById('readinessKpiRow');
    const densityChartContainer = document.getElementById('densityChartContainer');
    const zoneReadinessList = document.getElementById('zoneReadinessList');

    if (!densityChartContainer) return;

    const seatMap = new Map();
    const zoneMap = new Map();

    candidateRows.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        const zone = String(row['Zone'] || '').trim();

        if (!seat || seat === 'undefined') return;

        if (!seatMap.has(seat)) seatMap.set(seat, 0);
        if (candName && candName !== 'undefined') {
            seatMap.set(seat, seatMap.get(seat) + 1);
        }

        if (zone && zone !== 'undefined') {
            if (!zoneMap.has(zone)) {
                zoneMap.set(zone, { seats: new Set(), candCounts: new Map() });
            }
            const z = zoneMap.get(zone);
            z.seats.add(seat);
            if (!z.candCounts.has(seat)) z.candCounts.set(seat, 0);
            if (candName && candName !== 'undefined') {
                z.candCounts.set(seat, z.candCounts.get(seat) + 1);
            }
        }
    });

    const totalSeats = seatMap.size;
    let gapCount = 0;
    let singleCount = 0;
    let twoCount = 0;
    let threeCount = 0;
    let fourPlusCount = 0;

    seatMap.forEach(count => {
        if (count === 0) gapCount++;
        else if (count === 1) singleCount++;
        else if (count === 2) twoCount++;
        else if (count === 3) threeCount++;
        else if (count >= 4) fourPlusCount++;
    });

    const multiTotal = twoCount + threeCount + fourPlusCount;
    const multiPct = totalSeats > 0 ? ((multiTotal / totalSeats) * 100).toFixed(1) : '0.0';
    const singlePct = totalSeats > 0 ? ((singleCount / totalSeats) * 100).toFixed(1) : '0.0';
    const gapPct = totalSeats > 0 ? ((gapCount / totalSeats) * 100).toFixed(1) : '0.0';
    const completionPct = totalSeats > 0 ? ((((singleCount + multiTotal) + multiTotal) / (totalSeats * 2)) * 100).toFixed(1) : '0.0';

    // 1. Readiness KPIs
    if (readinessKpiRow) {
        readinessKpiRow.innerHTML = `
            <div class="analytics-kpi-box success">
                <span class="analytics-kpi-lbl">Target Met (2+ Contenders)</span>
                <div class="analytics-kpi-val text-success">${multiTotal} <span style="font-size:14px; font-weight:600;">(${multiPct}%)</span></div>
                <span class="analytics-kpi-sub">Multiple contenders shortlisted</span>
            </div>
            <div class="analytics-kpi-box">
                <span class="analytics-kpi-lbl">Single Contender Seats</span>
                <div class="analytics-kpi-val text-primary">${singleCount} <span style="font-size:14px; font-weight:600; color:var(--text-muted);">(${singlePct}%)</span></div>
                <span class="analytics-kpi-sub">1 contender identified</span>
            </div>
            <div class="analytics-kpi-box warning">
                <span class="analytics-kpi-lbl">Gap Seats (0 Contenders)</span>
                <div class="analytics-kpi-val text-danger">${gapCount} <span style="font-size:14px; font-weight:600; color:var(--text-muted);">(${gapPct}%)</span></div>
                <span class="analytics-kpi-sub">Urgent attention needed</span>
            </div>
            <div class="analytics-kpi-box">
                <span class="analytics-kpi-lbl">Overall Readiness Index</span>
                <div class="analytics-kpi-val text-success">${completionPct}%</div>
                <span class="analytics-kpi-sub">Based on 2 candidates per seat standard</span>
            </div>
        `;
    }

    // 2. Contender Depth Chart
    const densityData = [
        { label: '0 Contenders (Gap Seats)', count: gapCount, class: 'density-gap' },
        { label: '1 Contender (Single Identified)', count: singleCount, class: 'density-1' },
        { label: '2 Contenders (Target Met)', count: twoCount, class: 'density-2' },
        { label: '3 Contenders (Strong Pool)', count: threeCount, class: 'density-3plus' },
        { label: '4+ Contenders (High Depth)', count: fourPlusCount, class: 'density-3plus' }
    ];

    const maxDensityCount = Math.max(...densityData.map(d => d.count), 1);
    densityChartContainer.innerHTML = densityData.map(d => {
        const pct = totalSeats > 0 ? ((d.count / totalSeats) * 100).toFixed(1) : '0.0';
        const width = ((d.count / maxDensityCount) * 100).toFixed(1);
        return `
            <div class="density-row">
                <div class="density-row-header">
                    <span class="density-row-title">${d.label}</span>
                    <span class="font-bold">${d.count} seats (${pct}%)</span>
                </div>
                <div class="density-track">
                    <div class="density-fill ${d.class}" style="width: ${width}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    // 3. Zone Readiness Leaderboard
    if (zoneReadinessList) {
        const zoneRankings = Array.from(zoneMap.entries()).map(([zone, d]) => {
            const zTotalSeats = d.seats.size;
            let zSeats1Plus = 0;
            let zSeats2Plus = 0;
            d.candCounts.forEach(c => {
                if (c >= 1) zSeats1Plus++;
                if (c >= 2) zSeats2Plus++;
            });
            const zPct = zTotalSeats > 0 ? (((zSeats1Plus + zSeats2Plus) / (zTotalSeats * 2)) * 100).toFixed(1) : '0.0';
            return { zone, totalSeats: zTotalSeats, seats1Plus: zSeats1Plus, seats2Plus: zSeats2Plus, pct: zPct };
        }).sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));

        zoneReadinessList.innerHTML = zoneRankings.map((z, idx) => `
            <div class="zone-ranking-item">
                <span class="zone-rank-title">#${idx + 1} ${z.zone} Zone</span>
                <span class="zone-rank-val font-bold ${parseFloat(z.pct) >= 80 ? 'text-success' : 'text-primary'}">${z.pct}% <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(${z.seats2Plus}/${z.totalSeats} multi)</span></span>
            </div>
        `).join('');
    }
}

// -------------------------------------------
// 5. Background & Sourcing Channels
// -------------------------------------------
function renderBackgroundAnalytics(data) {
    const candidateRows = (data && Array.isArray(data)) ? data : (typeof getFilteredCandidates === 'function' ? getFilteredCandidates(false) : candidatesData);
    const incumbentSplitContainer = document.getElementById('incumbentSplitContainer');
    const sourceRankingList = document.getElementById('sourceRankingList');
    const designationPillsCloud = document.getElementById('designationPillsCloud');

    if (!incumbentSplitContainer || !sourceRankingList) return;

    let sittingIncumbents = 0;
    let newFaces = 0;
    const sourceCounts = {};
    const desigCounts = {};
    let totalCandidates = 0;

    candidateRows.forEach(row => {
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (!candName || candName === 'undefined') return;

        totalCandidates++;
        const profile = String(row['Brief Profile'] || '').toLowerCase();
        const remarks = String(row['Remarks'] || '').toLowerCase();
        const jsDesig = String(row['JS Designation'] || '').toLowerCase();
        const source = String(row['Recommendation Source Categories'] || '').trim();

        // Incumbent check
        if (source.toLowerCase().includes('incumbent') || profile.includes('incumbent') || profile.includes('निवर्तमान') || remarks.includes('incumbent')) {
            sittingIncumbents++;
        } else {
            newFaces++;
        }

        // Source channel
        let src = source;
        if (!src || src === '-' || src === 'undefined') src = 'Other Channel';
        else {
            const l = src.toLowerCase();
            if (l.includes('sangathan')) src = 'Sangathan';
            else if (l.includes('onboard')) src = 'Onboarded Team';
            else if (l.includes('runner')) src = '1st Runner Up';
            else if (l.includes('incumbent')) src = 'Sitting Incumbent';
            else if (l.includes('acc')) src = 'ACC / Frontals';
            else if (l.includes('recommendation') || l.includes('new name')) src = 'Direct Recommendation';
        }
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;

        // Extract key local governance roles
        const text = `${jsDesig} ${profile} ${remarks}`;
        const roles = [
            { key: 'Mukhiya / Ex-Mukhiya', test: /मुखिया|mukhiya/ },
            { key: 'Up-Mukhiya', test: /उप[\s-]?मुखिया|up[\s-]?mukhiya/ },
            { key: 'Sarpanch / Ex-Sarpanch', test: /सरपंच|sarpanch/ },
            { key: 'Block Pramukh', test: /प्रमुख|pramukh/ },
            { key: 'PACS President', test: /पैक्स|pacs/ },
            { key: 'Samiti Sadasya (BDC)', test: /समिति[\s-]?सदस्य|bdc/ },
            { key: 'ZP Sadasya', test: /जिला[\s-]?परिषद[\s-]?सदस्य|zp[\s-]?member/ },
            { key: 'Social Worker', test: /समाजसेवी|social[\s-]?worker/ },
            { key: 'Youth / Student Leader', test: /युवा|छात्र|youth/ }
        ];

        roles.forEach(r => {
            if (r.test.test(text)) {
                desigCounts[r.key] = (desigCounts[r.key] || 0) + 1;
            }
        });
    });

    // 1. Incumbents Split Card
    const sittingPct = totalCandidates > 0 ? ((sittingIncumbents / totalCandidates) * 100).toFixed(1) : '0.0';
    const newPct = totalCandidates > 0 ? ((newFaces / totalCandidates) * 100).toFixed(1) : '0.0';

    incumbentSplitContainer.innerHTML = `
        <div class="incumbent-stat-grid">
            <div class="incumbent-mini-box">
                <strong class="text-primary">${sittingIncumbents}</strong>
                <span>Sitting Incumbents (${sittingPct}%)</span>
            </div>
            <div class="incumbent-mini-box">
                <strong class="text-success">${newFaces}</strong>
                <span>New / Emerging Faces (${newPct}%)</span>
            </div>
        </div>
        <div class="caste-bar-track" style="margin-top: 10px; height: 12px; border-radius: 6px; display: flex; overflow: hidden;">
            <div style="width: ${sittingPct}%; background: linear-gradient(90deg, #6366f1, #4338ca);" title="Sitting Incumbents: ${sittingIncumbents}"></div>
            <div style="width: ${newPct}%; background: linear-gradient(90deg, #10b981, #059669);" title="New Faces: ${newFaces}"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
            <span>🏛️ Sitting ZPs: ${sittingPct}%</span>
            <span>🌱 Fresh Entrants: ${newPct}%</span>
        </div>
    `;

    // 2. Sourcing Channels List
    const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
    const maxSource = sortedSources.length > 0 ? sortedSources[0][1] : 1;

    sourceRankingList.innerHTML = sortedSources.map(([src, count]) => {
        const pct = totalCandidates > 0 ? ((count / totalCandidates) * 100).toFixed(1) : '0.0';
        const width = ((count / maxSource) * 100).toFixed(1);
        return `
            <div class="caste-bar-item">
                <div class="caste-bar-meta">
                    <span class="caste-bar-name">${src}</span>
                    <div class="caste-bar-numbers">
                        <span class="caste-bar-count">${count}</span>
                        <span class="caste-bar-pct">(${pct}%)</span>
                    </div>
                </div>
                <div class="caste-bar-track">
                    <div class="caste-bar-fill" style="width: ${width}%; background: linear-gradient(90deg, #3b82f6, #06b6d4);"></div>
                </div>
            </div>
        `;
    }).join('');

    // 3. Designation Pills Cloud
    if (designationPillsCloud) {
        const sortedDesigs = Object.entries(desigCounts).sort((a, b) => b[1] - a[1]);
        if (sortedDesigs.length > 0) {
            designationPillsCloud.innerHTML = sortedDesigs.map(([role, count]) => `
                <span class="desig-pill">
                    <span>${role}</span>
                    <span class="desig-pill-count">${count}</span>
                </span>
            `).join('');
        } else {
            designationPillsCloud.innerHTML = '<span class="text-muted" style="font-size:12px;">Profiles being updated</span>';
        }
    }
}

// =========================================================
// DATA QUALITY & SHEET DISCREPANCY AUDIT ENGINE
// =========================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Determines which of the 3 live Google Sheets a candidate row originates from.
 */
function getSheetNameForRow(row) {
    if (row && row._sourceSheet) return row._sourceSheet;
    const zone = String(row && row.Zone ? row.Zone : '').trim().toLowerCase();
    const dist = String(row && row.District ? row.District : '').trim().toLowerCase();

    // Sheet 1: Champaran, Saran, Sahabad
    if (zone.includes('champaran') || zone.includes('saran') || zone.includes('sahabad') || zone.includes('shahabad')) {
        return 'Sheet 1 (Champaran, Saran, Sahabad)';
    }
    if (['east champaran', 'west champaran', 'bagaha', 'bettiah', 'motihari', 'saran', 'siwan', 'gopalganj', 'bhojpur', 'buxar', 'rohtas', 'kaimur (bhabhua)', 'kaimur'].includes(dist)) {
        return 'Sheet 1 (Champaran, Saran, Sahabad)';
    }

    // Sheet 2: Samastipur, Tirhut, Mithilanchal
    if (zone.includes('samastipur') || zone.includes('tirhut') || zone.includes('mithil') || zone.includes('darbhanga')) {
        return 'Sheet 2 (Samastipur, Tirhut, Mithilanchal)';
    }
    if (['samastipur', 'muzaffarpur', 'vaishali', 'sitamarhi', 'sheohar', 'darbhanga', 'madhubani', 'jhanjharpur'].includes(dist)) {
        return 'Sheet 2 (Samastipur, Tirhut, Mithilanchal)';
    }

    // Sheet 3: Munger, Magadh, Nalanda
    if (zone.includes('munger') || zone.includes('magadh') || zone.includes('nalanda') || zone.includes('patna')) {
        return 'Sheet 3 (Munger, Magadh, Nalanda)';
    }
    if (['munger', 'begusarai', 'khagaria', 'jamui', 'lakhisarai', 'sheikhpura', 'gaya', 'nawada', 'aurangabad', 'jehanabad', 'arwal', 'nalanda', 'patna', 'naugachhiya', 'bhagalpur', 'banka', 'purnea', 'katihar', 'araria', 'kishanganj', 'saharsa', 'madhepura', 'supaul'].includes(dist)) {
        return 'Sheet 3 (Munger, Magadh, Nalanda)';
    }

    return 'Google Sheet (All Zones)';
}

let cachedAuditDiscrepancies = [];

/**
 * Scans candidate and election datasets to identify data entry errors, column shifts, and invalid entries.
 */
function auditSheetData() {
    cachedAuditDiscrepancies = [];
    if (!candidatesData || candidatesData.length === 0) return;

    let auditId = 1;
    const affectedDistricts = new Set();

    candidatesData.forEach((row, rowIndex) => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        const district = String(row['District'] || '').trim();
        const zone = String(row['Zone'] || '').trim();
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        const sheet = getSheetNameForRow(row);

        // Skip placeholder or empty rows
        if (!candName && !seat) return;

        // 1. Candidate Name checks
        if (candName.toLowerCase() === 'general') {
            affectedDistricts.add(district);
            cachedAuditDiscrepancies.push({
                id: auditId++,
                sheet: sheet,
                district: district,
                zone: zone,
                seat: seat,
                candidate: candName,
                field: 'Candidate Name',
                badValue: candName,
                severity: 'critical',
                severityLabel: '🚨 Critical Column Shift',
                issueType: 'critical',
                description: "Category value 'General' was mistakenly entered into the Candidate Name column.",
                suggestedAction: "Check original sheet row: place actual candidate name in Name column, and 'General' in Category column."
            });
        }

        // 2. Category column checks
        const rawCat = String(row['Category'] || '').trim();
        if (rawCat) {
            // Check if phone number (10 digits starting with 6-9)
            if (/^[6-9]\d{9}$/.test(rawCat)) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Category',
                    badValue: rawCat,
                    severity: 'critical',
                    severityLabel: '🚨 Critical Column Shift',
                    issueType: 'critical',
                    description: `Phone number '${rawCat}' was entered into the Category column instead of Contact No.`,
                    suggestedAction: `Move '${rawCat}' to Contact No, and fill social category (General / OBC / EBC / SC / ST / Minority).`
                });
            }
            // Check if age / number (e.g. 48, 53)
            else if (/^\d{1,3}$/.test(rawCat)) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Category',
                    badValue: rawCat,
                    severity: 'critical',
                    severityLabel: '🚨 Critical Column Shift',
                    issueType: 'critical',
                    description: `Candidate Age or numeric value '${rawCat}' was entered into the Category column.`,
                    suggestedAction: `Move '${rawCat}' to Age column, and fill the true social category in Category column.`
                });
            }
            // Check if arbitrary non-category remarks/gender
            else if (['bdc ladenge', 'identify', 'male', 'female', 'yes', 'no'].includes(rawCat.toLowerCase())) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Category',
                    badValue: rawCat,
                    severity: 'critical',
                    severityLabel: '🚨 Invalid Category Entry',
                    issueType: 'critical',
                    description: `Non-category text or remark '${rawCat}' entered in Category column.`,
                    suggestedAction: `Move remark to Remarks / Brief Profile, and specify category (General/OBC/EBC/SC/ST/Minority).`
                });
            }
            // Check spelling variations of General
            else if (['gen', 'genral', 'genernal', 'generaal', 'सामान्य'].includes(rawCat.toLowerCase()) || rawCat === 'GEN') {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Category',
                    badValue: rawCat,
                    severity: 'info',
                    severityLabel: 'ℹ️ Spelling Inconsistency',
                    issueType: 'spelling',
                    description: `Spelling variant '${rawCat}' used instead of standard 'General'.`,
                    suggestedAction: `Standardize cell to 'General' in Google Sheet for consistent reporting.`
                });
            }
            // Check spelling variations of Minority
            else if (['minoriy', 'monority', 'अल्पसंख्यक', 'muslim'].includes(rawCat.toLowerCase())) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Category',
                    badValue: rawCat,
                    severity: 'info',
                    severityLabel: 'ℹ️ Spelling Inconsistency',
                    issueType: 'spelling',
                    description: `Minority spelling variant or term '${rawCat}' used instead of 'Minority'.`,
                    suggestedAction: `Standardize cell to 'Minority' in Google Sheet.`
                });
            }
        }

        // 3. Age column checks
        const rawAge = String(row['Age'] || '').trim();
        if (rawAge && rawAge !== '-' && rawAge !== 'NA') {
            const ageNum = parseInt(rawAge);
            if (isNaN(ageNum)) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Age',
                    badValue: rawAge,
                    severity: 'critical',
                    severityLabel: '🚨 Critical Column Shift',
                    issueType: 'age',
                    description: `Non-numeric text or designation '${rawAge}' was entered into the Age column.`,
                    suggestedAction: `Move text '${rawAge}' to Brief Profile or Remarks, and enter integer age (e.g. 42).`
                });
            } else if (ageNum < 21 || ageNum > 95) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Age',
                    badValue: rawAge,
                    severity: 'warning',
                    severityLabel: '⚠️ Abnormal Age Range',
                    issueType: 'age',
                    description: `Candidate age '${rawAge}' is outside normal electoral age bounds (21 to 90 yrs).`,
                    suggestedAction: `Verify and correct candidate birth year or age in Google Sheet.`
                });
            }
        }

        // 4. Contact No. column checks
        const rawPhone = String(row['Contact No'] || '').trim();
        if (rawPhone && rawPhone !== '-' && rawPhone !== 'NA' && rawPhone !== '0' && rawPhone !== 'null') {
            const digits = rawPhone.replace(/\D/g, '');
            
            // Check if text value / candidate name / caste placed in Contact No (e.g. 'Bhumiar', 'Rohit Kumar', 'Mukhiya Runner up')
            if (digits.length < 5 && /[a-zA-Z\u0900-\u097F]/.test(rawPhone)) {
                affectedDistricts.add(district);
                cachedAuditDiscrepancies.push({
                    id: auditId++,
                    sheet: sheet,
                    district: district,
                    zone: zone,
                    seat: seat,
                    candidate: candName,
                    field: 'Contact No',
                    badValue: rawPhone,
                    severity: 'critical',
                    severityLabel: '🚨 Critical Column Shift',
                    issueType: 'contact',
                    description: `Text or non-numeric remark '${rawPhone}' was placed in Contact No column.`,
                    suggestedAction: `Move '${rawPhone}' to Caste/Profile/Remarks column, and enter candidate mobile number.`
                });
            } else {
                // Split on multiple separators: /, //, \, newline, comma, &, ;, etc.
                // 2 mobile numbers are understood and valid as long as each number conforms to standard 10 digits
                const phoneParts = rawPhone.split(/[\/\,\n\r\\\\;&]+/).map(s => s.trim()).filter(Boolean);
                
                const isValidIndianMobile = (str) => {
                    let d = str.replace(/\D/g, '');
                    if (d.length === 12 && d.startsWith('91')) d = d.substring(2);
                    if (d.length === 11 && d.startsWith('0')) d = d.substring(1);
                    return d.length === 10 && ['6', '7', '8', '9'].includes(d.charAt(0));
                };

                const invalidParts = phoneParts.filter(p => !isValidIndianMobile(p));
                
                // Only flag if there is a genuinely invalid, truncated, or malformed phone segment
                if (phoneParts.length > 0 && invalidParts.length > 0) {
                    affectedDistricts.add(district);
                    cachedAuditDiscrepancies.push({
                        id: auditId++,
                        sheet: sheet,
                        district: district,
                        zone: zone,
                        seat: seat,
                        candidate: candName,
                        field: 'Contact No',
                        badValue: rawPhone,
                        severity: 'warning',
                        severityLabel: '⚠️ Invalid Phone Number',
                        issueType: 'contact',
                        description: `Phone entry contains invalid or incomplete mobile number (${invalidParts.join(', ')}).`,
                        suggestedAction: `Ensure each mobile number has 10 digits starting with 6, 7, 8, or 9.`
                    });
                }
            }
        }
    });

    // Update KPI numbers & Badges
    const totalCount = cachedAuditDiscrepancies.length;
    const criticalCount = cachedAuditDiscrepancies.filter(d => d.severity === 'critical').length;
    const spellingCount = cachedAuditDiscrepancies.filter(d => d.issueType === 'spelling').length;
    const phoneCount = cachedAuditDiscrepancies.filter(d => d.issueType === 'contact').length;
    const districtsCount = affectedDistricts.size;

    const badgeEl = document.getElementById('auditBadgeCount');
    if (badgeEl) badgeEl.textContent = totalCount;
    const mobBadgeEl = document.getElementById('mobAuditBadge');
    if (mobBadgeEl) {
        mobBadgeEl.textContent = totalCount;
        mobBadgeEl.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    const kpiTotalEl = document.getElementById('kpiAuditTotal');
    if (kpiTotalEl) kpiTotalEl.textContent = totalCount;
    const kpiCritEl = document.getElementById('kpiAuditCritical');
    if (kpiCritEl) kpiCritEl.textContent = criticalCount;
    const kpiSpellEl = document.getElementById('kpiAuditSpelling');
    if (kpiSpellEl) kpiSpellEl.textContent = spellingCount;
    const kpiPhoneEl = document.getElementById('kpiAuditPhone');
    if (kpiPhoneEl) kpiPhoneEl.textContent = phoneCount;
    const kpiDistEl = document.getElementById('kpiAuditDistricts');
    if (kpiDistEl) kpiDistEl.textContent = districtsCount;

    // Initialize cascading dependent filters and render table
    updateAuditDependentFilters('init');
    renderAuditTable();
}

/**
 * Updates dependent cascading dropdowns in Data Audit:
 * Sheet -> District (only districts in selected Sheet with errors)
 *       -> ZP Seat (only seats in selected District with errors)
 *       -> Issue Type (only issue types present in selected selection)
 * Solved or 0-error items are never shown in dropdowns so users never encounter empty states.
 */
function updateAuditDependentFilters(trigger = 'sheet') {
    const sheetSelect = document.getElementById('auditSheetFilter');
    const distSelect = document.getElementById('auditDistrictFilter');
    const seatSelect = document.getElementById('auditSeatFilter');
    const typeSelect = document.getElementById('auditTypeFilter');

    if (!sheetSelect || !distSelect) return;

    const currentSheet = (sheetSelect.value || '').trim();
    let currentDist = (distSelect.value || '').trim();
    let currentSeat = seatSelect ? (seatSelect.value || '').trim() : '';
    let currentType = typeSelect ? (typeSelect.value || '').trim() : '';

    // 1. Update Sheet options with live error counts
    const sheetCounts = { 'Sheet 1': 0, 'Sheet 2': 0, 'Sheet 3': 0 };
    cachedAuditDiscrepancies.forEach(d => {
        if (d.sheet.includes('Sheet 1')) sheetCounts['Sheet 1']++;
        else if (d.sheet.includes('Sheet 2')) sheetCounts['Sheet 2']++;
        else if (d.sheet.includes('Sheet 3')) sheetCounts['Sheet 3']++;
    });

    const sheetOpts = sheetSelect.options;
    if (sheetOpts.length >= 4) {
        sheetOpts[0].text = `All Sheets (${cachedAuditDiscrepancies.length} Total Errors)`;
        sheetOpts[1].text = `Sheet 1 (Champaran, Saran, Sahabad) [${sheetCounts['Sheet 1']} errors]`;
        sheetOpts[2].text = `Sheet 2 (Samastipur, Tirhut, Mithilanchal) [${sheetCounts['Sheet 2']} errors]`;
        sheetOpts[3].text = `Sheet 3 (Munger, Magadh, Nalanda) [${sheetCounts['Sheet 3']} errors]`;
    }

    // 2. Filter discrepancies available for District level based on selected Sheet
    let poolForDist = cachedAuditDiscrepancies;
    if (currentSheet) {
        poolForDist = poolForDist.filter(d => d.sheet.toLowerCase().includes(currentSheet.toLowerCase()));
    }

    // Find all districts in this pool that actually have errors
    const distCounts = {};
    poolForDist.forEach(d => {
        if (d.district && d.district !== '-') {
            distCounts[d.district] = (distCounts[d.district] || 0) + 1;
        }
    });

    const validDists = Object.keys(distCounts).sort();
    if (trigger === 'sheet' || trigger === 'reset' || trigger === 'init') {
        if (!validDists.includes(currentDist)) {
            currentDist = '';
            distSelect.value = '';
        }
    }

    distSelect.innerHTML = `<option value="">All Districts (${validDists.length} with errors)</option>` +
        validDists.map(d => `<option value="${d}" ${d === currentDist ? 'selected' : ''}>${d} (${distCounts[d]} error${distCounts[d] > 1 ? 's' : ''})</option>`).join('');

    // 3. Filter discrepancies available for ZP Seat level based on selected District
    let poolForSeat = poolForDist;
    if (currentDist) {
        poolForSeat = poolForSeat.filter(d => d.district.toLowerCase() === currentDist.toLowerCase());
    }

    if (seatSelect) {
        const seatCounts = {};
        poolForSeat.forEach(d => {
            if (d.seat && d.seat !== '-') {
                seatCounts[d.seat] = (seatCounts[d.seat] || 0) + 1;
            }
        });

        const validSeats = Object.keys(seatCounts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (trigger === 'sheet' || trigger === 'district' || trigger === 'reset' || trigger === 'init') {
            if (!validSeats.includes(currentSeat)) {
                currentSeat = '';
                seatSelect.value = '';
            }
        }

        seatSelect.innerHTML = `<option value="">All Seats with Errors (${validSeats.length})</option>` +
            validSeats.map(s => `<option value="${s}" ${s === currentSeat ? 'selected' : ''}>${s} (${seatCounts[s]} error${seatCounts[s] > 1 ? 's' : ''})</option>`).join('');
    }

    // 4. Filter discrepancies available for Issue Type level based on selected Seat
    let poolForType = poolForSeat;
    if (currentSeat) {
        poolForType = poolForType.filter(d => d.seat.toLowerCase() === currentSeat.toLowerCase());
    }

    if (typeSelect) {
        const typeCounts = { critical: 0, spelling: 0, contact: 0, age: 0 };
        poolForType.forEach(d => {
            if (d.severity === 'critical') typeCounts.critical++;
            if (d.issueType === 'spelling') typeCounts.spelling++;
            if (d.issueType === 'contact') typeCounts.contact++;
            if (d.issueType === 'age' && d.severity !== 'critical') typeCounts.age++;
        });

        // If currentType has 0 errors in this pool, reset it
        if (currentType && (!typeCounts[currentType] || typeCounts[currentType] === 0)) {
            currentType = '';
            typeSelect.value = '';
        }

        let typeHtml = `<option value="">All Issue Types (${poolForType.length})</option>`;
        if (typeCounts.critical > 0) {
            typeHtml += `<option value="critical" ${currentType === 'critical' ? 'selected' : ''}>🚨 Critical Column Shifts (${typeCounts.critical})</option>`;
        }
        if (typeCounts.spelling > 0) {
            typeHtml += `<option value="spelling" ${currentType === 'spelling' ? 'selected' : ''}>✏️ Category Spelling Inconsistencies (${typeCounts.spelling})</option>`;
        }
        if (typeCounts.contact > 0) {
            typeHtml += `<option value="contact" ${currentType === 'contact' ? 'selected' : ''}>📞 Invalid Phone Numbers (${typeCounts.contact})</option>`;
        }
        if (typeCounts.age > 0) {
            typeHtml += `<option value="age" ${currentType === 'age' ? 'selected' : ''}>🎂 Age Anomalies (${typeCounts.age})</option>`;
        }
        typeSelect.innerHTML = typeHtml;
    }
}

/**
 * Renders the filtered discrepancy audit rows into the audit table.
 */
function renderAuditTable() {
    const tbody = document.getElementById('auditTableBody');
    const resultCountEl = document.getElementById('auditResultCount');
    if (!tbody) return;

    const sheetFilter = (document.getElementById('auditSheetFilter') ? document.getElementById('auditSheetFilter').value : '').trim();
    const districtFilter = (document.getElementById('auditDistrictFilter') ? document.getElementById('auditDistrictFilter').value : '').trim();
    const seatFilter = (document.getElementById('auditSeatFilter') ? document.getElementById('auditSeatFilter').value : '').trim();
    const typeFilter = (document.getElementById('auditTypeFilter') ? document.getElementById('auditTypeFilter').value : '').trim();
    const searchInput = (document.getElementById('auditSearchInput') ? document.getElementById('auditSearchInput').value : '').trim().toLowerCase();

    let list = cachedAuditDiscrepancies;

    if (sheetFilter) {
        list = list.filter(d => d.sheet.toLowerCase().includes(sheetFilter.toLowerCase()));
    }
    if (districtFilter) {
        list = list.filter(d => d.district.toLowerCase() === districtFilter.toLowerCase());
    }
    if (seatFilter) {
        list = list.filter(d => d.seat.toLowerCase() === seatFilter.toLowerCase());
    }
    if (typeFilter) {
        if (typeFilter === 'critical') list = list.filter(d => d.severity === 'critical');
        else if (typeFilter === 'spelling') list = list.filter(d => d.issueType === 'spelling');
        else if (typeFilter === 'contact') list = list.filter(d => d.issueType === 'contact');
        else if (typeFilter === 'age') list = list.filter(d => d.issueType === 'age');
    }
    if (searchInput) {
        list = list.filter(d => 
            d.candidate.toLowerCase().includes(searchInput) ||
            d.seat.toLowerCase().includes(searchInput) ||
            d.district.toLowerCase().includes(searchInput) ||
            d.badValue.toLowerCase().includes(searchInput) ||
            d.description.toLowerCase().includes(searchInput) ||
            d.field.toLowerCase().includes(searchInput)
        );
    }

    if (resultCountEl) {
        const filterHints = [];
        if (sheetFilter) filterHints.push(sheetFilter.split('(')[0].trim());
        if (districtFilter) filterHints.push(districtFilter);
        if (seatFilter) filterHints.push(seatFilter);
        if (typeFilter) filterHints.push(typeFilter);
        const filterStr = filterHints.length > 0 ? ` (Filtered: ${filterHints.join(' > ')})` : '';
        resultCountEl.textContent = `Showing ${list.length} of ${cachedAuditDiscrepancies.length} discrepancies${filterStr}`;
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="audit-empty-state">✅ No discrepancies match your selected filters!</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((d, index) => {
        let sheetClass = 'sheet-1';
        if (d.sheet.includes('Sheet 2')) sheetClass = 'sheet-2';
        else if (d.sheet.includes('Sheet 3')) sheetClass = 'sheet-3';

        let sevClass = 'audit-severity-info';
        if (d.severity === 'critical') sevClass = 'audit-severity-critical';
        else if (d.severity === 'warning') sevClass = 'audit-severity-warning';

        return `
            <tr>
                <td style="font-weight:700; color:var(--text-muted);">${index + 1}</td>
                <td><span class="audit-sheet-badge ${sheetClass}">${d.sheet.split('(')[0].trim()}</span></td>
                <td><strong>${d.district || '-'}</strong>${d.zone ? ` <span style="font-size:10px; color:var(--text-muted);">(${d.zone})</span>` : ''}</td>
                <td><strong style="color:var(--primary); font-family: 'JetBrains Mono', monospace;">${d.seat || '-'}</strong></td>
                <td><strong>${d.candidate || '(Blank Name)'}</strong></td>
                <td><span style="font-weight:700; color:#0f172a;">${d.field}</span></td>
                <td><span class="audit-bad-val">${escapeHtml(d.badValue)}</span></td>
                <td>
                    <span class="audit-severity-badge ${sevClass}">${d.severityLabel}</span>
                    <div style="font-size:11px; color:#475569; margin-top:3px;">${d.description}</div>
                </td>
                <td><span class="audit-fix-suggestion">💡 ${d.suggestedAction}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Generates and downloads a clean Excel file (.xlsx) containing filtered or all data discrepancies for ground operators.
 */
function exportAuditToExcel() {
    if (!cachedAuditDiscrepancies || cachedAuditDiscrepancies.length === 0) {
        alert("No discrepancies to export!");
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert("SheetJS library is not loaded. Cannot generate Excel file.");
        return;
    }

    const sheetFilter = (document.getElementById('auditSheetFilter') ? document.getElementById('auditSheetFilter').value : '').trim();
    const districtFilter = (document.getElementById('auditDistrictFilter') ? document.getElementById('auditDistrictFilter').value : '').trim();
    const seatFilter = (document.getElementById('auditSeatFilter') ? document.getElementById('auditSeatFilter').value : '').trim();
    const typeFilter = (document.getElementById('auditTypeFilter') ? document.getElementById('auditTypeFilter').value : '').trim();
    const searchInput = (document.getElementById('auditSearchInput') ? document.getElementById('auditSearchInput').value : '').trim().toLowerCase();

    let list = cachedAuditDiscrepancies;
    if (sheetFilter) list = list.filter(d => d.sheet.toLowerCase().includes(sheetFilter.toLowerCase()));
    if (districtFilter) list = list.filter(d => d.district.toLowerCase() === districtFilter.toLowerCase());
    if (seatFilter) list = list.filter(d => d.seat.toLowerCase() === seatFilter.toLowerCase());
    if (typeFilter) {
        if (typeFilter === 'critical') list = list.filter(d => d.severity === 'critical');
        else if (typeFilter === 'spelling') list = list.filter(d => d.issueType === 'spelling');
        else if (typeFilter === 'contact') list = list.filter(d => d.issueType === 'contact');
        else if (typeFilter === 'age') list = list.filter(d => d.issueType === 'age');
    }
    if (searchInput) {
        list = list.filter(d => 
            d.candidate.toLowerCase().includes(searchInput) ||
            d.seat.toLowerCase().includes(searchInput) ||
            d.district.toLowerCase().includes(searchInput) ||
            d.badValue.toLowerCase().includes(searchInput) ||
            d.description.toLowerCase().includes(searchInput) ||
            d.field.toLowerCase().includes(searchInput)
        );
    }

    let fileName = "ZP_Dashboard_Data_Error_Report.xlsx";
    if (sheetFilter) {
        const cleanSheet = sheetFilter.split('(')[0].trim().replace(/\s+/g, '_');
        fileName = `ZP_Errors_${cleanSheet}${districtFilter ? '_' + districtFilter.replace(/\s+/g, '_') : ''}.xlsx`;
    }

    const exportRows = list.map((d, idx) => ({
        '#': idx + 1,
        'Google Sheet': d.sheet,
        'Zone': d.zone,
        'District': d.district,
        'ZP Seat Number': d.seat,
        'Candidate Name': d.candidate,
        'Field with Issue': d.field,
        'Value in Google Sheet': d.badValue,
        'Severity': d.severity.toUpperCase(),
        'Issue Description': d.description,
        'Recommended Fix / Instructions': d.suggestedAction
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
        { wch: 5 },
        { wch: 38 },
        { wch: 15 },
        { wch: 18 },
        { wch: 16 },
        { wch: 25 },
        { wch: 18 },
        { wch: 22 },
        { wch: 12 },
        { wch: 45 },
        { wch: 55 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet_Discrepancies");
    XLSX.writeFile(wb, fileName);
}

// ==========================================================================
// VIEW 5: SEAT & CANDIDATE GAP REPORT ENGINE
// ==========================================================================

function getCategoryBadgeClass(normCat) {
    const c = String(normCat || '').toLowerCase();
    if (c.includes('general')) return 'badge-general';
    if (c.includes('ebc')) return 'badge-ebc';
    if (c.includes('obc') || c.includes('bc')) return 'badge-obc';
    if (c.includes('sc')) return 'badge-sc';
    if (c.includes('st')) return 'badge-st';
    if (c.includes('minority')) return 'badge-minority';
    return 'badge-other';
}

let gapCurrentTab = 'all';
let gapCurrentZone = '';
let gapCurrentDistrict = '';
let gapCurrentSearch = '';
let gapRosterCache = [];
let gapEventsInitialized = false;

function initGapReportEvents() {
    if (gapPillTabs) {
        gapPillTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.gap-tab-pill');
            if (!btn) return;
            gapPillTabs.querySelectorAll('.gap-tab-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gapCurrentTab = btn.dataset.gapTab || 'all';
            filterAndRenderGapTable();
        });
    }

    if (gapZoneFilter) {
        gapZoneFilter.addEventListener('change', (e) => {
            gapCurrentZone = e.target.value;
            updateGapDistrictDropdown();
            filterAndRenderGapTable();
        });
    }

    if (gapDistrictFilter) {
        gapDistrictFilter.addEventListener('change', (e) => {
            gapCurrentDistrict = e.target.value;
            filterAndRenderGapTable();
        });
    }

    if (gapSearchInput) {
        gapSearchInput.addEventListener('input', (e) => {
            gapCurrentSearch = e.target.value.trim().toLowerCase();
            filterAndRenderGapTable();
        });
    }

    if (gapClearSearch) {
        gapClearSearch.addEventListener('click', () => {
            if (gapSearchInput) gapSearchInput.value = '';
            gapCurrentSearch = '';
            filterAndRenderGapTable();
        });
    }

    if (gapResetFiltersBtn) {
        gapResetFiltersBtn.addEventListener('click', () => {
            gapCurrentTab = 'all';
            gapCurrentZone = '';
            gapCurrentDistrict = '';
            gapCurrentSearch = '';
            if (gapSearchInput) gapSearchInput.value = '';
            if (gapZoneFilter) gapZoneFilter.value = '';
            updateGapDistrictDropdown();
            if (gapDistrictFilter) gapDistrictFilter.value = '';
            if (gapPillTabs) {
                gapPillTabs.querySelectorAll('.gap-tab-pill').forEach(b => {
                    b.classList.toggle('active', b.dataset.gapTab === 'all');
                });
            }
            filterAndRenderGapTable();
        });
    }

    if (exportGapExcelBtn) {
        exportGapExcelBtn.addEventListener('click', exportGapReportToExcel);
    }
}

function renderGapReport() {
    if (!gapEventsInitialized) {
        initGapReportEvents();
        gapEventsInitialized = true;
    }

    const data = (typeof candidatesData !== 'undefined' && Array.isArray(candidatesData)) ? candidatesData : [];
    if (!data || !data.length) return;

    // 1. Group by Seat
    const seatMap = new Map();
    data.forEach(row => {
        const seat = String(row['ZP Seat Number'] || '').trim();
        if (!seat || seat === 'undefined') return;
        if (!seatMap.has(seat)) {
            seatMap.set(seat, {
                seat,
                zone: String(row.Zone || '').trim(),
                district: String(row.District || '').trim(),
                block: String(row.Block || '').trim(),
                reservation: String(row['Seat Reservation Status'] || '').trim(),
                candidates: []
            });
        }
        const candName = String(row['Probable ZP Candidate Name'] || '').trim();
        if (candName && candName !== 'undefined') {
            seatMap.get(seat).candidates.push(row);
        }
    });

    // 2. Build Roster Items & Calculate Stats
    gapRosterCache = [];
    let zeroCandidateCount = 0;
    let identifiedCandidateCount = 0;
    let incompleteProfileCount = 0;
    let completeProfileCount = 0;
    let missingContactCount = 0;
    let missingCategoryCount = 0;
    let missingCasteCount = 0;
    let missingAgeCount = 0;
    let missingProfileCount = 0;

    const zonesFound = new Set();
    const zoneDistrictMap = new Map();

    seatMap.forEach((seatInfo, seatNum) => {
        const z = seatInfo.zone || 'Other';
        const d = seatInfo.district || 'Other';
        if (z) zonesFound.add(z);
        if (z && d) {
            if (!zoneDistrictMap.has(z)) zoneDistrictMap.set(z, new Set());
            zoneDistrictMap.get(z).add(d);
        }

        if (seatInfo.candidates.length === 0) {
            zeroCandidateCount++;
            gapRosterCache.push({
                type: 'zero-candidate',
                seat: seatNum,
                zone: seatInfo.zone,
                district: seatInfo.district,
                block: seatInfo.block,
                reservation: seatInfo.reservation,
                candidateName: '',
                contact: '',
                category: '',
                caste: '',
                age: '',
                profile: '',
                source: '',
                hasContact: false,
                hasCategory: false,
                hasCaste: false,
                hasAge: false,
                hasProfile: false,
                isComplete: false,
                missingList: ['Candidate Name', 'Contact No', 'Category', 'Caste', 'Age', 'Brief Profile']
            });
        } else {
            seatInfo.candidates.forEach((cand, cIdx) => {
                identifiedCandidateCount++;
                const candName = String(cand['Probable ZP Candidate Name'] || '').trim();
                const contact = String(cand['Contact No'] || '').trim();
                const category = String(cand['Category'] || '').trim();
                const caste = String(cand['Caste'] || '').trim();
                const ageStr = String(cand['Age'] || '').trim();
                const profile = String(cand['Brief Profile'] || '').trim();
                const source = String(cand['Recommendation Source Categories'] || '').trim();

                // Compulsory fields evaluation
                const cleanDigits = contact.replace(/\D/g, '');
                const hasContact = Boolean(contact && contact !== '-' && contact !== 'undefined' && cleanDigits.length >= 10);
                const hasCategory = Boolean(category && category !== '-' && category !== 'undefined' && isNaN(Number(category)) && normalizeCategory(category) !== '(Invalid Data)');
                const hasCaste = Boolean(caste && caste !== '-' && caste !== 'undefined' && isNaN(Number(caste)) && caste.length >= 2);
                const ageNum = parseInt(ageStr, 10);
                const hasAge = Boolean(ageStr && ageStr !== '-' && ageStr !== 'undefined' && !isNaN(ageNum) && ageNum >= 18 && ageNum <= 100);
                const hasProfile = Boolean(profile && profile !== '-' && profile !== 'undefined' && profile.length >= 3);

                const missingList = [];
                if (!hasContact) { missingContactCount++; missingList.push('Contact No'); }
                if (!hasCategory) { missingCategoryCount++; missingList.push('Category'); }
                if (!hasCaste) { missingCasteCount++; missingList.push('Caste'); }
                if (!hasAge) { missingAgeCount++; missingList.push('Age'); }
                if (!hasProfile) { missingProfileCount++; missingList.push('Brief Profile'); }

                const isComplete = missingList.length === 0;
                if (isComplete) completeProfileCount++;
                else incompleteProfileCount++;

                gapRosterCache.push({
                    type: 'candidate',
                    seat: seatNum,
                    zone: cand.Zone || seatInfo.zone,
                    district: cand.District || seatInfo.district,
                    block: cand.Block || seatInfo.block,
                    reservation: String(cand['Seat Reservation Status'] || seatInfo.reservation || '').trim(),
                    candidateName: candName,
                    contact,
                    category,
                    caste,
                    age: ageStr,
                    profile,
                    source,
                    hasContact,
                    hasCategory,
                    hasCaste,
                    hasAge,
                    hasProfile,
                    isComplete,
                    missingList,
                    cIdx
                });
            });
        }
    });

    // 3. Update KPI Elements
    const kpiGapTotalSeats = document.getElementById('kpiGapTotalSeats');
    const kpiGapZeroSeats = document.getElementById('kpiGapZeroSeats');
    const kpiGapTotalCands = document.getElementById('kpiGapTotalCands');
    const kpiGapIncomplete = document.getElementById('kpiGapIncomplete');
    const kpiGapComplete = document.getElementById('kpiGapComplete');
    const gapStatusTag = document.getElementById('gapStatusTag');

    if (kpiGapTotalSeats) kpiGapTotalSeats.textContent = seatMap.size;
    if (kpiGapZeroSeats) kpiGapZeroSeats.textContent = zeroCandidateCount;
    if (kpiGapTotalCands) kpiGapTotalCands.textContent = identifiedCandidateCount;
    if (kpiGapIncomplete) kpiGapIncomplete.textContent = incompleteProfileCount;
    if (kpiGapComplete) kpiGapComplete.textContent = completeProfileCount;

    if (gapBadgeCount) gapBadgeCount.textContent = zeroCandidateCount;
    if (mobGapBadge) {
        mobGapBadge.textContent = zeroCandidateCount;
        mobGapBadge.style.display = zeroCandidateCount > 0 ? 'inline-flex' : 'none';
    }
    if (gapStatusTag) {
        gapStatusTag.textContent = `● ${zeroCandidateCount} Zero-Candidate Gaps | ${incompleteProfileCount} Profile Gaps`;
    }

    // 4. Update Tab Counters
    const tabAllEl = document.getElementById('gapTabCountAll');
    const tabZeroEl = document.getElementById('gapTabCountZero');
    const tabIncompleteEl = document.getElementById('gapTabCountIncomplete');
    const tabContactEl = document.getElementById('gapTabCountMissingContact');
    const tabCatEl = document.getElementById('gapTabCountMissingCategory');
    const tabCasteEl = document.getElementById('gapTabCountMissingCaste');
    const tabAgeEl = document.getElementById('gapTabCountMissingAge');
    const tabProfEl = document.getElementById('gapTabCountMissingProfile');
    const tabCompleteEl = document.getElementById('gapTabCountComplete');

    if (tabAllEl) tabAllEl.textContent = gapRosterCache.length;
    if (tabZeroEl) tabZeroEl.textContent = zeroCandidateCount;
    if (tabIncompleteEl) tabIncompleteEl.textContent = incompleteProfileCount;
    if (tabContactEl) tabContactEl.textContent = missingContactCount;
    if (tabCatEl) tabCatEl.textContent = missingCategoryCount;
    if (tabCasteEl) tabCasteEl.textContent = missingCasteCount;
    if (tabAgeEl) tabAgeEl.textContent = missingAgeCount;
    if (tabProfEl) tabProfEl.textContent = missingProfileCount;
    if (tabCompleteEl) tabCompleteEl.textContent = completeProfileCount;

    // 5. Populate Zone Dropdown
    if (gapZoneFilter && gapZoneFilter.options.length <= 1) {
        gapZoneFilter.innerHTML = '<option value="">All Zones (' + zonesFound.size + ')</option>';
        Array.from(zonesFound).sort().forEach(z => {
            const opt = document.createElement('option');
            opt.value = z;
            opt.textContent = z;
            gapZoneFilter.appendChild(opt);
        });
    }

    updateGapDistrictDropdown();
    filterAndRenderGapTable();
}

function updateGapDistrictDropdown() {
    if (!gapDistrictFilter) return;
    const previousSelected = gapDistrictFilter.value;
    const districts = new Set();

    gapRosterCache.forEach(item => {
        if (!gapCurrentZone || item.zone === gapCurrentZone) {
            if (item.district) districts.add(item.district);
        }
    });

    gapDistrictFilter.innerHTML = '<option value="">All Districts (' + districts.size + ')</option>';
    Array.from(districts).sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        gapDistrictFilter.appendChild(opt);
    });

    if (districts.has(previousSelected)) {
        gapDistrictFilter.value = previousSelected;
    } else {
        gapCurrentDistrict = '';
        gapDistrictFilter.value = '';
    }
}

function filterAndRenderGapTable() {
    if (!gapTableBody) return;

    let items = gapRosterCache.slice();

    // 1. Filter by Tab
    if (gapCurrentTab === 'zero') {
        items = items.filter(i => i.type === 'zero-candidate');
    } else if (gapCurrentTab === 'incomplete') {
        items = items.filter(i => i.type === 'candidate' && !i.isComplete);
    } else if (gapCurrentTab === 'missing-contact') {
        items = items.filter(i => i.type === 'candidate' && !i.hasContact);
    } else if (gapCurrentTab === 'missing-category') {
        items = items.filter(i => i.type === 'candidate' && !i.hasCategory);
    } else if (gapCurrentTab === 'missing-caste') {
        items = items.filter(i => i.type === 'candidate' && !i.hasCaste);
    } else if (gapCurrentTab === 'missing-age') {
        items = items.filter(i => i.type === 'candidate' && !i.hasAge);
    } else if (gapCurrentTab === 'missing-profile') {
        items = items.filter(i => i.type === 'candidate' && !i.hasProfile);
    } else if (gapCurrentTab === 'complete') {
        items = items.filter(i => i.type === 'candidate' && i.isComplete);
    }

    // 2. Filter by Zone
    if (gapCurrentZone) {
        items = items.filter(i => i.zone === gapCurrentZone);
    }

    // 3. Filter by District
    if (gapCurrentDistrict) {
        items = items.filter(i => i.district === gapCurrentDistrict);
    }

    // 4. Search Filter
    if (gapCurrentSearch) {
        items = items.filter(i => {
            return (i.seat && i.seat.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.candidateName && i.candidateName.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.district && i.district.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.block && i.block.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.caste && i.caste.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.contact && i.contact.toLowerCase().includes(gapCurrentSearch)) ||
                   (i.category && i.category.toLowerCase().includes(gapCurrentSearch));
        });
    }

    const gapTableSubtitle = document.getElementById('gapTableSubtitle');
    if (gapTableSubtitle) {
        gapTableSubtitle.textContent = `Showing ${items.length} records`;
    }

    if (items.length === 0) {
        gapTableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding:36px 16px; color:var(--text-muted);">
                    <div style="font-size:24px; margin-bottom:8px;">✅</div>
                    <strong>No matching gap records found for current filters</strong>
                    <div style="font-size:11.5px; margin-top:4px;">Try resetting filters or switching tabs.</div>
                </td>
            </tr>
        `;
        return;
    }

    gapTableBody.innerHTML = items.map(item => {
        if (item.type === 'zero-candidate') {
            return `
                <tr class="gap-row gap-row-zero">
                    <td>
                        <strong>${escapeHtml(item.seat)}</strong>
                        <div class="gap-loc-sub">${escapeHtml(item.district)} • ${escapeHtml(item.block || item.zone)}</div>
                    </td>
                    <td><span class="reservation-badge ${getReservationBadgeClass(item.reservation)}">${escapeHtml(item.reservation || 'General')}</span></td>
                    <td><span class="gap-status-badge badge-zero-cand">🔴 Zero Candidate (Gap)</span></td>
                    <td><span class="gap-no-cand-tag">🔴 NO CANDIDATE IDENTIFIED</span></td>
                    <td><span class="text-muted">—</span></td>
                    <td><span class="text-muted">—</span></td>
                    <td><span class="text-muted">—</span></td>
                    <td class="num-col"><span class="text-muted">—</span></td>
                    <td><span class="field-missing-badge" style="background:rgba(220,38,38,0.08); color:#b91c1c;">⚠️ Urgent: Candidate Needed</span></td>
                    <td><span class="text-muted">—</span></td>
                </tr>
            `;
        }

        // Candidate Item
        const statusBadge = item.isComplete
            ? `<span class="gap-status-badge badge-complete">🟢 Complete Profile</span>`
            : `<span class="gap-status-badge badge-incomplete">🟠 Profile Incomplete</span>`;

        let contactCell = '';
        if (item.hasContact) {
            const clean = extractPrimaryPhone(item.contact) || item.contact;
            contactCell = `<a href="tel:${escapeHtml(clean)}" class="gap-phone-link" title="Call ${escapeHtml(clean)}">📞 ${escapeHtml(item.contact)}</a>`;
        } else {
            contactCell = `<span class="field-missing-badge">⚠️ Missing Number</span>`;
        }

        const normCat = normalizeCategory(item.category);
        const catBadge = item.hasCategory
            ? `<span class="category-pill ${getCategoryBadgeClass(normCat)}">${escapeHtml(normCat)}</span>`
            : `<span class="field-missing-badge">⚠️ Missing Category</span>`;

        const casteCell = item.hasCaste
            ? `<span class="gap-caste-text">${escapeHtml(item.caste)}</span>`
            : `<span class="field-missing-badge">⚠️ Missing Caste</span>`;

        const ageCell = item.hasAge
            ? `<span class="gap-age-text">${escapeHtml(item.age)} yrs</span>`
            : `<span class="field-missing-badge">⚠️ Missing Age</span>`;

        const profileCell = item.hasProfile
            ? `<div class="gap-profile-preview" title="${escapeHtml(item.profile)}">${escapeHtml(item.profile)}</div>`
            : `<span class="field-missing-badge">⚠️ Missing Profile</span>`;

        return `
            <tr class="gap-row">
                <td>
                    <strong>${escapeHtml(item.seat)}</strong>
                    <div class="gap-loc-sub">${escapeHtml(item.district)} • ${escapeHtml(item.block || item.zone)}</div>
                </td>
                <td><span class="reservation-badge ${getReservationBadgeClass(item.reservation)}">${escapeHtml(item.reservation || 'General')}</span></td>
                <td>${statusBadge}</td>
                <td><a href="javascript:void(0)" class="gap-candidate-name" onclick="showCandidateDetail('${escapeHtml(item.seat)}', ${item.cIdx})">${escapeHtml(item.candidateName)}</a></td>
                <td>${contactCell}</td>
                <td>${catBadge}</td>
                <td>${casteCell}</td>
                <td class="num-col">${ageCell}</td>
                <td>${profileCell}</td>
                <td><span class="source-tag">${escapeHtml(item.source || 'Other')}</span></td>
            </tr>
        `;
    }).join('');
}

function exportGapReportToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('SheetJS library not loaded. Cannot export.', 'error');
        return;
    }

    const items = gapRosterCache.slice();
    if (!items.length) {
        showToast('No gap data available to export', 'warning');
        return;
    }

    const exportRows = items.map((item, idx) => ({
        '#': idx + 1,
        'ZP Seat Number': item.seat,
        'Zone': item.zone,
        'District': item.district,
        'Block': item.block,
        'Reservation Status': item.reservation || 'General',
        'Gap / Profile Status': item.type === 'zero-candidate' ? 'Zero-Candidate Gap' : (item.isComplete ? 'Complete Profile' : 'Profile Incomplete'),
        'Candidate Name': item.candidateName || 'NO CANDIDATE IDENTIFIED',
        'Contact Number': item.hasContact ? item.contact : 'MISSING',
        'Category': item.hasCategory ? item.category : 'MISSING',
        'Caste': item.hasCaste ? item.caste : 'MISSING',
        'Age': item.hasAge ? item.age : 'MISSING',
        'Brief Profile': item.hasProfile ? item.profile : 'MISSING',
        'Missing Compulsory Fields': item.missingList.length ? item.missingList.join(', ') : 'None (Complete)',
        'Recommendation Source': item.source || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
        { wch: 5 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 16 },
        { wch: 25 },
        { wch: 22 },
        { wch: 25 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 8 },
        { wch: 45 },
        { wch: 35 },
        { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gap_Report");
    XLSX.writeFile(wb, "ZP_Dashboard_Seat_and_Candidate_Gap_Report.xlsx");
    showToast("Gap Report downloaded successfully!", "success");
}



