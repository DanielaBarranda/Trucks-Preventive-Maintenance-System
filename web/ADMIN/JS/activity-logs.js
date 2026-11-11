// ========================================
// STARQUEEN PMTS - Activity Logs
// ========================================

SessionManager.guard('Admin');

const ActivityLogs = {
    data:          [],
    filteredData:  [],
    trucks:        [],
    driverSummary: [],
    tripSummary:   [],

    driverCategoryFilter: 'all',
    tripCategoryFilter:   'all',

    searchQuery:  '',
    truckFilter:  '',
    monthFilter:  '',
    yearFilter:   '',

    async init() {
        showLoading();
        await this.fetchAll();
        this.populateYearFilter();
        this.renderSummaryCards();
        this.renderDriverPerformance();
        this.renderTripSummary();
        this.render();
        this.bindEvents();
        hideLoading();
    },

    async fetchAll() {
        try {
            const [activities, trucks, driverSummary, tripSummary] = await Promise.all([
                fetch(`${CONFIG.API_BASE}/api/TruckActivity`).then(r => r.json()).catch(() => []),
                fetch(`${CONFIG.API_BASE}/api/Trucks`).then(r => r.json()).catch(() => []),
                fetch(`${CONFIG.API_BASE}/api/TruckActivity/driver-summary`).then(r => r.json()).catch(() => []),
                fetch(`${CONFIG.API_BASE}/api/TruckActivity/trip-summary`).then(r => r.json()).catch(() => []),
            ]);

            this.trucks        = trucks        || [];
            this.driverSummary = driverSummary || [];
            this.tripSummary   = tripSummary   || [];

            this.data = (activities || []).map(a => ({
                truckPlate: this.getTruckPlate(a.truck_id ?? a.truckId),
                truckName:  this.getTruckName(a.truck_id  ?? a.truckId),
                driver:     a.driver_name    ?? a.driverName    ?? '—',
                date:       a.date,
                farm:       a.farm           ?? '—',
                address:    a.address        ?? '—',
                callTime:   a.call_time      ?? a.callTime      ?? '—',
                plant:      a.plant          ?? '—',
                departure:  a.departure_time ?? a.departureTime ?? null,
                arrival:    a.arrival_time   ?? a.arrivalTime   ?? null,
            })).sort((a, b) => new Date(b.date) - new Date(a.date));

            this.filteredData = [...this.data];
        } catch (err) {
            console.error('Failed to fetch activity logs:', err);
        }
    },

    populateYearFilter() {
        const yearSelect = document.getElementById('yearFilter');
        if (!yearSelect) return;
        const years = [...new Set(
            this.data
                .map(a => a.date ? new Date(a.date).getFullYear() : null)
                .filter(y => y && !isNaN(y) && y > 1900)
        )].sort((a, b) => b - a);
        years.forEach(y => {
            const opt       = document.createElement('option');
            opt.value       = String(y);
            opt.textContent = String(y);
            yearSelect.appendChild(opt);
        });
    },

    // ── Category helpers ─────────────────────────────────────────────────────
    getCategory(plateNumber) {
        const truck = this.trucks.find(t =>
            t.plateNumber === plateNumber || t.plate_number === plateNumber
        );
        if (!truck) return 'Other';
        const c = ((truck.truckType || '') + ' ' + (truck.truckName || '')).toUpperCase();
        if (c.includes('ELF'))  return 'ELF';
        if (c.includes('10W'))  return '10W';
        if (c.includes('FWD'))  return 'FWD';
        if (c.includes('TW'))   return 'TW';
        if (c.includes('WING')) return 'Wing Van';
        return 'Other';
    },

    getCategoryClass(category) {
        const map = {
            'ELF': 'elf', 'FWD': 'fwd', 'TW': 'tw',
            '10W': 'cat-10w', 'Wing Van': 'wing-van', 'Other': 'other',
        };
        return map[category] || 'other';
    },

    getDriverCategory(d) { return this.getCategory(d.plate_number); },
    getTripCategory(t)   { return this.getCategory(t.plate_number); },

    // ── Date / Time helpers ──────────────────────────────────────────────────
    isBadDate(val) {
        if (!val) return true;
        const s = String(val);
        return s.startsWith('1900') || s.startsWith('0001') ||
               s.includes('01/01/1900') || s.includes('1900-01-01');
    },

    // "Apr 25, 2026"
    formatNiceDate(val) {
        if (!val || this.isBadDate(val)) return '—';
        const d = new Date(val);
        if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return '—';
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    },

    // "08:50 PM"
    formatNiceTime(val) {
        if (!val || this.isBadDate(val)) return '—';
        const d = new Date(val);
        if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return '—';
        // midnight check — likely unlogged
        if (d.getHours() === 0 && d.getMinutes() === 0) return '—';
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    },

    // ── Summary Cards ────────────────────────────────────────────────────────
    renderSummaryCards() {
        const container = document.getElementById('summaryCards');
        if (!container) return;

        const totalTrips    = this.data.length;
        const totalDrivers  = this.driverSummary.length;
        const totalRoutes   = this.driverSummary.reduce((s, d) => s + (d.total_routes_handled    || 0), 0);
        const totalExpenses = this.driverSummary.reduce((s, d) => s + (d.total_expenses_recorded || 0), 0);

        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-card-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="16" rx="2" stroke="#fff" stroke-width="2"/>
                        <path d="M3 9h18" stroke="#fff" stroke-width="2"/>
                    </svg>
                </div>
                <div class="summary-card-content">
                    <p class="summary-card-label">Total Trips</p>
                    <p class="summary-card-value">${totalTrips}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="#fff" stroke-width="2"/>
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="summary-card-content">
                    <p class="summary-card-label">Active Drivers</p>
                    <p class="summary-card-value">${totalDrivers}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#fff" stroke-width="2"/>
                        <circle cx="12" cy="9" r="2.5" stroke="#fff" stroke-width="2"/>
                    </svg>
                </div>
                <div class="summary-card-content">
                    <p class="summary-card-label">Total Routes</p>
                    <p class="summary-card-value">${totalRoutes}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="background:linear-gradient(135deg,#fa709a,#fee140)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                              stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="summary-card-content">
                    <p class="summary-card-label">Total Expenses</p>
                    <p class="summary-card-value">₱${Number(totalExpenses).toLocaleString('en-PH', {minimumFractionDigits:2})}</p>
                </div>
            </div>`;
    },

    // ── Driver Performance ───────────────────────────────────────────────────
    renderDriverPerformance() {
        const container = document.getElementById('driverPerformanceTable');
        if (!container) return;
        if (!this.driverSummary.length) { container.innerHTML = ''; return; }

        const rows = this.driverSummary.filter(d =>
            this.driverCategoryFilter === 'all' ||
            this.getDriverCategory(d) === this.driverCategoryFilter
        );

        container.innerHTML = `
            <div class="sp-section">
                <div class="sp-section-header">
                    <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="6" r="4" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7"
                              stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                    <h3 class="sp-section-title">Driver Performance Summary</h3>
                    <span class="sp-badge">SP_Driver_Performance_Activity_Summary</span>
                    <div class="sp-section-filters">
                        <select class="sp-filter-select" id="driverCategoryFilter">
                            <option value="all">All Truck Types</option>
                            <option value="ELF"      ${this.driverCategoryFilter==='ELF'?'selected':''}>ELF Trucks</option>
                            <option value="FWD"      ${this.driverCategoryFilter==='FWD'?'selected':''}>FWD Trucks</option>
                            <option value="TW"       ${this.driverCategoryFilter==='TW'?'selected':''}>TW Trucks</option>
                            <option value="10W"      ${this.driverCategoryFilter==='10W'?'selected':''}>10W Trucks</option>
                            <option value="Wing Van" ${this.driverCategoryFilter==='Wing Van'?'selected':''}>Wing Van</option>
                        </select>
                    </div>
                </div>
                <div class="sp-table-wrapper">
                    <table class="activity-table sp-table">
                        <thead>
                            <tr>
                                <th>Driver</th>
                                <th>Truck Plate</th>
                                <th>Type</th>
                                <th>Departures</th>
                                <th>Arrivals</th>
                                <th>Routes</th>
                                <th>Total Expenses</th>
                                <th>Latest Activity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows.map(d => {
                                const cat      = this.getDriverCategory(d);
                                const catClass = this.getCategoryClass(cat);
                                return `
                                <tr class="fade-in">
                                    <td><strong>${escapeHtml(d.full_name ?? '—')}</strong></td>
                                    <td>${escapeHtml(d.plate_number ?? '—')}</td>
                                    <td><span class="category-pill ${catClass}">${cat}</span></td>
                                    <td><span class="stat-pill blue">${d.total_departures ?? 0}</span></td>
                                    <td><span class="stat-pill green">${d.total_arrivals  ?? 0}</span></td>
                                    <td>${d.total_routes_handled ?? 0}</td>
                                    <td>${d.total_expenses_recorded != null
                                        ? '₱' + Number(d.total_expenses_recorded)
                                              .toLocaleString('en-PH',{minimumFractionDigits:2})
                                        : '—'}</td>
                                    <td>${this.formatNiceDate(d.latest_activity)}</td>
                                </tr>`;
                            }).join('') : `
                                <tr><td colspan="8" style="text-align:center;padding:24px;color:var(--color-text-secondary);">
                                    No drivers found for this truck type
                                </td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('driverCategoryFilter')?.addEventListener('change', e => {
            this.driverCategoryFilter = e.target.value;
            this.renderDriverPerformance();
        });
    },

    // ── First & Last Trip ────────────────────────────────────────────────────
    // SP columns: truck_id, plate_number, first_activity_date, last_activity_date
    renderTripSummary() {
        const container = document.getElementById('tripSummaryTable');
        if (!container) return;
        if (!this.tripSummary.length) { container.innerHTML = ''; return; }

        const rows = this.tripSummary.filter(t =>
            this.tripCategoryFilter === 'all' ||
            this.getTripCategory(t) === this.tripCategoryFilter
        );

        container.innerHTML = `
            <div class="sp-section">
                <div class="sp-section-header">
                    <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M10 6v4.5l2.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                    <h3 class="sp-section-title">First &amp; Last Trip Per Truck</h3>
                    <span class="sp-badge">SP_Monitoring_The_First_And_Last_Trip_Of_A_Truck</span>
                    <div class="sp-section-filters">
                        <select class="sp-filter-select" id="tripCategoryFilter">
                            <option value="all">All Truck Types</option>
                            <option value="ELF"      ${this.tripCategoryFilter==='ELF'?'selected':''}>ELF Trucks</option>
                            <option value="FWD"      ${this.tripCategoryFilter==='FWD'?'selected':''}>FWD Trucks</option>
                            <option value="TW"       ${this.tripCategoryFilter==='TW'?'selected':''}>TW Trucks</option>
                            <option value="10W"      ${this.tripCategoryFilter==='10W'?'selected':''}>10W Trucks</option>
                            <option value="Wing Van" ${this.tripCategoryFilter==='Wing Van'?'selected':''}>Wing Van</option>
                        </select>
                    </div>
                </div>
                <div class="sp-table-wrapper">
                    <table class="activity-table sp-table">
                        <thead>
                            <tr>
                                <th>Truck Plate</th>
                                <th>Type</th>
                                <th>First Trip Date</th>
                                <th>First Trip Time</th>
                                <th>Last Trip Date</th>
                                <th>Last Trip Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length ? rows.map(t => {
                                const cat      = this.getTripCategory(t);
                                const catClass = this.getCategoryClass(cat);
                                const firstDate = this.formatNiceDate(t.first_activity_date);
                                const firstTime = this.formatNiceTime(t.first_activity_date);
                                const lastDate  = this.formatNiceDate(t.last_activity_date);
                                const lastTime  = this.formatNiceTime(t.last_activity_date);
                                return `
                                <tr class="fade-in">
                                    <td><strong>${escapeHtml(t.plate_number ?? '—')}</strong></td>
                                    <td><span class="category-pill ${catClass}">${cat}</span></td>
                                    <td>${firstDate}</td>
                                    <td>${firstTime !== '—'
                                        ? `<span class="time-chip">${firstTime}</span>`
                                        : '<span style="color:#9ca3af;font-size:12px;">No departure yet</span>'}</td>
                                    <td>${lastDate}</td>
                                    <td>${lastTime !== '—'
                                        ? `<span class="time-chip">${lastTime}</span>`
                                        : '—'}</td>
                                </tr>`;
                            }).join('') : `
                                <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-secondary);">
                                    No trips found for this truck type
                                </td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('tripCategoryFilter')?.addEventListener('change', e => {
            this.tripCategoryFilter = e.target.value;
            this.renderTripSummary();
        });
    },

    // ── Activity History ─────────────────────────────────────────────────────
    getTruckPlate(truckId) {
        const t = this.trucks.find(t => t.truck_ID === truckId || t.truckId === truckId);
        return t?.plateNumber ?? '—';
    },

    getTruckName(truckId) {
        const t = this.trucks.find(t => t.truck_ID === truckId || t.truckId === truckId);
        return t?.truckName ?? '—';
    },

    applyFilters() {
        const search = this.searchQuery.toLowerCase();
        const month  = this.monthFilter ? parseInt(this.monthFilter) : null;
        const year   = this.yearFilter  ? parseInt(this.yearFilter)  : null;
        const truck  = this.truckFilter;

        this.filteredData = this.data.filter(log => {
            const matchesSearch = !search ||
                log.truckPlate?.toLowerCase().includes(search) ||
                log.truckName?.toLowerCase().includes(search)  ||
                log.driver?.toLowerCase().includes(search)     ||
                log.farm?.toLowerCase().includes(search)       ||
                log.address?.toLowerCase().includes(search);

            const matchesTruck = !truck ||
                log.truckName?.toLowerCase().includes(truck.toLowerCase());

            let matchesMonth = true, matchesYear = true;
            if ((month || year) && log.date) {
                const d = new Date(log.date);
                if (!isNaN(d.getTime())) {
                    if (month) matchesMonth = (d.getMonth() + 1) === month;
                    if (year)  matchesYear  = d.getFullYear()     === year;
                }
            }

            return matchesSearch && matchesTruck && matchesMonth && matchesYear;
        });

        this.updateFilterIndicator();
        this.render();
    },

    updateFilterIndicator() {
        const bar  = document.getElementById('filterActiveBar');
        const text = document.getElementById('filterActiveText');
        if (!bar || !text) return;

        const MONTHS = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        const parts  = [];

        if (this.monthFilter) parts.push(MONTHS[parseInt(this.monthFilter) - 1]);
        if (this.yearFilter)  parts.push(this.yearFilter);
        if (this.truckFilter) parts.push(this.truckFilter + ' Trucks');
        if (this.searchQuery) parts.push(`"${this.searchQuery}"`);

        if (parts.length > 0) {
            text.textContent  = `Showing results for: ${parts.join(' · ')}  (${this.filteredData.length} record${this.filteredData.length !== 1 ? 's' : ''})`;
            bar.style.display = 'block';
        } else {
            bar.style.display = 'none';
        }
    },

    // ── Activity History Table ────────────────────────────────────────────────
    // Departure & Arrival split into separate Date + Time columns
    render() {
        const tbody      = document.getElementById('activityTableBody');
        const emptyState = document.getElementById('emptyState');
        const countEl    = document.getElementById('activityCount');

        if (!tbody) return;
        if (countEl) countEl.textContent = this.filteredData.length;

        if (this.filteredData.length === 0) {
            tbody.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');
        tbody.innerHTML = this.filteredData.map(log => `
            <tr class="fade-in">
                <td>
                    <div class="truck-plate-cell">
                        <span class="truck-name-text">${escapeHtml(log.truckName)}</span>
                        <span class="truck-plate-text">${escapeHtml(log.truckPlate)}</span>
                    </div>
                </td>
                <td>${escapeHtml(log.driver)}</td>
                <td>${this.formatNiceDate(log.date)}</td>
                <td>${escapeHtml(log.farm)}</td>
                <td>${escapeHtml(log.address)}</td>
                <td>${escapeHtml(log.callTime)}</td>
                <td>${escapeHtml(log.plant)}</td>
                <td>${this.formatNiceDate(log.departure)}</td>
                <td>${this.formatNiceTime(log.departure)}</td>
                <td>${this.formatNiceDate(log.arrival)}</td>
                <td>${this.formatNiceTime(log.arrival)}</td>
            </tr>
        `).join('');
    },

    bindEvents() {
        const searchInput = document.getElementById('searchInput');
        const truckFilter = document.getElementById('truckModelFilter');
        const monthFilter = document.getElementById('monthFilter');
        const yearFilter  = document.getElementById('yearFilter');
        const clearBtn    = document.getElementById('clearFilters');

        searchInput?.addEventListener('input', () => {
            this.searchQuery = searchInput.value;
            this.applyFilters();
        });

        truckFilter?.addEventListener('change', () => {
            this.truckFilter = truckFilter.value;
            this.applyFilters();
        });

        monthFilter?.addEventListener('change', () => {
            this.monthFilter = monthFilter.value;
            this.applyFilters();
        });

        yearFilter?.addEventListener('change', () => {
            this.yearFilter = yearFilter.value;
            this.applyFilters();
        });

        clearBtn?.addEventListener('click', () => {
            this.searchQuery = '';
            this.truckFilter = '';
            this.monthFilter = '';
            this.yearFilter  = '';
            if (searchInput) searchInput.value = '';
            if (truckFilter) truckFilter.value = '';
            if (monthFilter) monthFilter.value = '';
            if (yearFilter)  yearFilter.value  = '';
            this.applyFilters();
        });
    }
};

function showLoading() { document.getElementById('loadingOverlay')?.classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('active'); }

document.addEventListener('DOMContentLoaded', () => ActivityLogs.init());