// ========================================
// STARQUEEN PMTS - Truck Activity
// ========================================

SessionManager.guard('Driver');

const username = SessionManager.get('username');
const userId   = SessionManager.get('user_id');

let myTruck      = null;
let myActivities = [];
let allCompleted = [];

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function showLoading() { document.getElementById('loadingOverlay')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('active'); }

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function buildDatetime(activityDate, timeValue) {
    if (!activityDate || !timeValue) return null;
    const datePart = String(activityDate).split('T')[0];
    if (!datePart || datePart.length < 10) return null;
    return `${datePart}T${timeValue}:00`;
}

function isBadDate(val) {
    if (!val) return true;
    const s = String(val).trim();
    return s.startsWith('1900') || s.startsWith('0001') || s === '';
}

function hasTime(val) {
    if (!val) return false;
    const s = String(val).trim();
    if (s === '' || s === '0' || s === 'null') return false;
    return !isBadDate(s);
}

function formatTime(value) {
    if (!value || isBadDate(value)) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeInput(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour   = parseInt(h, 10);
    const ampm   = hour >= 12 ? 'PM' : 'AM';
    const h12    = hour % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

function validateForm() {
    let valid = true;
    const fields = [
        { id: 'inputDate',       errorId: 'errorDate',       label: 'Date' },
        { id: 'inputCallTime',   errorId: 'errorCallTime',   label: 'Call Time' },
        { id: 'inputFarm',       errorId: 'errorFarm',       label: 'Farm' },
        { id: 'inputAddress',    errorId: 'errorAddress',    label: 'Address' },
        { id: 'inputDriverName', errorId: 'errorDriverName', label: "Driver's Name" },
    ];
    fields.forEach(f => {
        const input = document.getElementById(f.id);
        const error = document.getElementById(f.errorId);
        if (!input || !error) return;
        if (!input.value.trim()) {
            input.classList.add('error');
            error.textContent = `${f.label} is required`;
            valid = false;
        } else {
            input.classList.remove('error');
            error.textContent = '';
        }
    });
    return valid;
}

// ── Fetch ─────────────────────────────────
async function loadData() {
    showLoading();
    try {
        const base = String(CONFIG.API_BASE).replace(/\/+$/, '');

        const [trucks, activities, firstLastTrip, driverPerf] = await Promise.all([
            fetch(`${base}/api/Trucks`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckActivity`).then(r => r.json()).catch(() => []),
            // SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck
            fetch(`${base}/api/TruckActivity/trip-summary`).then(r => r.json()).catch(() => []),
            // SP_Driver_Performance_Activity_Summary
            fetch(`${base}/api/TruckActivity/driver-summary`).then(r => r.json()).catch(() => []),
        ]);

        myTruck = (trucks || []).find(t =>
            String(t.userID ?? t.userId ?? t.user_id) === String(userId)
        );

        if (myTruck) {
            const name  = myTruck.truckName    ?? myTruck.truck_name   ?? '';
            const plate = myTruck.plateNumber  ?? myTruck.plate_number ?? '';
            const full  = name ? `${name} ${plate}` : plate;
            document.getElementById('headerPlate').textContent = full || '—';

            const truckId = myTruck.truck_ID ?? myTruck.truckId ?? myTruck.truck_id;

            myActivities = (activities || [])
                .filter(a => String(a.truck_id ?? a.truckId) === String(truckId))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            // Filter SP data for this truck
            // SP returns: truck_id, plate_number, first_activity_date, last_activity_date
            const myFirstLast = (firstLastTrip || []).filter(r =>
                String(r.truck_id ?? r.truckId) === String(truckId)
            );

            // Filter driver performance for this driver
            const myPerf = (driverPerf || []).filter(r =>
                (r.driver_name ?? r.driverName ?? '').toLowerCase() === (username || '').toLowerCase()
            );

            renderFirstLastTrip(myFirstLast);
            renderDriverPerformance(myPerf);
            populateMonthFilter();
            renderActivities();
        }
    } catch (err) {
        console.error('Load error:', err);
        showToast('Failed to load data. Please refresh.', 'error');
    } finally {
        hideLoading();
    }
}

// ── SP: First & Last Trip ─────────────────────────────────────
// Source: SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck
// SP columns: truck_id, plate_number, first_activity_date, last_activity_date
function isBadSqlDate(val) {
    if (!val) return true;
    const s = String(val);
    return s.startsWith('1900') || s.startsWith('0001') || s === '';
}

function formatTripDate(val) {
    if (!val || isBadSqlDate(val)) return '—';
    const d = new Date(val);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderFirstLastTrip(rows) {
    const container = document.getElementById('firstLastTripSection');
    if (!container) return;
    if (!rows.length) { container.innerHTML = ''; return; }

    const r = rows[0];
    const firstDate = formatTripDate(r.first_activity_date);
    const lastDate  = formatTripDate(r.last_activity_date);
    const total     = myActivities.length;

    container.innerHTML = `
        <div class="driver-trip-summary fade-in">
            <div class="driver-trip-header">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M2 7h16M7 3v4M13 3v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <h3>First & Last Trip Summary</h3>
            </div>
            <div class="driver-trip-grid">
                <div class="driver-trip-card first">
                    <div class="driver-trip-label">First Trip</div>
                    <div class="driver-trip-date">${firstDate}</div>
                    <div class="driver-trip-farm" style="font-size:11px;margin-top:4px;color:#9ca3af;">
                        ${firstDate === '—' ? 'No departure logged yet' : ''}
                    </div>
                </div>
                <div class="driver-trip-card last">
                    <div class="driver-trip-label">Latest Trip</div>
                    <div class="driver-trip-date">${lastDate}</div>
                </div>
                <div class="driver-trip-card total">
                    <div class="driver-trip-label">Total Activities</div>
                    <div class="driver-trip-count">${total}</div>
                </div>
            </div>
        </div>`;
}

// ── SP: Driver Performance Summary ───────────────────────────
// Source: SP_Driver_Performance_Activity_Summary
function renderDriverPerformance(rows) {
    const container = document.getElementById('driverPerformanceSection');
    if (!container) return;
    if (!rows.length) { container.innerHTML = ''; return; }

    const r = rows[0];
    container.innerHTML = `
        <div class="driver-trip-summary fade-in" style="margin-bottom:var(--spacing-lg);">
            <div class="driver-trip-header">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M10 2l2 6h6l-5 3.5 2 6L10 14l-5 3.5 2-6L2 8h6z"
                          stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <h3>My Performance Summary</h3>
            </div>
            <div class="driver-trip-grid" style="grid-template-columns:repeat(4,1fr);">
                <div class="driver-trip-card" style="border-top:3px solid #3b82f6;">
                    <div class="driver-trip-label">Total Activities</div>
                    <div class="driver-trip-count" style="font-size:24px;">
                        ${r.total_activities ?? r.totalActivities ?? '—'}
                    </div>
                </div>
                <div class="driver-trip-card" style="border-top:3px solid #10b981;">
                    <div class="driver-trip-label">Departures Logged</div>
                    <div class="driver-trip-count" style="font-size:24px;">
                        ${r.total_departures ?? r.totalDepartures ?? '—'}
                    </div>
                </div>
                <div class="driver-trip-card" style="border-top:3px solid #f59e0b;">
                    <div class="driver-trip-label">Arrivals Logged</div>
                    <div class="driver-trip-count" style="font-size:24px;">
                        ${r.total_arrivals ?? r.totalArrivals ?? '—'}
                    </div>
                </div>
                <div class="driver-trip-card" style="border-top:3px solid var(--color-primary);">
                    <div class="driver-trip-label">Latest Activity</div>
                    <div class="driver-trip-date" style="font-size:12px;">
                        ${r.latest_activity_date ?? r.latestActivityDate
                            ? new Date(r.latest_activity_date ?? r.latestActivityDate)
                                .toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                            : '—'}
                    </div>
                </div>
            </div>
        </div>`;
}

// ── Month Filter ──────────────────────────────────────────────
function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    if (!select) return;

    const completed = myActivities.filter(a =>
        hasTime(a.departure_time ?? a.departureTime) &&
        hasTime(a.arrival_time   ?? a.arrivalTime)
    );

    // Get unique year-month combos from completed activities
    const months = [...new Set(completed.map(a => {
        const d = new Date(a.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    }))].sort((a, b) => b.localeCompare(a));

    select.innerHTML = '<option value="all">All Months</option>' +
        months.map(ym => {
            const [y, m] = ym.split('-');
            return `<option value="${ym}">${MONTH_NAMES[parseInt(m)-1]} ${y}</option>`;
        }).join('');
}

// ── Render Activities ─────────────────────
function renderActivities() {
    const pendingList    = document.getElementById('pendingList');
    const completedList  = document.getElementById('activitiesList');
    const pendingCount   = document.getElementById('pendingCount');
    const completedCount = document.getElementById('activitiesCount');
    const monthFilter    = document.getElementById('monthFilter')?.value || 'all';

    const pending = myActivities.filter(a =>
        !hasTime(a.departure_time ?? a.departureTime) ||
        !hasTime(a.arrival_time   ?? a.arrivalTime)
    );

    allCompleted = myActivities.filter(a =>
        hasTime(a.departure_time ?? a.departureTime) &&
        hasTime(a.arrival_time   ?? a.arrivalTime)
    );

    // Apply month filter
    const filtered = monthFilter === 'all' ? allCompleted : allCompleted.filter(a => {
        const d  = new Date(a.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return ym === monthFilter;
    });

    if (pendingCount)   pendingCount.textContent   = `${pending.length} record${pending.length !== 1 ? 's' : ''}`;
    if (completedCount) completedCount.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;

    if (pendingList) {
        pendingList.innerHTML = pending.length === 0
            ? '<div class="empty-state"><p>No pending activities</p></div>'
            : pending.map(a => renderFullCard(a)).join('');
    }

    if (completedList) {
        completedList.innerHTML = filtered.length === 0
            ? '<div class="empty-state"><p>No activities found for selected month</p></div>'
            : filtered.map(a => renderCompactCard(a)).join('');
    }
}

function renderFullCard(a) {
    const id      = a.truck_activity_id ?? a.truckActivityId;
    const hasDep  = hasTime(a.departure_time ?? a.departureTime);
    const hasArr  = hasTime(a.arrival_time   ?? a.arrivalTime);
    const depTime = formatTime(a.departure_time ?? a.departureTime);
    const arrTime = formatTime(a.arrival_time   ?? a.arrivalTime);

    return `
        <div class="activity-card fade-in" id="card-${id}">
            <div class="activity-card-header">
                <span class="activity-date">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M1 5h12M4 1v2M10 1v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    ${formatDate(a.date)}
                </span>
                <span class="activity-farm">${a.farm || '—'}</span>
            </div>
            <div class="activity-card-body">
                <div class="activity-details-grid">
                    <div class="activity-detail">
                        <span class="activity-detail-label">Address</span>
                        <span class="activity-detail-value">${a.address || '—'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-detail-label">Call Time</span>
                        <span class="activity-detail-value">${a.call_time ?? a.callTime ?? '—'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-detail-label">Plant</span>
                        <span class="activity-detail-value">${a.plant || 'N/A'}</span>
                    </div>
                    <div class="activity-detail">
                        <span class="activity-detail-label">Driver</span>
                        <span class="activity-detail-value">${a.driver_name ?? a.driverName ?? '—'}</span>
                    </div>
                </div>
                <div class="activity-times">
                    <div class="time-slot" id="dep-slot-${id}">
                        <div class="time-slot-header">
                            <span class="time-slot-label">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 2v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                                Departure
                            </span>
                            ${!hasDep ? `<button class="btn-secondary" onclick="toggleTimeForm('dep', ${id})">Log</button>` : ''}
                        </div>
                        <div class="time-slot-value ${hasDep ? 'logged' : 'not-logged'}">
                            ${hasDep ? depTime : 'Not logged yet'}
                        </div>
                        <div class="time-log-form" id="dep-form-${id}">
                            <input type="time" class="time-log-input" id="dep-input-${id}">
                            <button class="btn-success" onclick="submitTime('departure', ${id})">Save</button>
                            <button class="btn-secondary" onclick="toggleTimeForm('dep', ${id})">Cancel</button>
                        </div>
                    </div>
                    <div class="time-slot" id="arr-slot-${id}">
                        <div class="time-slot-header">
                            <span class="time-slot-label">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 2v5l-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                                Arrival
                            </span>
                            ${!hasArr ? `<button class="btn-secondary" onclick="toggleTimeForm('arr', ${id})">Log</button>` : ''}
                        </div>
                        <div class="time-slot-value ${hasArr ? 'logged' : 'not-logged'}">
                            ${hasArr ? arrTime : 'Not logged yet'}
                        </div>
                        <div class="time-log-form" id="arr-form-${id}">
                            <input type="time" class="time-log-input" id="arr-input-${id}">
                            <button class="btn-success" onclick="submitTime('arrival', ${id})">Save</button>
                            <button class="btn-secondary" onclick="toggleTimeForm('arr', ${id})">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderCompactCard(a) {
    const depTime = formatTime(a.departure_time ?? a.departureTime);
    const arrTime = formatTime(a.arrival_time   ?? a.arrivalTime);
    return `
        <div class="activity-card compact fade-in">
            <div class="activity-card-header">
                <span class="activity-date">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M1 5h12M4 1v2M10 1v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    ${formatDate(a.date)}
                </span>
            </div>
            <div class="activity-card-body">
                <div class="activity-compact-row">
                    <div class="activity-compact-cell">
                        <span class="activity-compact-label">Farm</span>
                        <span class="activity-compact-value">${a.farm || '—'}</span>
                    </div>
                    <div class="activity-compact-cell">
                        <span class="activity-compact-label">Address</span>
                        <span class="activity-compact-value">${a.address || '—'}</span>
                    </div>
                    <div class="activity-compact-cell">
                        <span class="activity-compact-label">Call Time</span>
                        <span class="activity-compact-value">${a.call_time ?? a.callTime ?? '—'}</span>
                    </div>
                    <div class="activity-compact-cell">
                        <span class="activity-compact-label">Plant</span>
                        <span class="activity-compact-value">${a.plant || 'N/A'}</span>
                    </div>
                    <div class="activity-compact-cell">
                        <span class="activity-compact-label">Driver</span>
                        <span class="activity-compact-value">${a.driver_name ?? a.driverName ?? '—'}</span>
                    </div>
                    <div class="activity-compact-time">
                        <span class="activity-compact-time-label">Departure</span>
                        <span class="activity-compact-time-value">${depTime}</span>
                    </div>
                    <div class="activity-compact-time">
                        <span class="activity-compact-time-label">Arrival</span>
                        <span class="activity-compact-time-value">${arrTime}</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function toggleTimeForm(type, id) {
    const form = document.getElementById(`${type}-form-${id}`);
    if (!form) return;
    form.classList.toggle('active');
}

async function submitTime(type, activityId) {
    const prefix  = type === 'departure' ? 'dep' : 'arr';
    const inputEl = document.getElementById(`${prefix}-input-${activityId}`);
    if (!inputEl || !inputEl.value) { showToast('Please select a time.', 'error'); return; }

    const existing = myActivities.find(a =>
        String(a.truck_activity_id ?? a.truckActivityId) === String(activityId)
    );
    if (!existing) return;

    const fullDatetime = buildDatetime(existing.date, inputEl.value);
    if (!fullDatetime) { showToast('Could not determine the activity date.', 'error'); return; }

    const existingDep = hasTime(existing.departure_time ?? existing.departureTime)
        ? (existing.departure_time ?? existing.departureTime) : null;
    const existingArr = hasTime(existing.arrival_time ?? existing.arrivalTime)
        ? (existing.arrival_time ?? existing.arrivalTime) : null;

    const payload = {
        truck_activity_id: existing.truck_activity_id ?? existing.truckActivityId,
        date:              existing.date,
        farm:              existing.farm,
        address:           existing.address,
        call_time:         existing.call_time ?? existing.callTime,
        plant:             existing.plant,
        driver_name:       existing.driver_name ?? existing.driverName,
        departure_time:    type === 'departure' ? fullDatetime : existingDep,
        arrival_time:      type === 'arrival'   ? fullDatetime : existingArr,
        truck_id:          existing.truck_id    ?? existing.truckId,
    };

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/TruckActivity/${activityId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        if (res.ok) {
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} logged!`);
            await loadData();
        } else {
            showToast(`Failed to log ${type}.`, 'error');
        }
    } catch (err) {
        console.error('Submit time error:', err);
        showToast('Connection error. Please try again.', 'error');
    }
}

async function submitActivity() {
    if (!validateForm()) return;
    if (!myTruck) { showToast('No truck assigned to your account.', 'error'); return; }

    const btn      = document.getElementById('submitActivityBtn');
    btn.disabled   = true;
    btn.textContent = 'Submitting...';

    const truckId  = myTruck.truck_ID ?? myTruck.truckId ?? myTruck.truck_id;
    const callTime = formatTimeInput(document.getElementById('inputCallTime').value);

    const payload = {
        truck_activity_id: 0,
        date:              new Date(document.getElementById('inputDate').value).toISOString(),
        farm:              document.getElementById('inputFarm').value.trim(),
        address:           document.getElementById('inputAddress').value.trim(),
        call_time:         callTime,
        plant:             document.getElementById('inputPlant').value.trim() || 'N/A',
        driver_name:       document.getElementById('inputDriverName').value.trim(),
        departure_time:    null,
        arrival_time:      null,
        truck_id:          truckId,
    };

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/TruckActivity`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        if (res.ok) {
            showToast('Activity logged successfully!');
            resetForm();
            await loadData();
        } else {
            showToast('Failed to submit activity.', 'error');
        }
    } catch (err) {
        console.error('Submit error:', err);
        showToast('Connection error. Please try again.', 'error');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg> Submit Activity`;
    }
}

function resetForm() {
    ['inputDate','inputCallTime','inputFarm','inputPlant','inputAddress'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

document.addEventListener('DOMContentLoaded', () => {
    const driverNameInput = document.getElementById('inputDriverName');
    if (driverNameInput) driverNameInput.value = username || '';
    const dateInput = document.getElementById('inputDate');
    if (dateInput) dateInput.valueAsDate = new Date();
    document.getElementById('submitActivityBtn')?.addEventListener('click', submitActivity);
    document.getElementById('monthFilter')?.addEventListener('change', renderActivities);
    loadData();
});