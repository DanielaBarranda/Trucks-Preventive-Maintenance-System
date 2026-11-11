// ========================================
// STARQUEEN PMTS — Truck Maintenance Log
// ========================================
// BEHAVIOR:
//   KM-based:   Status computed from latest odometer vs km thresholds
//   Month-based: Status computed from last submission date vs month_interval
//   Mark Complete → goes to Truck Expense (DOES NOT resolve yet)
//   Expense submit → resolves notification → status back to Good
// ========================================

SessionManager.guard('Driver');

const userId = SessionManager.get('user_id');

function showLoading() { document.getElementById('loadingOverlay')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('active'); }

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

// ── Normalize helpers ─────────────────────────────────────────
function normalizeTruck(obj) {
    if (!obj) return null;
    return {
        truckId:     obj.truck_ID     ?? obj.truckId     ?? obj.truck_id,
        userId:      obj.userID       ?? obj.userId       ?? obj.user_id,
        truckName:   obj.truckName    ?? obj.truck_name,
        plateNumber: obj.plateNumber  ?? obj.plate_number,
        truckType:   obj.truckType    ?? obj.truck_type,
    };
}

function normalizeOdo(obj) {
    if (!obj) return null;
    return {
        truckId:    obj.truck_ID    ?? obj.truckId    ?? obj.truck_id,
        currentKm:  obj.current_km  ?? obj.currentKm,
        recordedAt: obj.recorded_at ?? obj.recordedAt,
    };
}

function normalizeRef(obj) {
    if (!obj) return null;
    return {
        referenceId:     obj.reference_id     ?? obj.referenceId,
        maintenanceTask: obj.maintenance_task ?? obj.maintenanceTask,
        truckType:       obj.truck_type       ?? obj.truckType,
        monthInterval:   obj.month_interval   ?? obj.monthInterval ?? null,
    };
}

function normalizeLog(obj) {
    if (!obj) return null;
    return {
        maintenanceId: obj.maintenance_id ?? obj.maintenanceId,
        truckId:       obj.truck_id       ?? obj.truckId,
        referenceId:   obj.reference_id   ?? obj.referenceId,
        currentKm:     obj.current_km     ?? obj.currentKm,
        status:        obj.status,
        resolved:      obj.resolved,
        createdAt:     obj.created_at     ?? obj.createdAt,
    };
}

function normalizeExpense(obj) {
    if (!obj) return null;
    return {
        expenseId:   obj.expense_id   ?? obj.expenseId,
        truckId:     obj.truck_id     ?? obj.truckId,
        expenseType: obj.expense_type ?? obj.expenseType,
        amount:      obj.amount,
        expenseDate: obj.expense_date ?? obj.expenseDate,
    };
}

function getTruckTypeForRef(truck) {
    const combined = ((truck.truckType || '') + ' ' + (truck.truckName || '')).toLowerCase();
    if (combined.includes('elf'))  return 'ELF Truck';
    if (combined.includes('fwd'))  return 'FWD Truck';
    if (combined.includes('10w'))  return '10W Truck';
    if (combined.includes('tw'))   return 'TW Truck';
    if (combined.includes('wing')) return 'Wing Van';
    return null;
}

function statusBadgeClass(status) {
    switch (status) {
        case 'Good':    return 'status-badge status-badge--good';
        case 'Warning': return 'status-badge status-badge--warning';
        case 'Replace': return 'status-badge status-badge--replace';
        case 'Overdue': return 'status-badge status-badge--overdue';
        default:        return 'status-badge status-badge--nodata';
    }
}

function formatAsOfDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `As of ${d.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    })}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    }) + ' · ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
    });
}

function fmt(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

// ── Month-based status helper ─────────────────────────────────
function getMonthStatus(lastSubmittedAt, monthInterval) {
    if (!lastSubmittedAt || !monthInterval) return null;
    const last    = new Date(lastSubmittedAt);
    const now     = new Date();
    const elapsed = ((now.getFullYear() - last.getFullYear()) * 12)
                  + now.getMonth() - last.getMonth();

    if (elapsed >= monthInterval + 1)               return 'Overdue';
    if (elapsed >= monthInterval)                   return 'Replace';
    if (elapsed >= Math.floor(monthInterval * 0.8)) return 'Warning';
    return 'Good';
}

// ── Global refs ───────────────────────────────────────────────
let _truck     = null;
let _currentKm = null;
let _myLogs    = [];

// ── SP: Maintenance Alert Detection ──────────────────────────
// UPDATED: Removed stat cards (Overdue/Replace/Good counters)
//          Removed KM Over column — not applicable for month trucks
//          Cleaner 2-column layout: Component | Status
function renderAlertDetection(alerts, truck) {
    const container = document.getElementById('alertDetectionSection');
    if (!container) return;

    const plate      = truck?.plateNumber ?? truck?.plate_number ?? '';
    const myAlerts   = (alerts || []).filter(a => !plate || a.plate_number === plate);
    const actionable = myAlerts.filter(a => ['Overdue','Replace','Warning'].includes(a.status));

    if (!myAlerts.length) { container.innerHTML = ''; return; }

    container.innerHTML = `
        <div class="maintenance-card" style="margin-bottom:var(--spacing-lg);">
            <h2 class="maintenance-card-title">Maintenance Alert Detection</h2>

            ${actionable.length ? `
            <div class="alert-table-wrap">
                <table class="alert-table">
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actionable.map((a, i) => `
                            <tr class="${i % 2 === 0 ? '' : 'alt'}">
                                <td class="alert-table-component">${escapeHtml(a.maintenance_item ?? '—')}</td>
                                <td class="alert-table-status" style="text-align:center;">
                                    <span class="${statusBadgeClass(a.status)}">${a.status}</span>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>` : `
            <div class="alert-all-good">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 4" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                All components are within safe intervals
            </div>`}
        </div>`;
}

