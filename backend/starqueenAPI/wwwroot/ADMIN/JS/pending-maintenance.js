// ========================================
// STARQUEEN PMTS - Pending Maintenance
// ========================================

const username = localStorage.getItem('username');
const role     = localStorage.getItem('role');
if (!username || !role) window.location.href = '/ADMIN/HTML/login.html';
if (role === 'Driver')  window.location.href = '/DRIVERS/HTML/driver-dashboard.html';

const State = {
    trucks:          [],
    odometers:       [],
    references:      [],
    logs:            [],
    notifications:   [],
    alertsSP:          [],   // SP_Maintenance_Monitoring_Alert_Detection
    nearReplaceSP:     [],   // SP_Trucks_With_Multiple_Near_Replacement
    oldestCompSP:      [],   // SP_Oldest_Installed_Components_Per_Month
    overdueReplSP:     [],   // SP_Components_Overdue_for_Replacement
    goodStatusSP:      [],   // SP_Number_Of_Truck_Components_With_Good_Status
    totalCompSP:       [],   // SP_Total_Number_Of_Components_Installed_On_Each_Truck
    searchQuery:     '',
    typeFilter:      'all',
    statusFilter:    'all',
    activeTab:       'pending',
};

const trucksList     = document.getElementById('trucksList');
const emptyState     = document.getElementById('emptyState');
const searchInput    = document.getElementById('searchInput');
const typeFilterEl   = document.getElementById('typeFilter');
const statusFilters  = document.getElementById('statusFilters');
const loadingOverlay = document.getElementById('loadingOverlay');
const badgeWarning   = document.getElementById('badgeWarning');
const badgeReplace   = document.getElementById('badgeReplace');
const badgeOverdue   = document.getElementById('badgeOverdue');

function showLoading() { loadingOverlay?.classList.add('active'); }
function hideLoading() { loadingOverlay?.classList.remove('active'); }

function getTruckType(truck) {
    const c = ((truck.truckName || '') + ' ' + (truck.truckType || '')).toUpperCase();
    if (c.includes('ELF'))  return 'ELF';
    if (c.includes('FWD'))  return 'FWD';
    if (c.includes('10W'))  return '10W';
    if (c.includes('TW'))   return 'TW';
    if (c.includes('WING')) return 'WING_VAN';
    return 'OTHER';
}

const TYPE_LABELS = {
    ELF:'ELF Trucks', FWD:'FWD Trucks', TW:'TW Trucks',
    '10W':'10W Trucks', WING_VAN:'Wing Van Trucks', OTHER:'Other Trucks'
};
const TYPE_ORDER = ['ELF','FWD','TW','10W','WING_VAN','OTHER'];

function getTruckTypeForRef(truck) {
    const c = ((truck.truckType || '') + ' ' + (truck.truckName || '')).toLowerCase();
    if (c.includes('elf'))  return 'ELF Truck';
    if (c.includes('fwd'))  return 'FWD Truck';
    if (c.includes('10w'))  return '10W Truck';
    if (c.includes('tw'))   return 'TW Truck';
    if (c.includes('wing')) return 'Wing Van';
    return null;
}

function calculateStatus(currentKm, ref) {
    if (currentKm == null) return 'No Data';
    if (ref.km_overdue != null && currentKm >= ref.km_overdue) return 'Overdue';
    if (ref.km_replace != null && currentKm >= ref.km_replace) return 'Replace';
    if (ref.km_warning != null && currentKm >= ref.km_warning) return 'Warning';
    return 'Good';
}

function isResolved(truckId, referenceId) {
    const match = State.logs
        .filter(l => String(l.truck_id ?? l.truckId) === String(truckId) &&
                     String(l.reference_id ?? l.referenceId) === String(referenceId))
        .sort((a,b) => new Date(b.created_at ?? b.createdAt) - new Date(a.created_at ?? a.createdAt));
    return match[0]?.resolved === 'Yes';
}

