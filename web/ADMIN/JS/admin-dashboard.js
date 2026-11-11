// ========================================
// STARQUEEN PMTS - Admin Dashboard
// ========================================

const AppState = {
    user:      { name: 'User', fullName: 'User', role: 'Admin', initials: 'U' },
    cards: [
        { id: 'active-trucks',       title: 'Active Trucks',      value: 0, icon: 'truck'    },
        { id: 'pending-maintenance', title: 'Pending Maintenance', value: 0, icon: 'clock'    },
        { id: 'expenses',            title: `${new Date().getFullYear()} Expenses`, value: 0, icon: 'calendar' },
        { id: 'alerts',              title: 'Unread Alerts',       value: 0, icon: 'alert'    }
    ],
    alerts:       [],
    overview:     [], // SP_Admin_Dashboard_Truck_Overview
    goodStatus:   [], // SP_Number_Of_Truck_Components_With_Good_Status
    totalComps:   [], // SP_Total_Number_Of_Components_Installed_On_Each_Truck
    isLoading:    false
};

const DOM = {
    init() {
        this.quickActionsGrid = document.getElementById('quickActionsGrid');
        this.alertsList       = document.getElementById('alertsList');
        this.viewAllAlerts    = document.getElementById('viewAllAlerts');
        this.loadingOverlay   = document.getElementById('loadingOverlay');
        this.welcomeUserName  = document.getElementById('welcomeUserName');
        this.welcomeDate      = document.getElementById('welcomeDate');
    }
};

// ── Session ───────────────────────────────────────────
const Session = {
    check() {
        if (!SessionManager.isValid()) {
            SessionManager.clear();
            window.location.replace('/ADMIN/HTML/login.html');
            return false;
        }
        if (SessionManager.get('role') === 'Driver') {
            window.location.replace('/DRIVERS/HTML/driver-dashboard.html');
            return false;
        }
        return true;
    },
    getUser() {
        const username = SessionManager.get('username') || 'User';
        const role     = SessionManager.get('role')     || 'Admin';
        return { name: username, fullName: username, role, initials: username.charAt(0).toUpperCase() };
    }
};

// ── UI ────────────────────────────────────────────────
const UI = {
    createActionCard(card) {
        const icons = {
            truck:    `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" stroke-width="2"/><path d="M10 14L14 10L18 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            clock:    `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="9" stroke="currentColor" stroke-width="2"/><path d="M14 9v5l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            calendar: `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="5" y="7" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 12h18M10 7V5M18 7V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            alert:    `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="9" stroke="currentColor" stroke-width="2"/><path d="M14 9v5M14 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
        };
        return `
            <div class="action-card fade-in" data-card-id="${card.id}">
                <div class="card-icon ${card.id}">${icons[card.icon] || icons.alert}</div>
                <div class="card-content">
                    <h3>${card.title}</h3>
                    <p class="card-value" data-value="${card.value}">${card.id === 'expenses' ? (card.displayValue || '₱0.00') : String(card.value).padStart(2, '0')}</p>
                </div>
            </div>`;
    },

    // ── Alert item from SP_Maintenance_Monitoring_Alert_Detection ──
    createAlertItem(alert) {
        const status   = (alert.status || '').toLowerCase();
        const colors   = { overdue: '#c62828', replace: '#e65100', warning: '#f57c00' };
        const bgColors = { overdue: '#ffebee', replace: '#fff3e0', warning: '#fff9c4' };
        const labels   = { overdue: 'OVERDUE', replace: 'REPLACE', warning: 'WARNING' };
        const badges   = { overdue: 'overdue', replace: 'replace', warning: 'warning' };

        const color   = colors[status]   || colors.warning;
        const bgColor = bgColors[status] || bgColors.warning;
        const label   = labels[status]   || status.toUpperCase();
        const badge   = badges[status]   || 'warning';

        // KM info
        const kmInfo = alert.km_difference != null && alert.km_difference > 0
            ? `+${Number(alert.km_difference).toLocaleString()} KM overdue`
            : alert.latest_km != null
            ? `${Number(alert.latest_km).toLocaleString()} KM`
            : '';

        return `
            <div class="alert-item fade-in">
                <div class="alert-icon">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="17" fill="${bgColor}"/>
                        <path d="M18 11v8M18 24h.01" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="alert-info">
                    <h4>${escapeHtml(alert.plate_number ?? '—')}</h4>
                    <p>${escapeHtml(alert.maintenance_item ?? '—')}${kmInfo ? ` · ${kmInfo}` : ''}</p>
                </div>
                <div class="alert-status">
                    <span class="badge ${badge}">${label}</span>
                </div>
            </div>`;
    },

    showLoading() { DOM.loadingOverlay?.classList.add('active');    AppState.isLoading = true;  },
    hideLoading() { DOM.loadingOverlay?.classList.remove('active'); AppState.isLoading = false; },

    animateValue(element, start, end, duration) {
        if (!element) return;
        const totalSteps = duration / 16;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            const p = 1 - Math.pow(1 - step / totalSteps, 3);
            element.textContent = String(Math.round(start + (end - start) * p)).padStart(2, '0');
            if (step >= totalSteps) clearInterval(timer);
        }, 16);
    },

    setWelcomeDate() {
        if (!DOM.welcomeDate) return;
        DOM.welcomeDate.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
};

