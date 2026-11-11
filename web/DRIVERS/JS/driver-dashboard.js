// ========================================
// STARQUEEN PMTS - Driver Dashboard
// ========================================

SessionManager.guard('Driver');

const userId   = SessionManager.get('user_id');
const username = SessionManager.get('username');

const State = {
    truck:         null,
    activities:    [],
    odometers:     [],
    expenses:      [],
    maintenanceLogs: [],
    notifications: [], // SP_Unread_Maintenance_Notifications_Per_Truck
    ackRate:       [], // SP_Notification_Acknowledgement_Rate
    alerts:        [], // SP_Maintenance_Monitoring_Alert_Detection
};

function showLoading() { document.getElementById('loadingOverlay')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('active'); }

function fmt(n) {
    return Number(n || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

// ── Fetch All Data ────────────────────────────────────────────
async function fetchData() {
    showLoading();
    try {
        const base = String(CONFIG.API_BASE).replace(/\/+$/, '');

        const [trucks, activities, odometers, expenses, maintenanceLogs,
               adminNotifications, alerts] = await Promise.all([
            fetch(`${base}/api/Trucks`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckActivity`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckOdometer`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckExpenses`).then(r => r.json()).catch(() => []),
            fetch(`${base}/api/TruckMaintenanceLogs`).then(r => r.json()).catch(() => []),
            // Admin_Notifications raw — used to compute ack rate + unread
            fetch(`${base}/api/AdminNotifications`).then(r => r.json()).catch(() => []),
            // SP_Maintenance_Monitoring_Alert_Detection
            fetch(`${base}/api/TruckMaintenanceLogs/alerts`).then(r => r.json()).catch(() => []),
        ]);

        // Find this driver's truck
        State.truck = (trucks || []).find(t =>
            String(t.userID ?? t.userId ?? t.user_id) === String(userId)
        ) || null;

        const truckId = State.truck
            ? String(State.truck.truck_ID ?? State.truck.truckId ?? State.truck.truck_id)
            : null;

        // Always filter by this driver's truck_id — never use localStorage
        State.activities      = (activities      || []).filter(a => String(a.truck_id ?? a.truckId)  === truckId);
        State.odometers       = (odometers       || []).filter(o => String(o.truck_id ?? o.truckId)  === truckId);
        State.expenses        = (expenses        || []).filter(e => String(e.truck_id ?? e.truckId)  === truckId);
        State.maintenanceLogs = (maintenanceLogs || []).filter(l => String(l.truck_id ?? l.truckId)  === truckId);
        // Compute ack rate + unread from raw Admin_Notifications for this truck
        const allNotifs = (adminNotifications || []);
        const truckNotifs = allNotifs.filter(n =>
            String(n.truck_id ?? n.truckId) === String(State.truck?.truck_ID ?? State.truck?.truckId ?? State.truck?.truck_id)
        );
        State.notifications  = truckNotifs;
        State.ackRate        = truckNotifs;
        // Filter alerts for this truck's plate
        const plate = State.truck?.plateNumber ?? State.truck?.plate_number;
        State.alerts = (alerts || []).filter(a =>
            !plate || a.plate_number === plate
        );

        updateBanner();
        updateCards();
        renderAlerts();
        renderAcknowledgementRate();
        renderUnreadNotifications();

    } catch (err) {
        console.error('Dashboard fetch error:', err);
    } finally {
        hideLoading();
    }
}

// ── Banner ────────────────────────────────────────────────────
function updateBanner() {
    const truck = State.truck;
    if (!truck) return;

    const truckName   = truck.truckName   ?? truck.truck_name   ?? '—';
    const plateNumber = truck.plateNumber ?? truck.plate_number ?? '—';

    const nameEl  = document.getElementById('truckPlateName');
    const plateEl = document.getElementById('truckPlateNumber');
    if (nameEl)  nameEl.textContent  = truckName;
    if (plateEl) plateEl.textContent = plateNumber;

    // Latest odometer — sort by recorded_at descending
    const truckId   = String(truck.truck_ID ?? truck.truckId ?? truck.truck_id);
    const latestOdo = State.odometers
        .filter(o => String(o.truck_id ?? o.truckId) === truckId)
        .sort((a,b) => new Date(b.recorded_at ?? b.recordedAt) - new Date(a.recorded_at ?? a.recordedAt))[0];

    const km    = latestOdo ? (latestOdo.current_km ?? latestOdo.currentKm) : null;
    const kmEl  = document.getElementById('dashboardKm');
    const dateEl = document.getElementById('dashboardKmDate');

    if (kmEl)   kmEl.textContent  = km != null ? `${Number(km).toLocaleString()} KM` : '— KM';
    if (dateEl && latestOdo) {
        const date = new Date(latestOdo.recorded_at ?? latestOdo.recordedAt);
        dateEl.textContent = isNaN(date) ? '' : `As of ${date.toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        })}`;
    }
}

// ── Summary Cards ─────────────────────────────────────────────
function updateCards() {
    const counts = {
        countActivity:    State.activities.length,
        countMaintenance: State.maintenanceLogs.length,
        countExpense:     State.expenses.length,
        countOdometer:    State.odometers.length,
    };

    Object.entries(counts).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val).padStart(2, '0');
    });
}

// ── Maintenance Alerts Overview ───────────────────────────────
// Source: SP_Maintenance_Monitoring_Alert_Detection (filtered by this truck)
function renderAlerts() {
    const list       = document.getElementById('alertsList');
    const viewAllBtn = document.getElementById('viewAllContainer');
    if (!list) return;

    const actionable = State.alerts
        .filter(a => ['Overdue','Replace','Warning'].includes(a.status))
        .sort((a,b) => {
            const order = { Overdue: 0, Replace: 1, Warning: 2 };
            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
        });

    if (!actionable.length) {
        list.innerHTML = `<div class="empty-state"><p>No active maintenance alerts at this time</p></div>`;
        if (viewAllBtn) viewAllBtn.style.display = 'none';
        return;
    }

    if (viewAllBtn) viewAllBtn.style.display = 'block';

    const colors   = { Overdue: '#c62828', Replace: '#e65100', Warning: '#f57c00' };
    const bgColors = { Overdue: '#ffebee', Replace: '#fff3e0', Warning: '#fff9c4' };
    const badges   = { Overdue: 'overdue', Replace: 'replace', Warning: 'warning' };

    list.innerHTML = actionable.slice(0, 5).map(a => {
        const color   = colors[a.status]   || colors.Warning;
        const bgColor = bgColors[a.status] || bgColors.Warning;
        const badge   = badges[a.status]   || 'warning';
        const kmInfo  = a.km_difference != null && a.km_difference > 0
            ? ` · +${Number(a.km_difference).toLocaleString()} KM overdue`
            : '';
        return `
            <div class="alert-item ${badge}-item fade-in">
                <div class="alert-icon">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="17" fill="${bgColor}"/>
                        <path d="M18 11v8M18 24h.01" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="alert-info">
                    <h4>${escapeHtml(a.maintenance_item ?? '—')}</h4>
                    <p>${escapeHtml(a.plate_number ?? '—')}${kmInfo}</p>
                </div>
                <div class="alert-status">
                    <span class="badge ${badge}">${a.status.toUpperCase()}</span>
                </div>
            </div>`;
    }).join('');
}

// ── Notification Acknowledgement Rate ────────────────────────
// Source: Computed from Admin_Notifications for this truck
// Shows: read/unread count + acknowledgement rate
function renderAcknowledgementRate() {
    const container = document.getElementById('ackRateSection');
    if (!container) return;

    const notifs = State.notifications;
    const read   = notifs.filter(n => n.is_read ?? n.isRead).length;
    const unread = notifs.filter(n => !(n.is_read ?? n.isRead)).length;
    const total  = notifs.length;
    const rate   = total > 0 ? Math.round((read / total) * 100) : 0;
    const color  = rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626';

    container.innerHTML = `
        <div class="driver-sp-section">
            <div class="driver-sp-header">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M2 10l5 5 11-9" stroke="currentColor" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3>Notification Acknowledgement Rate</h3>
            </div>
            ${total > 0 ? `
            <div class="driver-ack-row">
                <div class="driver-ack-counts">
                    <span class="driver-ack-read">✓ ${read} Read</span>
                    <span class="driver-ack-unread">• ${unread} Unread</span>
                    <span class="driver-ack-total">/ ${total} Total</span>
                </div>
                <div class="driver-ack-bar-wrap">
                    <div class="driver-ack-bar">
                        <div class="driver-ack-bar-fill" style="width:${rate}%;background:${color}"></div>
                    </div>
                    <span class="driver-ack-rate" style="color:${color}">${rate}%</span>
                </div>
            </div>` : `
            <div class="driver-sp-empty">No notification data yet</div>`}
        </div>`;
}

// ── Unread Maintenance Alerts Per Truck ──────────────────────
// Source: Computed from Admin_Notifications for this truck
// Shows: count of unread urgent/warning alerts — hides when 0
function renderUnreadNotifications() {
    const container = document.getElementById('unreadNotifsSection');
    if (!container) return;

    const unreadActive = State.notifications.filter(n =>
        !(n.is_read ?? n.isRead) &&
        (n.type || '').toLowerCase() !== 'information'
    );

    if (!unreadActive.length) { container.innerHTML = ''; return; }

    container.innerHTML = `
        <div class="driver-sp-section driver-sp-section--urgent">
            <div class="driver-sp-header">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M10 6v5M10 14h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <h3>Unread Maintenance Alerts</h3>
            </div>
            <div class="driver-unread-row">
                <span class="driver-unread-count">${unreadActive.length}</span>
                <span class="driver-unread-label">
                    unread alert${unreadActive.length !== 1 ? 's' : ''} require your attention
                </span>
                <a href="/DRIVERS/HTML/maintenance-log.html" class="driver-unread-link">View →</a>
            </div>
        </div>`;
}

document.addEventListener('DOMContentLoaded', () => fetchData());