// ── Render current status rows ─────────────────────────────────
function renderRows(refs, currentKm, myLogs, truck, notifications, monthSubmissions) {
    _truck     = truck;
    _currentKm = currentKm;
    _myLogs    = myLogs;

    const body    = document.getElementById('maintenanceRows');
    const countEl = document.getElementById('recordCount');
    const emptyEl = document.getElementById('maintenanceEmpty');
    const tableEl = document.querySelector('.maintenance-table');

    if (!body) return;

    if (!refs.length) {
        body.innerHTML = '';
        if (countEl) countEl.textContent = '0';
        if (emptyEl) emptyEl.hidden      = false;
        if (tableEl) tableEl.hidden      = true;
        return;
    }

    if (emptyEl) emptyEl.hidden      = true;
    if (tableEl) tableEl.hidden      = false;
    if (countEl) countEl.textContent = String(refs.length);

    body.innerHTML = refs.map((ref, idx) => {

        // ── 1. Latest log for this component ───────────────────
        const matchingLog = myLogs
            .filter(l => String(l.referenceId) === String(ref.referenceId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        const isResolvedByLog = matchingLog?.resolved === 'Yes';

        // ── 2. Active notification for this component ───────────
        const matchingNotif = (notifications || []).find(n => {
            if (String(n.truck_id ?? n.truckId) !== String(truck?.truckId)) return false;
            if (n.is_resolved || n.isResolved) return false;
            const nType = (n.type || '').toLowerCase();
            if (nType !== 'urgent' && nType !== 'warning') return false;
            const notifTask    = (n.maintenance_task ?? n.maintenanceTask ?? '').toLowerCase();
            const refTask      = (ref.maintenanceTask || '').toLowerCase();
            const notifMessage = (n.message || '').toLowerCase();
            if (notifTask && notifTask === refTask) return true;
            if (refTask   && notifMessage.includes(refTask)) return true;
            return false;
        });

        // ── 3. Month-based status (if available) ───────────────
        const monthSub = (monthSubmissions || []).find(s =>
            String(s.reference_id) === String(ref.referenceId)
        );
        const monthStatus = monthSub
            ? getMonthStatus(monthSub.last_submitted_at, ref.monthInterval)
            : null;

        // ── 4. Determine final status ──────────────────────────
        let status;
        if (isResolvedByLog) {
            status = 'Good';
        } else if (matchingNotif) {
            status = (matchingNotif.type || '').toLowerCase() === 'urgent' ? 'Overdue' : 'Warning';
        } else if (monthStatus && monthStatus !== 'Good') {
            status = monthStatus;
        } else {
            status = 'Good';
        }

        const badgeClass  = statusBadgeClass(status);
        const needsAction = ['Overdue','Replace','Warning'].includes(status) && !isResolvedByLog;

        // ── 5. Build status cell ────────────────────────────────
        let statusCell;
        if (isResolvedByLog) {
            const resolvedDate = matchingLog?.createdAt ? formatDateTime(matchingLog.createdAt) : '—';
            statusCell = `
                <div class="resolved-indicator">
                    <span class="resolved-badge">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Resolved
                    </span>
                    <span class="resolved-date">${resolvedDate}</span>
                </div>`;
        } else {
            statusCell = `
                <span class="${badgeClass}">${escapeHtml(status)}</span>
                ${needsAction
                    ? `<button type="button" class="status-complete-btn"
                               data-ref-id="${ref.referenceId}"
                               data-task="${escapeHtml(ref.maintenanceTask || '')}"
                               aria-label="Go to expense to resolve">
                           <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                               <path d="M4 9l3.5 3.5L14 5" stroke="currentColor" stroke-width="2.2"
                                     stroke-linecap="round" stroke-linejoin="round"/>
                           </svg>
                       </button>`
                    : ''
                }`;
        }

        return `
            <div class="maintenance-row" role="row">
                <div class="maintenance-type-cell" role="cell">
                    <span class="maintenance-type-pill">${escapeHtml(ref.maintenanceTask || '—')}</span>
                </div>
                <div class="maintenance-status-cell" role="cell">
                    ${statusCell}
                </div>
            </div>`;
    }).join('');

    // ── Bind ✓ buttons: go to expense, do NOT resolve here ────
    body.querySelectorAll('.status-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const task = btn.dataset.task;
            try { localStorage.setItem('prefillExpenseCategory', task); } catch (e) {}
            showToast('Please submit the expense to complete this maintenance.', 'success');
            setTimeout(() => {
                window.location.href = '/DRIVERS/HTML/truck-expense.html';
            }, 1200);
        });
    });
}