function getWorstStatus(statuses) {
    if (statuses.includes('Overdue')) return 'overdue';
    if (statuses.includes('Replace')) return 'replace';
    if (statuses.includes('Warning')) return 'warning';
    return 'good';
}

// ── FIXED: getTruckStatuses now uses SP alert data as primary source ───────
// This correctly handles both KM-based and month-based trucks
function getTruckStatuses(truck) {
    const refType = getTruckTypeForRef(truck);
    if (!refType) return [];
    const refs = State.references.filter(r => r.truck_type === refType);

    return refs.map(ref => {
        const refId = ref.reference_id ?? ref.referenceId;
        const task  = ref.maintenance_task ?? ref.maintenanceTask;

        // Resolved check first
        if (isResolved(truck.truck_ID, refId)) return 'Resolved';

        // Use SP alert data as primary source — covers both KM and month trucks
        const spAlert = State.alertsSP.find(a =>
            a.plate_number === truck.plateNumber &&
            a.maintenance_item === task
        );
        if (spAlert?.status) return spAlert.status;

        // Fallback: KM calculation only for KM trucks with no SP data yet
        // Exclude 0 KM odometer records (those are stale month-based submissions)
        const odo = State.odometers
            .filter(o =>
                String(o.truck_id ?? o.truckId) === String(truck.truck_ID) &&
                (o.current_km ?? o.currentKm ?? 0) > 0
            )
            .sort((a,b) =>
                new Date(b.recorded_at ?? b.recordedAt) -
                new Date(a.recorded_at ?? a.recordedAt)
            )[0];
        const km = odo ? (odo.current_km ?? odo.currentKm ?? null) : null;
        return calculateStatus(km, ref);
    });
}

window.goToExpense = function(truckId) {
    try { localStorage.setItem('openExpenseTruckId', String(truckId)); } catch (e) {}
    window.location.href = '/ADMIN/HTML/expenses.html';
};

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchData() {
    showLoading();
    try {
        const [trucks, odometers, references, logs, alertsSP, nearReplaceSP, oldestCompSP, overdueReplSP, goodStatusSP, totalCompSP] = await Promise.all([
            fetch(`${CONFIG.API_BASE}/api/Trucks`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckOdometer`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/MaintenanceReference`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/alerts`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/near-replacement`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/oldest-components`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/overdue-replacement`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/good-status`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/total-components`).then(r => r.json()).catch(() => []),
        ]);

        State.trucks        = trucks        || [];
        State.odometers     = odometers     || [];
        State.references    = references    || [];
        State.logs          = logs          || [];
        State.alertsSP      = alertsSP      || [];
        State.nearReplaceSP = nearReplaceSP || [];
        State.oldestCompSP  = oldestCompSP  || [];
        State.overdueReplSP = overdueReplSP || [];
        State.goodStatusSP  = goodStatusSP  || [];
        State.totalCompSP   = totalCompSP   || [];

        updateSummaryBadges();
        render();
        renderSpSections();
        renderHistory();
    } catch (err) {
        console.error('Error fetching data:', err);
    } finally {
        hideLoading();
    }
}

// ── SP Sections ────────────────────────────────────────────────────────────
function renderSpSections() {
    renderNearReplacement();
    renderOldestComponents();
    renderMaintenanceAlerts();
    renderOverdueReplacement();
}