// ── Data Manager ──────────────────────────────────────
const DataManager = {

    async fetchAll() {
        // [0] SP_Admin_Dashboard_Truck_Overview        → summary cards
        // [1] SP_Maintenance_Monitoring_Alert_Detection → alerts list
        // [2] Raw trucks                               → active truck count
        // [3] SP_Total_Monthly_Maintenance_Cost_Per_Trucks → yearly expense total
        const [overview, alertsSP, trucks, monthlyCosts, goodStatus, totalComps] = await Promise.all([
            fetch(`${CONFIG.API_BASE}/api/AdminNotifications/dashboard-overview`)
                .then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/alerts`)
                .then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/Trucks`)
                .then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/monthly-cost`)
                .then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/good-status`)
                .then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckMaintenanceLogs/total-components`)
                .then(r => r.json()).catch(() => []),
        ]);
        return { overview, alertsSP, trucks, monthlyCosts, goodStatus, totalComps };
    },

    async updateDashboard() {
        UI.showLoading();
        try {
            const { overview, alertsSP, trucks, monthlyCosts, goodStatus, totalComps } = await this.fetchAll();
            AppState.overview   = overview   || [];
            AppState.goodStatus = goodStatus || [];
            AppState.totalComps = totalComps || [];

            const currentYear = new Date().getFullYear();

            // ── Summary Cards from SP_Admin_Dashboard_Truck_Overview ──────────
            // unresolved_maintenance → Pending Maintenance card
            // unread_notifications   → Unread Alerts card
            let totalUnresolved = 0;
            let totalUnread     = 0;

            (overview || []).forEach(row => {
                totalUnresolved += row.unresolved_maintenance ?? 0;
                totalUnread     += row.unread_notifications   ?? 0;
            });

            // ── Yearly Expenses from SP_Total_Monthly_Maintenance_Cost_Per_Trucks
            // Filter by current year → sums all monthly costs for this year only
            // Resets automatically every January 1
            const yearlyExpenses = (monthlyCosts || [])
                .filter(m => m.year === currentYear)
                .reduce((sum, m) => sum + (m.monthly_truck_cost ?? 0), 0);

            // Format peso amount for expenses card
            const pesoFormat = '₱' + Number(yearlyExpenses).toLocaleString('en-PH', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });

            const counts = {
                'active-trucks':       (trucks || []).length,
                'pending-maintenance': totalUnresolved,
                'expenses':            0, // peso amount shown via displayValue — see above
                'alerts':              totalUnread,
            };

            // Animate card values
            AppState.cards.forEach(card => {
                const cardEl = document.querySelector(`[data-card-id="${card.id}"] .card-value`);
                if (card.id === 'expenses') {
                    // Show peso amount instead of count
                    card.displayValue = pesoFormat;
                    card.value        = yearlyExpenses;
                    if (cardEl) {
                        cardEl.dataset.value  = yearlyExpenses;
                        cardEl.textContent    = pesoFormat;
                        cardEl.style.fontSize = yearlyExpenses >= 100000 ? '20px' : '24px';
                    }
                } else {
                    const newVal     = counts[card.id] ?? 0;
                    const currentVal = parseInt(cardEl?.dataset.value || '0');
                    UI.animateValue(cardEl, currentVal, newVal, 400);
                    if (cardEl) cardEl.dataset.value = newVal;
                    card.value = newVal;
                }
            });

            // ── Alerts List from SP_Maintenance_Monitoring_Alert_Detection ────
            // Only show Overdue, Replace, Warning — not Good
            // Sort: Overdue first → Replace → Warning
            const order        = { overdue: 0, replace: 1, warning: 2 };
            const actionable   = (alertsSP || []).filter(a =>
                ['Overdue','Replace','Warning'].includes(a.status)
            );
            const dedupKey     = new Set();
            const deduplicated = [];
            actionable.forEach(a => {
                const key = `${escapeHtml(a.plate_number)}-${escapeHtml(a.maintenance_item)}`;
                if (!dedupKey.has(key)) {
                    dedupKey.add(key);
                    deduplicated.push(a);
                }
            });

            AppState.alerts = deduplicated.sort((a, b) => {
                const aO = order[(a.status || '').toLowerCase()] ?? 9;
                const bO = order[(b.status || '').toLowerCase()] ?? 9;
                return aO - bO;
            });

            this.renderAlerts();
            this.renderFleetHealth();

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            UI.hideLoading();
        }
    },

    renderAlerts() {
        if (!DOM.alertsList) return;

        if (AppState.alerts.length === 0) {
            DOM.alertsList.innerHTML = `
                <div class="empty-state">
                    <p>No active maintenance alerts at this time</p>
                </div>`;
            return;
        }

        DOM.alertsList.innerHTML = AppState.alerts
            .slice(0, 5)
            .map(a => UI.createAlertItem(a))
            .join('');
    },

    // ── Fleet Health Section ──────────────────────────────────────────────
    // SP_Number_Of_Truck_Components_With_Good_Status  → good components per truck
    // SP_Total_Number_Of_Components_Installed_On_Each_Truck → total components per truck
    renderFleetHealth() {
        const container = document.getElementById('fleetHealthSection');
        if (!container) return;

        // Merge good status + total components by plate
        const merged = AppState.totalComps.map(t => {
            const good = AppState.goodStatus.find(g => g.plate_number === t.plate_number);
            const goodCount  = good?.good_maintenance_count ?? 0;
            const totalCount = t.total_maintenance_items ?? 0;
            const rate       = totalCount > 0 ? Math.round((goodCount / totalCount) * 100) : 0;
            const color      = rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626';
            return { plate: t.plate_number, good: goodCount, total: totalCount, rate, color };
        }).sort((a, b) => b.rate - a.rate);

        container.innerHTML = `
            <div class="sp-fleet-section">
                <div class="sp-fleet-header">
                    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                        <path d="M2 10l5 5 11-9" stroke="currentColor" stroke-width="1.8"
                              stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <h3>Fleet Health Overview</h3>
                </div>
                <div class="sp-fleet-grid">
                    ${merged.length ? merged.map(m => `
                        <div class="fleet-health-card">
                            <div class="fleet-health-plate">${escapeHtml(m.plate)}</div>
                            <div class="fleet-health-bar-wrap">
                                <div class="fleet-health-bar">
                                    <div class="fleet-health-bar-fill"
                                         style="width:${m.rate}%;background:${m.color}"></div>
                                </div>
                                <span class="fleet-health-rate" style="color:${m.color}">${m.rate}%</span>
                            </div>
                            <div class="fleet-health-meta">${m.good}/${m.total} components good</div>
                        </div>
                    `).join('') : `
                        <div style="grid-column:1/-1;text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                            No component data yet — submit an odometer reading to generate data
                        </div>`}
                </div>
            </div>`;
    }
};

// ── App Init ──────────────────────────────────────────
class DashboardApp {
    constructor() { this.refreshInterval = null; }

    async init() {
        if (!Session.check()) return;
        DOM.init();

        const user = Session.getUser();
        AppState.user = user;
        if (DOM.welcomeUserName) DOM.welcomeUserName.textContent = user.fullName;
        UI.setWelcomeDate();

        // Render card shells
        if (DOM.quickActionsGrid) {
            DOM.quickActionsGrid.innerHTML = AppState.cards
                .map(c => UI.createActionCard(c))
                .join('');
        }

        DOM.viewAllAlerts?.addEventListener('click', e => {
            e.preventDefault();
            window.location.href = '/ADMIN/HTML/alert.html';
        });

        await DataManager.updateDashboard();

        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(
            () => DataManager.updateDashboard(), 30_000
        );
    }
}

const app = new DashboardApp();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
window.DashboardApp = app;