// ── Render history tab ─────────────────────────────────────────
function renderHistory(myLogs, refs, expenses) {
    const historyList  = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const historyCount = document.getElementById('historyCount');
    if (!historyList) return;

    const resolved = myLogs
        .filter(l => l.resolved === 'Yes')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (historyCount) historyCount.textContent = String(resolved.length);

    if (!resolved.length) {
        historyList.innerHTML = '';
        if (historyEmpty) historyEmpty.hidden = false;
        return;
    }

    if (historyEmpty) historyEmpty.hidden = true;

    historyList.innerHTML = resolved.map(log => {
        const ref      = refs.find(r => String(r.referenceId) === String(log.referenceId));
        const taskName = ref?.maintenanceTask ?? `Reference #${log.referenceId}`;

        const matchingExpense = expenses
            .filter(e => {
                const eType = (e.expenseType || '').toLowerCase();
                const tName = taskName.toLowerCase();
                return eType.includes(tName) || tName.includes(eType);
            })
            .sort((a, b) =>
                Math.abs(new Date(a.expenseDate) - new Date(log.createdAt)) -
                Math.abs(new Date(b.expenseDate) - new Date(log.createdAt))
            )[0];

        return `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-task-name">${escapeHtml(taskName)}</span>
                    <span class="history-resolved-badge">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="currentColor"
                                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Resolved
                    </span>
                </div>
                <div class="history-item-details">
                    <div class="history-detail">
                        <span class="history-detail-label">Resolved On</span>
                        <span class="history-detail-value">${formatDateTime(log.createdAt)}</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">KM at Resolve</span>
                        <span class="history-detail-value">${
                            log.currentKm != null
                                ? Number(log.currentKm).toLocaleString() + ' KM'
                                : '—'
                        }</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">Expense Type</span>
                        <span class="history-detail-value">${escapeHtml(matchingExpense?.expenseType ?? '—')}</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">Amount</span>
                        <span class="history-detail-value">${matchingExpense ? fmt(matchingExpense.amount) : '—'}</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ── Load Data ─────────────────────────────────────────────────
async function loadData() {
    showLoading();
    try {
        const base = String(CONFIG.API_BASE).replace(/\/+$/, '');

        const [trucks, odometers, references, maintenanceLogs,
               notifications, expenses, alerts, monthSubs] = await Promise.all([
            fetch(`${base}/api/Trucks`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckOdometer`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/MaintenanceReference`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckMaintenanceLogs`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/AdminNotifications`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckExpenses`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckMaintenanceLogs/alerts`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckMaintenanceLogs/last-submission/0`).then(r => r.json()).catch(() => []),
        ]);

        const rawTruck = (trucks || []).find(t =>
            String(t.userID ?? t.userId ?? t.user_id) === String(userId)
        );
        const truck = normalizeTruck(rawTruck);

        const plateEl = document.getElementById('headerPlate');
        const kmEl    = document.getElementById('headerKm');
        const dateEl  = document.getElementById('headerKmDate');

        if (!truck) {
            if (plateEl) plateEl.textContent = 'No truck assigned';
            if (kmEl)    kmEl.textContent    = '—';
            if (dateEl)  dateEl.textContent  = '';
            renderRows([], null, [], null, [], []);
            renderHistory([], [], []);
            renderAlertDetection([], null);
            return;
        }

        const plate = `${truck.truckName || ''} ${truck.plateNumber || ''}`.trim();
        if (plateEl) plateEl.textContent = plate || '—';

        // Latest odometer
        const myOdo = (odometers || [])
            .map(normalizeOdo)
            .filter(o => o && String(o.truckId) === String(truck.truckId))
            .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

        const latest    = myOdo[0];
        const currentKm = latest?.currentKm ?? null;

        if (kmEl)   kmEl.textContent   = currentKm != null ? `${Number(currentKm).toLocaleString()} KM` : '—';
        if (dateEl) dateEl.textContent = formatAsOfDate(latest?.recordedAt) || '';

        const latestOdoDate = latest?.recordedAt ? new Date(latest.recordedAt) : null;

        // All logs for this truck
        const allMyLogs = (maintenanceLogs || [])
            .map(normalizeLog)
            .filter(l => l && String(l.truckId) === String(truck.truckId));

        // Reset filter: resolved logs only count if resolved AFTER latest odometer
        const myLogs = allMyLogs.filter(l => {
            if (l.resolved !== 'Yes') return true;
            if (!latestOdoDate) return true;
            return new Date(l.createdAt) > latestOdoDate;
        });

        // Maintenance references for this truck type
        const refType = getTruckTypeForRef(truck);
        const refs    = refType
            ? (references || []).map(normalizeRef).filter(r => r && r.truckType === refType)
            : [];

        // Expenses for this truck
        const myExpenses = (expenses || [])
            .map(normalizeExpense)
            .filter(e => e && String(e.truckId) === String(truck.truckId));

        // Month submissions for this truck
        const myMonthSubs = (monthSubs || []);

        // Render
        renderRows(refs, currentKm, myLogs, truck, notifications, myMonthSubs);
        renderAlertDetection(alerts || [], rawTruck);
        renderHistory(allMyLogs.filter(l => l.resolved === 'Yes'), refs, myExpenses);

    } catch (err) {
        console.error('Maintenance log load error:', err);
        showToast('Failed to load maintenance data.', 'error');
        renderRows([], null, [], null, [], []);
        renderHistory([], [], []);
        renderAlertDetection([], null);
    } finally {
        hideLoading();
    }
}

// ── Tab switching ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.maintenance-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.maintenance-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tabCurrent').hidden = target !== 'current';
            document.getElementById('tabHistory').hidden = target !== 'history';
        });
    });
    loadData();
});