// ── SP: SP_Trucks_With_Multiple_Near_Replacement ───────────────────────────
function renderNearReplacement() {
    const container = document.getElementById('nearReplacementSection');
    if (!container) return;

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l2 6h6l-5 3.5 2 6L10 14l-5 3.5 2-6L2 8h6z"
                          stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">
                    Trucks With Multiple Near-Replacement Components
                    <span class="sp-badge">SP_Trucks_With_Multiple_Near_Replacement</span>
                </h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Plate</th>
                            <th>Near-Limit Items</th>
                            <th>Priority</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${State.nearReplaceSP.length ? State.nearReplaceSP.map(n => `
                            <tr class="fade-in">
                                <td><strong>${n.plate_number ?? '—'}</strong></td>
                                <td><span class="stat-pill red">${n.near_limit_items}</span></td>
                                <td>${n.near_limit_items >= 5
                                    ? '<span class="status-badge overdue">Critical</span>'
                                    : n.near_limit_items >= 3
                                    ? '<span class="status-badge replace">High</span>'
                                    : '<span class="status-badge warning">Medium</span>'}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    ✓ No trucks with multiple near-replacement components
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: SP_Oldest_Installed_Components_Per_Month ───────────────────────────
function renderOldestComponents() {
    const container = document.getElementById('oldestComponentsSection');
    if (!container) return;

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10 6v4.5l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">
                    Oldest Installed Components Per Truck
                    <span class="sp-badge">SP_Oldest_Installed_Components_Per_Month</span>
                </h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Plate</th>
                            <th>Component</th>
                            <th>Oldest Date</th>
                            <th>Age</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${State.oldestCompSP.length ? State.oldestCompSP.map(o => {
                            const ageDays = Math.floor(
                                (Date.now() - new Date(o.oldest_maintenance_date).getTime()) / 86400000
                            );
                            const ageText = ageDays >= 30
                                ? `${Math.floor(ageDays / 30)} month${Math.floor(ageDays/30) > 1 ? 's' : ''} ago`
                                : `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
                            return `
                                <tr class="fade-in">
                                    <td><strong>${o.plate_number ?? '—'}</strong></td>
                                    <td>${o.maintenance_task ?? '—'}</td>
                                    <td>${new Date(o.oldest_maintenance_date).toLocaleDateString('en-US',
                                        { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                                    <td><span class="stat-pill ${ageDays >= 90 ? 'red' : ageDays >= 30 ? 'amber' : 'green'}">${ageText}</span></td>
                                </tr>`;
                        }).join('') : `
                            <tr>
                                <td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No maintenance components recorded yet
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: SP_Maintenance_Monitoring_Alert_Detection ──────────────────────────
function renderMaintenanceAlerts() {
    const container = document.getElementById('maintenanceAlertsSection');
    if (!container) return;

    const overdueItems   = State.alertsSP.filter(a => a.status === 'Overdue');
    const replaceItems   = State.alertsSP.filter(a => a.status === 'Replace');
    const actionableRows = State.alertsSP.filter(a =>
        a.status === 'Overdue' || a.status === 'Replace' || a.status === 'Warning'
    );

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10 6.5v4M10 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">
                    Maintenance Alert Detection
                    <span class="sp-badge">SP_Maintenance_Monitoring_Alert_Detection</span>
                </h3>
            </div>

            <div class="alert-stat-grid">
                <div class="alert-stat-card overdue">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Overdue Items</div>
                        <div class="alert-stat-value">${overdueItems.length}</div>
                    </div>
                </div>
                <div class="alert-stat-card replace">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Replace Items</div>
                        <div class="alert-stat-value">${replaceItems.length}</div>
                    </div>
                </div>
                <div class="alert-stat-card total">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Total Tracked</div>
                        <div class="alert-stat-value">${State.alertsSP.length}</div>
                    </div>
                </div>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Plate</th>
                            <th>Component</th>
                            <th>Status</th>
                            <th>Latest KM</th>
                            <th>Next Due KM</th>
                            <th>KM Over</th>
                            <th>Overdue Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actionableRows.length ? actionableRows.map(a => `
                            <tr class="fade-in">
                                <td><strong>${a.plate_number ?? '—'}</strong></td>
                                <td>${a.maintenance_item ?? '—'}</td>
                                <td><span class="status-badge ${(a.status || '').toLowerCase()}">${a.status ?? '—'}</span></td>
                                <td>${a.latest_km != null ? Number(a.latest_km).toLocaleString() + ' KM' : '—'}</td>
                                <td>${a.next_due_km != null ? Number(a.next_due_km).toLocaleString() + ' KM' : '—'}</td>
                                <td>${a.km_difference != null
                                    ? `<span class="stat-pill ${a.km_difference > 0 ? 'red' : 'green'}">
                                        ${a.km_difference > 0 ? '+' : ''}${Number(a.km_difference).toLocaleString()} KM
                                       </span>`
                                    : '—'}</td>
                                <td><span class="stat-pill ${a.overdue_count > 0 ? 'red' : 'green'}">${a.overdue_count ?? 0}</span></td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="7" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    ✓ No overdue or replace items — all components are within range
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: SP_Components_Overdue_for_Replacement ─────────────────────────────
function renderOverdueReplacement() {
    const container = document.getElementById('overdueReplacementSection');
    if (!container) return;

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10 6v4M10 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">Components Overdue for Replacement</h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Truck</th>
                            <th>Components to Replace</th>
                            <th>Urgency</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${State.overdueReplSP.length ? State.overdueReplSP.map(r => `
                            <tr class="fade-in">
                                <td><strong>${r.truck_name ?? '—'}</strong></td>
                                <td><span class="stat-pill red">${r.replace_now_components}</span></td>
                                <td>${r.replace_now_components >= 3
                                    ? '<span class="status-badge overdue">Critical</span>'
                                    : r.replace_now_components >= 2
                                    ? '<span class="status-badge replace">High</span>'
                                    : '<span class="status-badge warning">Medium</span>'}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    ✓ No components require immediate replacement
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: SP_Number_Of_Truck_Components_With_Good_Status ────────────────────
function renderGoodStatusComponents() {
    const container = document.getElementById('goodStatusSection');
    if (!container) return;

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M2 10l5 5 11-9" stroke="currentColor" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">Number of Truck Components With Good Status</h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Plate</th>
                            <th>Good Components</th>
                            <th>Condition</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${State.goodStatusSP.length ? State.goodStatusSP.map(g => `
                            <tr class="fade-in">
                                <td><strong>${g.plate_number ?? '—'}</strong></td>
                                <td><span class="stat-pill green">${g.good_maintenance_count}</span></td>
                                <td>${g.good_maintenance_count >= 5
                                    ? '<span class="status-badge good" style="background:#e8f5e9;color:#2e7d32;">Excellent</span>'
                                    : g.good_maintenance_count >= 3
                                    ? '<span class="status-badge good" style="background:#e8f5e9;color:#2e7d32;">Good</span>'
                                    : '<span class="status-badge warning">Needs Attention</span>'}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No component status data available yet
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: SP_Total_Number_Of_Components_Installed_On_Each_Truck ────────────
function renderTotalComponents() {
    const container = document.getElementById('totalComponentsSection');
    if (!container) return;

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M6 10h8M10 6v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">Total Number of Components Installed Per Truck</h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Plate</th>
                            <th>Total Components</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${State.totalCompSP.length ? State.totalCompSP.map(t => `
                            <tr class="fade-in">
                                <td><strong>${t.plate_number ?? '—'}</strong></td>
                                <td><span class="stat-pill blue">${t.total_maintenance_items}</span></td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="2" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No component data available yet
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── Summary Badges ─────────────────────────────────────────────────────────
function updateSummaryBadges() {
    let warn = 0, replace = 0, overdue = 0;
    State.trucks.forEach(truck => {
        const statuses = getTruckStatuses(truck);
        warn    += statuses.filter(s => s === 'Warning').length;
        replace += statuses.filter(s => s === 'Replace').length;
        overdue += statuses.filter(s => s === 'Overdue').length;
    });
    if (badgeWarning) badgeWarning.textContent = `Warning: ${String(warn).padStart(2,'0')}`;
    if (badgeReplace) badgeReplace.textContent = `Replace: ${String(replace).padStart(2,'0')}`;
    if (badgeOverdue) badgeOverdue.textContent = `Overdue: ${String(overdue).padStart(2,'0')}`;
}

// ── Filter ─────────────────────────────────────────────────────────────────
function getFilteredTrucks() {
    return State.trucks.filter(truck => {
        const query = State.searchQuery.toLowerCase();
        if (query) {
            const name  = (truck.truckName  || '').toLowerCase();
            const plate = (truck.plateNumber || '').toLowerCase();
            if (!name.includes(query) && !plate.includes(query)) return false;
        }
        if (State.typeFilter !== 'all' && getTruckType(truck) !== State.typeFilter) return false;
        if (State.statusFilter !== 'all') {
            const statuses = getTruckStatuses(truck);
            if (!statuses.includes(State.statusFilter)) return false;
        }
        return true;
    });
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
    trucksList.querySelectorAll('.truck-group').forEach(el => el.remove());
    const filtered = getFilteredTrucks();
    if (!filtered.length) { emptyState.style.display = 'flex'; return; }
    emptyState.style.display = 'none';

    const groups = {};
    filtered.forEach(truck => {
        const type = getTruckType(truck);
        if (!groups[type]) groups[type] = [];
        groups[type].push(truck);
    });

    TYPE_ORDER.forEach(type => {
        if (!groups[type]?.length) return;
        const group = document.createElement('div');
        group.className = 'truck-group fade-in';
        const title = document.createElement('h3');
        title.className = 'truck-group-title';
        title.textContent = TYPE_LABELS[type] || type;
        group.appendChild(title);
        const grid = document.createElement('div');
        grid.className = 'truck-group-grid';
        group.appendChild(grid);
        groups[type].forEach(truck => grid.appendChild(createTruckCard(truck)));
        trucksList.appendChild(group);
    });
}

function createTruckCard(truck) {
    const statuses    = getTruckStatuses(truck);
    const worstStatus = getWorstStatus(statuses);
    const issueCount  = statuses.filter(s => s !== 'Good' && s !== 'No Data' && s !== 'Resolved').length;
    const totalCount  = statuses.length;

    // FIXED: Exclude 0 KM odometer records (stale month-based submissions)
    const odo = State.odometers
        .filter(o =>
            String(o.truck_id ?? o.truckId) === String(truck.truck_ID) &&
            (o.current_km ?? o.currentKm ?? 0) > 0
        )
        .sort((a,b) =>
            new Date(b.recorded_at ?? b.recordedAt) -
            new Date(a.recorded_at ?? a.recordedAt)
        )[0];
    const currentKm = odo ? (odo.current_km ?? odo.currentKm ?? null) : null;

    const spNear = State.nearReplaceSP.find(n => n.plate_number === truck.plateNumber);

    const card = document.createElement('div');
    card.className = 'truck-card';

    const issueText = issueCount > 0
        ? `<span class="issue-dot ${worstStatus}"></span> ${issueCount} issue${issueCount > 1 ? 's' : ''}`
        : currentKm == null
            ? `<span class="issue-dot" style="background:#ccc"></span> No KM data`
            : `<span class="issue-dot good"></span> All Good`;

    card.innerHTML = `
        <div class="truck-card-header has-${worstStatus}">
            <div>
                <div class="truck-name">${truck.truckName || 'Unknown Truck'}</div>
                <div class="truck-meta">
                    ${truck.plateNumber || ''} · ${totalCount} component${totalCount !== 1 ? 's' : ''}
                    ${currentKm != null ? ` · ${currentKm.toLocaleString()} KM` : ''}
                </div>
                ${spNear ? `<div class="truck-meta" style="font-size:11px;margin-top:3px;color:#c62828;">
                    ⚠ ${spNear.near_limit_items} near-limit components
                </div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <div class="truck-issue-count">${issueText}</div>
                <button class="view-details-btn">View Details</button>
            </div>
        </div>`;

    card.querySelector('.view-details-btn').addEventListener('click', e => {
        e.stopPropagation();
        openMaintenanceModal(truck);
    });
    return card;
}

function openMaintenanceModal(truck) {
    const refType  = getTruckTypeForRef(truck);
    const refs     = refType ? State.references.filter(r => r.truck_type === refType) : [];

    // FIXED: Exclude 0 KM odometer records (stale month-based submissions)
    const odo = State.odometers
        .filter(o =>
            String(o.truck_id ?? o.truckId) === String(truck.truck_ID) &&
            (o.current_km ?? o.currentKm ?? 0) > 0
        )
        .sort((a,b) =>
            new Date(b.recorded_at ?? b.recordedAt) -
            new Date(a.recorded_at ?? a.recordedAt)
        )[0];
    const currentKm  = odo ? (odo.current_km ?? odo.currentKm ?? null) : null;
    const recordedAt = odo ? (odo.recorded_at ?? odo.recordedAt) : null;

    document.getElementById('modalTruckName').textContent      = `${truck.truckName} ${truck.plateNumber}`;
    document.getElementById('modalKm').textContent             = currentKm != null ? `${currentKm.toLocaleString()} KM` : 'No odometer data';
    document.getElementById('modalDate').textContent           = recordedAt
        ? `As of ${new Date(recordedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}` : '';
    document.getElementById('modalComponentCount').textContent = `${refs.length} COMPONENTS`;

    const rows = refs.length ? refs.map(ref => {
        const refId    = ref.reference_id ?? ref.referenceId;
        const task     = ref.maintenance_task ?? ref.maintenanceTask ?? '—';
        const resolved = isResolved(truck.truck_ID, refId);

        // Use SP alert data as PRIMARY source for status
        // Falls back to JS calculateStatus() only if SP has no matching row
        const spAlert = State.alertsSP.find(a =>
            a.plate_number === truck.plateNumber &&
            a.maintenance_item === task
        );

        let status;
        if (resolved) {
            status = 'Resolved';
        } else if (spAlert && spAlert.status) {
            status = spAlert.status;
        } else {
            status = calculateStatus(currentKm, ref);
        }

        // KM info from SP — only show for KM-based trucks (null for month trucks)
        const kmOver = spAlert?.km_difference ?? null;
        const kmInfo = kmOver != null && kmOver > 0
            ? `<span style="font-size:11px;color:#b91c1c;margin-left:8px;">+${Number(kmOver).toLocaleString()} KM overdue</span>`
            : kmOver != null && kmOver <= 0
            ? `<span style="font-size:11px;color:#6b7280;margin-left:8px;">${Math.abs(Number(kmOver)).toLocaleString()} KM remaining</span>`
            : '';

        let badgeHtml;
        if (status === 'Resolved') {
            badgeHtml = `
                <span onclick="goToExpense(${truck.truck_ID})" title="Click to view expense proof"
                    style="display:inline-flex;align-items:center;gap:5px;background:#e8f5e9;color:#2e7d32;
                    font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.3px;
                    cursor:pointer;border:1.5px solid #a5d6a7;"
                    onmouseover="this.style.background='#c8e6c9'"
                    onmouseout="this.style.background='#e8f5e9'">
                    ✓ Resolved
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6h8M6 2l4 4-4 4" stroke="#2e7d32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </span>`;
        } else {
            badgeHtml = `<span class="status-badge ${status.toLowerCase()}">${status}</span>`;
        }

        return `
            <tr class="modal-row">
                <td class="modal-task">${task}</td>
                <td class="modal-status-cell">${badgeHtml}${kmInfo}</td>
            </tr>`;
    }).join('') : `
        <tr>
            <td colspan="2" style="text-align:center;padding:24px;color:var(--color-text-secondary)">
                No maintenance reference found
            </td>
        </tr>`;

    document.getElementById('modalTableBody').innerHTML = rows;
    document.getElementById('maintenanceModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMaintenanceModal() {
    document.getElementById('maintenanceModal')?.classList.remove('active');
    document.body.style.overflow = '';
}

// ── History Tab ────────────────────────────────────────────────────────────
function renderHistory(searchTerm = '') {
    const container = document.getElementById('adminHistoryList');
    const emptyEl   = document.getElementById('historyEmpty');
    if (!container) return;

    const resolved = State.logs.filter(l => l.resolved === 'Yes');
    const filtered  = resolved.filter(l => {
        if (!searchTerm) return true;
        const q     = searchTerm.toLowerCase();
        const truck = State.trucks.find(t => String(t.truck_ID) === String(l.truck_id ?? l.truckId));
        const name  = (truck?.truckName   || '').toLowerCase();
        const plate = (truck?.plateNumber || '').toLowerCase();
        const ref   = State.references.find(r => String(r.reference_id) === String(l.reference_id ?? l.referenceId));
        const task  = (ref?.maintenance_task || '').toLowerCase();
        return name.includes(q) || plate.includes(q) || task.includes(q);
    }).sort((a,b) => new Date(b.created_at ?? b.createdAt) - new Date(a.created_at ?? a.createdAt));

    if (!filtered.length) {
        container.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    const byTruck = {};
    filtered.forEach(l => {
        const tid = String(l.truck_id ?? l.truckId);
        if (!byTruck[tid]) byTruck[tid] = [];
        byTruck[tid].push(l);
    });

    container.innerHTML = Object.entries(byTruck).map(([truckId, logs]) => {
        const truck = State.trucks.find(t => String(t.truck_ID) === truckId);
        const name  = truck ? `${truck.truckName} ${truck.plateNumber}` : `Truck ${truckId}`;

        const rows = logs.map(l => {
            const ref  = State.references.find(r => String(r.reference_id) === String(l.reference_id ?? l.referenceId));
            const task = ref?.maintenance_task ?? '—';
            const date = new Date(l.created_at ?? l.createdAt).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});
            const km   = l.current_km ?? l.currentKm;
            return `
                <tr>
                    <td>${task}</td>
                    <td>${date}</td>
                    <td>${km != null && km > 0 ? Number(km).toLocaleString() + ' KM' : '—'}</td>
                    <td><span class="status-badge" style="background:#e8f5e9;color:#2e7d32;">✓ Resolved</span></td>
                </tr>`;
        }).join('');

        return `
            <div class="sp-section" style="margin-bottom:16px;">
                <h4 style="font-size:14px;font-weight:700;color:var(--color-text-primary);margin-bottom:12px;padding:16px 20px 0;">${name}</h4>
                <div class="sp-table-wrapper">
                    <table class="sp-table">
                        <thead><tr><th>Component</th><th>Resolved Date</th><th>KM at Resolve</th><th>Status</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }).join('');
}

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.maintenance-page-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.maintenance-page-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.activeTab = btn.dataset.tab;

        const pendingTab = document.getElementById('tabPending');
        const historyTab = document.getElementById('tabHistory');

        if (State.activeTab === 'pending') {
            pendingTab?.removeAttribute('hidden');
            historyTab?.setAttribute('hidden', '');
        } else {
            pendingTab?.setAttribute('hidden', '');
            historyTab?.removeAttribute('hidden');
        }
    });
});

// ── Event Listeners ────────────────────────────────────────────────────────
searchInput?.addEventListener('input',   () => { State.searchQuery = searchInput.value; render(); });
typeFilterEl?.addEventListener('change', () => { State.typeFilter  = typeFilterEl.value; render(); });
statusFilters?.addEventListener('click', e => {
    const btn = e.target.closest('.status-filter-btn');
    if (!btn) return;
    statusFilters.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.statusFilter = btn.dataset.status;
    render();
});

document.getElementById('historySearch')?.addEventListener('input', e => {
    renderHistory(e.target.value);
});

document.getElementById('closeModal')?.addEventListener('click', closeMaintenanceModal);
document.getElementById('maintenanceModal')?.addEventListener('click', e => {
    if (e.target.id === 'maintenanceModal') closeMaintenanceModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMaintenanceModal(); });

document.addEventListener('DOMContentLoaded', () => fetchData());