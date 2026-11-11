// ========================================
// STARQUEEN PMTS - Expenses
// ========================================

const username = localStorage.getItem('username');
const role     = localStorage.getItem('role');
if (!username || !role) window.location.href = '/ADMIN/HTML/login.html';
if (role === 'Driver')  window.location.href = '/DRIVERS/HTML/driver-dashboard.html';

const State = {
    trucks:        [],
    expenses:      [],
    odometers:     [],
    analysis:      [], // SP_Expense_Analysis_with_Monthly_Filtering
    monthlyCosts:  [], // SP_Total_Monthly_Maintenance_Cost_Per_Trucks
    mostSpent:     [], // SP_Most_Spent_Truck_Maintenance_per_Month
    yearlyCosts:   [], // SP_Total_Yearly_Maintenance_Cost_Per_Truck
    minMonthlyCosts: [], // SP_Minimum_Monthly_Maintenance_Cost_Per_Truck
    searchQuery:   '',
    typeFilter:    'all',
    period:        'all',
    month:         new Date().getMonth() + 1,
    year:          new Date().getFullYear(),

    // SP section filters
    analysisFilter:      { year: 'all', month: 'all', truck: 'all' },
    monthlyFilter:       { year: 'all', month: 'all', truck: 'all' },
    mostSpentFilter:     { year: 'all', month: 'all', truck: 'all' },
    yearlyFilter:        { year: 'all', truck: 'all' },
    minMonthlyFilter:    { year: 'all', month: 'all', truck: 'all' },
};

const trucksList       = document.getElementById('trucksList');
const emptyState       = document.getElementById('emptyState');
const searchInput      = document.getElementById('searchInput');
const typeFilterEl     = document.getElementById('typeFilter');
const loadingOverlay   = document.getElementById('loadingOverlay');
const totalAmount      = document.getElementById('totalAmount');
const totalMeta        = document.getElementById('totalMeta');
const totalPeriod      = document.getElementById('totalPeriod');
const periodSelect     = document.getElementById('periodSelect');
const monthYearFilters = document.getElementById('monthYearFilters');
const monthSelect      = document.getElementById('monthSelect');
const yearSelect       = document.getElementById('yearSelect');

function showLoading() { loadingOverlay?.classList.add('active'); }
function hideLoading() { loadingOverlay?.classList.remove('active'); }

function fmt(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

function getTruckType(truck) {
    const c = ((truck.truckName || '') + ' ' + (truck.truckType || '')).toUpperCase();
    if (c.includes('ELF'))  return 'ELF';
    if (c.includes('FWD'))  return 'FWD';
    if (c.includes('10W'))  return '10W';
    if (c.includes('TW'))   return 'TW';
    if (c.includes('WING')) return 'WING_VAN';
    return 'OTHER';
}

const TYPE_LABELS  = { ELF:'ELF Trucks', FWD:'FWD Trucks', TW:'TW Trucks', '10W':'10W Trucks', WING_VAN:'Wing Van Trucks', OTHER:'Other Trucks' };
const TYPE_ORDER   = ['ELF','FWD','TW','10W','WING_VAN','OTHER'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Filter Helpers ────────────────────────────────────────────────────────

function getUniqueYears(data, yearKey = 'year') {
    return [...new Set(data.map(d => d[yearKey]).filter(Boolean))].sort((a,b) => b - a);
}

function getUniqueMonths(data, monthKey = 'month') {
    return [...new Set(data.map(d => d[monthKey]).filter(Boolean))].sort((a,b) => a - b);
}

function getUniqueTrucks(data, nameKey = 'truck_name') {
    return [...new Set(data.map(d => d[nameKey]).filter(Boolean))].sort();
}

function buildFilterBar(sectionId, filterState, data, { hasYear=true, hasMonth=true, hasTruck=true, yearKey='year', monthKey='month', truckKey='truck_name' } = {}) {
    const years  = getUniqueYears(data, yearKey);
    const months = getUniqueMonths(data, monthKey);
    const trucks = getUniqueTrucks(data, truckKey);

    return `
        <div class="sp-filter-bar" id="filterBar_${sectionId}">
            ${hasYear ? `
            <div class="sp-filter-group">
                <label class="sp-filter-label">Year</label>
                <select class="sp-filter-select" onchange="updateSpFilter('${sectionId}','year',this.value)">
                    <option value="all">All Years</option>
                    ${years.map(y => `<option value="${y}" ${filterState.year == y ? 'selected' : ''}>${y}</option>`).join('')}
                </select>
            </div>` : ''}
            ${hasMonth ? `
            <div class="sp-filter-group">
                <label class="sp-filter-label">Month</label>
                <select class="sp-filter-select" onchange="updateSpFilter('${sectionId}','month',this.value)">
                    <option value="all">All Months</option>
                    ${months.map(m => `<option value="${m}" ${filterState.month == m ? 'selected' : ''}>${MONTH_NAMES[m-1]}</option>`).join('')}
                </select>
            </div>` : ''}
            ${hasTruck ? `
            <div class="sp-filter-group">
                <label class="sp-filter-label">Truck</label>
                <select class="sp-filter-select" onchange="updateSpFilter('${sectionId}','truck',this.value)">
                    <option value="all">All Trucks</option>
                    ${trucks.map(t => `<option value="${t}" ${filterState.truck === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>` : ''}
            <button class="sp-filter-clear" onclick="clearSpFilter('${sectionId}')">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Clear
            </button>
        </div>`;
}

// Global filter update handler
window.updateSpFilter = function(sectionId, key, value) {
    const map = {
        analysis:   'analysisFilter',
        monthly:    'monthlyFilter',
        mostSpent:  'mostSpentFilter',
        yearly:     'yearlyFilter',
        minMonthly: 'minMonthlyFilter',
    };
    if (map[sectionId]) {
        State[map[sectionId]][key] = value;
        if (sectionId === 'analysis')   renderExpenseAnalysis();
        if (sectionId === 'monthly')    renderMonthlyCost();
        if (sectionId === 'mostSpent')  renderMostSpent();
        if (sectionId === 'yearly')     renderYearlyCost();
        if (sectionId === 'minMonthly') renderMinMonthlyCost();
    }
};

window.clearSpFilter = function(sectionId) {
    const map = {
        analysis:   'analysisFilter',
        monthly:    'monthlyFilter',
        mostSpent:  'mostSpentFilter',
        yearly:     'yearlyFilter',
        minMonthly: 'minMonthlyFilter',
    };
    if (map[sectionId]) {
        // yearly only has year + truck filters
        State[map[sectionId]] = sectionId === 'yearly'
            ? { year: 'all', truck: 'all' }
            : { year: 'all', month: 'all', truck: 'all' };
        if (sectionId === 'analysis')   renderExpenseAnalysis();
        if (sectionId === 'monthly')    renderMonthlyCost();
        if (sectionId === 'mostSpent')  renderMostSpent();
        if (sectionId === 'yearly')     renderYearlyCost();
        if (sectionId === 'minMonthly') renderMinMonthlyCost();
    }
};

function applySpFilter(data, filterState, { yearKey='year', monthKey='month', truckKey='truck_name' } = {}) {
    return data.filter(d => {
        if (filterState.year  !== 'all' && String(d[yearKey])  !== String(filterState.year))  return false;
        if (filterState.month !== 'all' && String(d[monthKey]) !== String(filterState.month)) return false;
        if (filterState.truck !== 'all' && d[truckKey]         !== filterState.truck)         return false;
        return true;
    });
}

// ── Expense Helpers ───────────────────────────────────────────────────────

function getFilteredExpenses(truckId) {
    return State.expenses.filter(e => {
        if ((e.truck_id ?? e.truckId) !== truckId) return false;
        if (State.period === 'monthly') {
            const d = new Date(e.expense_date ?? e.expenseDate);
            return d.getMonth() + 1 === State.month && d.getFullYear() === State.year;
        }
        return true;
    });
}

function sortExpenses(expenses) {
    return [...expenses].sort((a, b) => {
        const diff = new Date(b.expense_date ?? b.expenseDate) - new Date(a.expense_date ?? a.expenseDate);
        if (diff !== 0) return diff;
        return (b.expense_id ?? b.expenseId ?? 0) - (a.expense_id ?? a.expenseId ?? 0);
    });
}

function populateYears() {
    const years = [...new Set(State.expenses.map(e =>
        new Date(e.expense_date ?? e.expenseDate).getFullYear()
    ))].filter(y => !isNaN(y)).sort((a, b) => b - a);
    if (!years.length) years.push(new Date().getFullYear());
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    State.year = years[0];
}

function updateSummaryCard() {
    const filtered = State.trucks.flatMap(t => getFilteredExpenses(t.truck_ID));
    const total    = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const count    = filtered.length;
    totalAmount.textContent = fmt(total);
    totalMeta.textContent   = `${count} Transaction${count !== 1 ? 's' : ''}`;
    totalPeriod.textContent = State.period === 'monthly'
        ? `${MONTH_NAMES[State.month - 1]} ${State.year}` : '';
}

// ── SP: Expense Analysis ──────────────────────────────────────────────────
// Source: SP_Expense_Analysis_with_Monthly_Filtering
// Filters: Year, Month (from latest_expense_date), Truck
function renderExpenseAnalysis() {
    const container = document.getElementById('expenseAnalysisSection');
    if (!container) return;

    // Apply filters
    const filtered = State.analysis.filter(a => {
        if (State.analysisFilter.truck !== 'all' && a.truck_name !== State.analysisFilter.truck) return false;
        if (State.analysisFilter.year  !== 'all' && a.latest_expense_date) {
            const y = new Date(a.latest_expense_date).getFullYear();
            if (String(y) !== String(State.analysisFilter.year)) return false;
        }
        if (State.analysisFilter.month !== 'all' && a.latest_expense_date) {
            const m = new Date(a.latest_expense_date).getMonth() + 1;
            if (String(m) !== String(State.analysisFilter.month)) return false;
        }
        return true;
    });

    // ── Group by truck type, then sort by highest expense within each group ──
    const TYPE_ORDER_ANALYSIS = ['ELF Truck', 'FWD Truck', 'TW Truck', '10W Truck', 'Wing Van', 'Other'];
    const TYPE_LABELS_ANALYSIS = {
        'ELF Truck': 'ELF Trucks',
        'FWD Truck': 'FWD Trucks',
        'TW Truck':  'TW Trucks',
        '10W Truck': '10W Trucks',
        'Wing Van':  'Wing Van Trucks',
        'Other':     'Other Trucks'
    };

    // Group rows
    const groups = {};
    filtered.forEach(a => {
        const type = a.truck_type ?? 'Other';
        const key  = TYPE_ORDER_ANALYSIS.includes(type) ? type : 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    });

    // Sort within each group: has expenses first, then by total desc
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
            const aHas = (a.expense_count ?? 0) > 0;
            const bHas = (b.expense_count ?? 0) > 0;
            if (aHas !== bHas) return aHas ? -1 : 1;
            return (b.total_expenses ?? 0) - (a.total_expenses ?? 0);
        });
    });

    // Build table rows with group headers
    let tableRows = '';
    TYPE_ORDER_ANALYSIS.forEach(type => {
        if (!groups[type]?.length) return;
        tableRows += `
            <tr>
                <td colspan="8" style="
                    background: #f3f4f6;
                    padding: 7px 16px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #6b7280;
                    border-bottom: 1px solid #e5e7eb;
                ">${TYPE_LABELS_ANALYSIS[type] ?? type}</td>
            </tr>`;
        tableRows += groups[type].map(a => `
            <tr class="fade-in">
                <td><strong>${a.truck_name ?? '—'}</strong></td>
                <td>${a.plate_number ?? '—'}</td>
                <td>${a.truck_type ?? '—'}</td>
                <td><span class="stat-pill ${(a.expense_count ?? 0) > 0 ? 'blue' : 'green'}">${a.expense_count ?? 0}</span></td>
                <td>${a.min_expense != null ? fmt(a.min_expense) : '—'}</td>
                <td>${a.max_expense != null ? fmt(a.max_expense) : '—'}</td>
                <td><strong>${a.total_expenses != null ? fmt(a.total_expenses) : '—'}</strong></td>
                <td>${a.latest_expense_date
                    ? new Date(a.latest_expense_date).toLocaleDateString('en-US',
                        {month:'2-digit',day:'2-digit',year:'numeric'})
                    : '—'}</td>
            </tr>
        `).join('');
    });

    if (!tableRows) {
        tableRows = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
            No results for selected filters
        </td></tr>`;
    }

    // Summary stats
    const totalAll   = filtered.reduce((s,a) => s + (a.total_expenses||0), 0);
    const withData   = filtered.filter(a => a.expense_count > 0);
    const avgExpense = withData.length ? totalAll / withData.length : 0;
    const topSpender = [...filtered].sort((a,b) => (b.total_expenses||0)-(a.total_expenses||0)).find(a => a.total_expenses > 0);

    const allTrucks = [...new Set(State.analysis.map(a => a.truck_name).filter(Boolean))].sort();
    const allYears  = [...new Set(State.analysis.filter(a => a.latest_expense_date)
        .map(a => new Date(a.latest_expense_date).getFullYear()))].sort((a,b) => b-a);
    const allMonths = [...new Set(State.analysis.filter(a => a.latest_expense_date)
        .map(a => new Date(a.latest_expense_date).getMonth() + 1))].sort((a,b) => a-b);

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M2 14V8l4-4 4 4 4-6" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">Expense Analysis Per Truck</h3>
            </div>

            <div class="sp-filter-bar">
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Year</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('analysis','year',this.value)">
                        <option value="all">All Years</option>
                        ${allYears.map(y => `<option value="${y}" ${State.analysisFilter.year == y ? 'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Month</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('analysis','month',this.value)">
                        <option value="all">All Months</option>
                        ${allMonths.map(m => `<option value="${m}" ${State.analysisFilter.month == m ? 'selected':''}>${MONTH_NAMES[m-1]}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Truck</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('analysis','truck',this.value)">
                        <option value="all">All Trucks</option>
                        ${allTrucks.map(t => `<option value="${t}" ${State.analysisFilter.truck === t ? 'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <button class="sp-filter-clear" onclick="clearSpFilter('analysis')">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Clear
                </button>
                <span class="sp-filter-result">${filtered.length} truck${filtered.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="alert-stat-grid">
                <div class="alert-stat-card total">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Fleet Total</div>
                        <div class="alert-stat-value" style="font-size:18px;">${fmt(totalAll)}</div>
                    </div>
                </div>
                <div class="alert-stat-card total">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <rect x="2" y="7" width="20" height="14" rx="2"/>
                            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Avg Per Truck</div>
                        <div class="alert-stat-value" style="font-size:18px;">${fmt(avgExpense)}</div>
                    </div>
                </div>
                <div class="alert-stat-card overdue">
                    <div class="alert-stat-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alert-stat-label">Highest Spender</div>
                        <div class="alert-stat-value" style="font-size:14px;font-weight:700;">${topSpender?.truck_name ?? '—'}</div>
                        <div style="font-size:12px;color:#b91c1c;margin-top:2px;">${topSpender ? fmt(topSpender.total_expenses) : ''}</div>
                    </div>
                </div>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Truck</th><th>Plate</th><th>Type</th><th>Records</th>
                            <th>Min Expense</th><th>Max Expense</th><th>Total</th><th>Latest</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>`;
}



// ── SP: Monthly Cost ──────────────────────────────────────────────────────
// Source: SP_Total_Monthly_Maintenance_Cost_Per_Trucks
// Filters: Year, Month, Truck (by plate_number)
function renderMonthlyCost() {
    const container = document.getElementById('monthlyCostSection');
    if (!container) return;

    const filtered = applySpFilter(State.monthlyCosts, State.monthlyFilter, { truckKey: 'plate_number' });
    const rows     = [...filtered].sort((a,b) => b.year - a.year || b.month - a.month);

    const allYears  = getUniqueYears(State.monthlyCosts);
    const allMonths = getUniqueMonths(State.monthlyCosts);
    const allTrucks = [...new Set(State.monthlyCosts.map(m => m.plate_number).filter(Boolean))].sort();

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M2 7h16M7 3v4M13 3v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">Total Monthly Maintenance Cost Per Truck</h3>
            </div>

            <div class="sp-filter-bar">
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Year</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('monthly','year',this.value)">
                        <option value="all">All Years</option>
                        ${allYears.map(y => `<option value="${y}" ${State.monthlyFilter.year == y ? 'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Month</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('monthly','month',this.value)">
                        <option value="all">All Months</option>
                        ${allMonths.map(m => `<option value="${m}" ${State.monthlyFilter.month == m ? 'selected':''}>${MONTH_NAMES[m-1]}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Truck</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('monthly','truck',this.value)">
                        <option value="all">All Trucks</option>
                        ${allTrucks.map(t => `<option value="${t}" ${State.monthlyFilter.truck === t ? 'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <button class="sp-filter-clear" onclick="clearSpFilter('monthly')">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Clear
                </button>
                <span class="sp-filter-result">${rows.length} record${rows.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr><th>Plate</th><th>Year</th><th>Month</th><th>Monthly Cost</th></tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(m => `
                            <tr class="fade-in">
                                <td><strong>${m.plate_number ?? '—'}</strong></td>
                                <td>${m.year}</td>
                                <td>${MONTH_NAMES[(m.month ?? 1) - 1]}</td>
                                <td><strong style="color:var(--color-primary)">${fmt(m.monthly_truck_cost)}</strong></td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                No results for selected filters
                            </td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: Most Spent Per Month ──────────────────────────────────────────────
// Source: SP_Most_Spent_Truck_Maintenance_per_Month
// Filters: Year, Month, Truck (by truck_name)
function renderMostSpent() {
    const container = document.getElementById('mostSpentSection');
    if (!container) return;

    const filtered = applySpFilter(State.mostSpent, State.mostSpentFilter);
    const rows     = [...filtered].sort((a,b) => b.max_monthly_expense - a.max_monthly_expense);

    const allYears  = getUniqueYears(State.mostSpent);
    const allMonths = getUniqueMonths(State.mostSpent);
    const allTrucks = getUniqueTrucks(State.mostSpent);

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l2 6h6l-5 3.5 2 6L10 14l-5 3.5 2-6L2 8h6z"
                          stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">Most Spent Truck Maintenance Per Month</h3>
            </div>

            <div class="sp-filter-bar">
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Year</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('mostSpent','year',this.value)">
                        <option value="all">All Years</option>
                        ${allYears.map(y => `<option value="${y}" ${State.mostSpentFilter.year == y ? 'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Month</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('mostSpent','month',this.value)">
                        <option value="all">All Months</option>
                        ${allMonths.map(m => `<option value="${m}" ${State.mostSpentFilter.month == m ? 'selected':''}>${MONTH_NAMES[m-1]}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Truck</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('mostSpent','truck',this.value)">
                        <option value="all">All Trucks</option>
                        ${allTrucks.map(t => `<option value="${t}" ${State.mostSpentFilter.truck === t ? 'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <button class="sp-filter-clear" onclick="clearSpFilter('mostSpent')">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Clear
                </button>
                <span class="sp-filter-result">${rows.length} record${rows.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr><th>Truck</th><th>Year</th><th>Month</th><th>Highest Expense</th></tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(m => `
                            <tr class="fade-in">
                                <td><strong>${m.truck_name ?? '—'}</strong></td>
                                <td>${m.year}</td>
                                <td>${MONTH_NAMES[(m.month ?? 1) - 1]}</td>
                                <td><span class="stat-pill red">${fmt(m.max_monthly_expense)}</span></td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                No results for selected filters
                            </td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}


// ── SP: Yearly Cost ───────────────────────────────────────────────────────
// Source: SP_Total_Yearly_Maintenance_Cost_Per_Truck
// Shows: total yearly expense per truck grouped by year
function renderYearlyCost() {
    const container = document.getElementById('yearlyCostSection');
    if (!container) return;

    const filtered = State.yearlyCosts.filter(r => {
        if (State.yearlyFilter.year  !== 'all' && String(r.year)         !== String(State.yearlyFilter.year))  return false;
        if (State.yearlyFilter.truck !== 'all' && r.plate_number         !== State.yearlyFilter.truck)         return false;
        return true;
    });

    const rows      = [...filtered].sort((a,b) => b.year - a.year);
    const allYears  = getUniqueYears(State.yearlyCosts);
    const allTrucks = [...new Set(State.yearlyCosts.map(r => r.plate_number).filter(Boolean))].sort();

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10 6v4.5l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">Total Yearly Maintenance Cost Per Truck</h3>
            </div>

            <div class="sp-filter-bar">
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Year</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('yearly','year',this.value)">
                        <option value="all">All Years</option>
                        ${allYears.map(y => `<option value="${y}" ${State.yearlyFilter.year == y ? 'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Truck</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('yearly','truck',this.value)">
                        <option value="all">All Trucks</option>
                        ${allTrucks.map(t => `<option value="${t}" ${State.yearlyFilter.truck === t ? 'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <button class="sp-filter-clear" onclick="clearSpFilter('yearly')">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Clear
                </button>
                <span class="sp-filter-result">${rows.length} record${rows.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr><th>Plate</th><th>Year</th><th>Yearly Cost</th></tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(r => `
                            <tr class="fade-in">
                                <td><strong>${r.plate_number ?? '—'}</strong></td>
                                <td>${r.year}</td>
                                <td><strong style="color:var(--color-primary)">${fmt(r.yearly_truck_cost)}</strong></td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No results for selected filters
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── SP: Minimum Monthly Cost ──────────────────────────────────────────────
// Source: SP_Minimum_Monthly_Maintenance_Cost_Per_Truck
// Shows: lowest single expense recorded per truck per month
function renderMinMonthlyCost() {
    const container = document.getElementById('minMonthlyCostSection');
    if (!container) return;

    const filtered = State.minMonthlyCosts.filter(r => {
        if (State.minMonthlyFilter.year  !== 'all' && String(r.expense_year)  !== String(State.minMonthlyFilter.year))  return false;
        if (State.minMonthlyFilter.month !== 'all' && String(r.expense_month) !== String(State.minMonthlyFilter.month)) return false;
        if (State.minMonthlyFilter.truck !== 'all' && r.plate_number          !== State.minMonthlyFilter.truck)         return false;
        return true;
    });

    const rows      = [...filtered].sort((a,b) => b.expense_year - a.expense_year || b.expense_month - a.expense_month);
    const allYears  = [...new Set(State.minMonthlyCosts.map(r => r.expense_year).filter(Boolean))].sort((a,b) => b-a);
    const allMonths = [...new Set(State.minMonthlyCosts.map(r => r.expense_month).filter(Boolean))].sort((a,b) => a-b);
    const allTrucks = [...new Set(State.minMonthlyCosts.map(r => r.plate_number).filter(Boolean))].sort();

    container.innerHTML = `
        <div class="sp-section">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M4 14l4-4 4 4 4-8" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">Minimum Monthly Maintenance Cost Per Truck</h3>
            </div>

            <div class="sp-filter-bar">
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Year</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('minMonthly','year',this.value)">
                        <option value="all">All Years</option>
                        ${allYears.map(y => `<option value="${y}" ${State.minMonthlyFilter.year == y ? 'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Month</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('minMonthly','month',this.value)">
                        <option value="all">All Months</option>
                        ${allMonths.map(m => `<option value="${m}" ${State.minMonthlyFilter.month == m ? 'selected':''}>${MONTH_NAMES[m-1]}</option>`).join('')}
                    </select>
                </div>
                <div class="sp-filter-group">
                    <label class="sp-filter-label">Truck</label>
                    <select class="sp-filter-select" onchange="updateSpFilter('minMonthly','truck',this.value)">
                        <option value="all">All Trucks</option>
                        ${allTrucks.map(t => `<option value="${t}" ${State.minMonthlyFilter.truck === t ? 'selected':''}>${t}</option>`).join('')}
                    </select>
                </div>
                <button class="sp-filter-clear" onclick="clearSpFilter('minMonthly')">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    Clear
                </button>
                <span class="sp-filter-result">${rows.length} record${rows.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr><th>Plate</th><th>Year</th><th>Month</th><th>Minimum Expense</th></tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(r => `
                            <tr class="fade-in">
                                <td><strong>${r.plate_number ?? '—'}</strong></td>
                                <td>${r.expense_year}</td>
                                <td>${MONTH_NAMES[(r.expense_month ?? 1) - 1]}</td>
                                <td><span class="stat-pill green">${fmt(r.min_monthly_expense)}</span></td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No results for selected filters
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

async function fetchData() {
    showLoading();
    try {
        const [trucks, expenses, odometers, analysis, monthlyCosts, mostSpent, yearlyCosts, minMonthlyCosts] = await Promise.all([
            fetch(`${CONFIG.API_BASE}/api/Trucks`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckOdometer`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/analysis`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/monthly-cost`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/most-spent`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/yearly-cost`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/TruckExpenses/min-monthly-cost`).then(r => r.json()).catch(() => []),
        ]);

        State.trucks           = trucks           || [];
        State.expenses         = expenses         || [];
        State.odometers        = odometers        || [];
        State.analysis         = analysis         || [];
        State.monthlyCosts     = monthlyCosts     || [];
        State.mostSpent        = mostSpent        || [];
        State.yearlyCosts      = yearlyCosts      || [];
        State.minMonthlyCosts  = minMonthlyCosts  || [];

        populateYears();
        monthSelect.value = String(State.month);
        updateSummaryCard();
        renderExpenseAnalysis();
        renderMonthlyCost();
        renderMostSpent();
        renderYearlyCost();
        renderMinMonthlyCost();
        render();

        try {
            const openTruckId = localStorage.getItem('openExpenseTruckId');
            if (openTruckId) {
                localStorage.removeItem('openExpenseTruckId');
                const truck = State.trucks.find(t => String(t.truck_ID) === String(openTruckId));
                if (truck) setTimeout(() => openExpenseModal(truck), 300);
            }
        } catch (e) { /* ignore */ }

    } catch (err) {
        console.error('Error fetching data:', err);
    } finally {
        hideLoading();
    }
}

function render() {
    trucksList.querySelectorAll('.truck-group').forEach(el => el.remove());
    const filtered = State.trucks.filter(truck => {
        const query = State.searchQuery.toLowerCase();
        if (query) {
            const name  = (truck.truckName  || '').toLowerCase();
            const plate = (truck.plateNumber || '').toLowerCase();
            if (!name.includes(query) && !plate.includes(query)) return false;
        }
        if (State.typeFilter !== 'all' && getTruckType(truck) !== State.typeFilter) return false;
        return true;
    });

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
    const truckExpenses = getFilteredExpenses(truck.truck_ID);
    const total         = truckExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const count         = truckExpenses.length;
    const hasExpenses   = count > 0;
    const spData        = State.analysis.find(a => a.truck_id === truck.truck_ID);

    const card = document.createElement('div');
    card.className = 'truck-card expense-card';
    card.innerHTML = `
        <div class="truck-card-header">
            <div>
                <div class="truck-name">${truck.truckName || 'Unknown Truck'}</div>
                <div class="truck-meta">${truck.plateNumber || ''}</div>
                ${spData?.max_expense != null
                    ? `<div class="truck-meta" style="margin-top:4px;font-size:11px;">
                        Max: ${fmt(spData.max_expense)} &nbsp;·&nbsp; Min: ${fmt(spData.min_expense)}
                       </div>`
                    : ''}
            </div>
            <div class="expense-card-right">
                <div class="expense-total ${hasExpenses ? '' : 'no-data'}">
                    ${hasExpenses ? fmt(total) : 'No expenses'}
                </div>
                <div class="expense-count">${count} transaction${count !== 1 ? 's' : ''}</div>
                <button class="view-details-btn">View Details</button>
            </div>
        </div>`;
    card.querySelector('.view-details-btn').addEventListener('click', () => openExpenseModal(truck));
    return card;
}

function openExpenseModal(truck) {
    const truckExpenses = getFilteredExpenses(truck.truck_ID);
    const total = truckExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const odoEntry = State.odometers
        .filter(o => (o.truck_id ?? o.truckId) === truck.truck_ID)
        .sort((a,b) => new Date(b.recorded_at ?? b.recordedAt) - new Date(a.recorded_at ?? a.recordedAt))[0];
    const currentKm  = odoEntry ? (odoEntry.current_km ?? odoEntry.currentKm ?? null) : null;
    const recordedAt = odoEntry ? (odoEntry.recorded_at ?? odoEntry.recordedAt) : null;

    document.getElementById('modalTruckName').textContent   = `${truck.truckName} ${truck.plateNumber}`;
    document.getElementById('modalKm').textContent          = currentKm != null ? `${currentKm.toLocaleString()} KM` : 'No odometer data';
    document.getElementById('modalKmDate').textContent      = recordedAt
        ? `As of ${new Date(recordedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}` : '';
    document.getElementById('modalTxCount').textContent     = `${truckExpenses.length} Transaction${truckExpenses.length !== 1 ? 's' : ''}`;
    document.getElementById('modalPeriodLabel').textContent = `Expense Records (${truckExpenses.length})`;
    document.getElementById('modalMonthLabel').textContent  = State.period === 'monthly'
        ? MONTH_NAMES[State.month - 1] : 'All Time';

    const tbody = document.getElementById('modalTableBody');
    if (!truckExpenses.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--color-text-secondary)">No expense records found</td></tr>`;
    } else {
        tbody.innerHTML = sortExpenses(truckExpenses).map(e => {
            const dateStr = new Date(e.expense_date ?? e.expenseDate)
                .toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});
            const hasPhotos = e.process_photo && e.receipt_photo &&
                              e.process_photo.trim() !== '' && e.receipt_photo.trim() !== '';
            const proofBtn = hasPhotos
                ? `<button class="proof-btn" onclick="viewProof(${e.expense_id})">View Photos</button>`
                : `<span class="no-proof">—</span>`;
            return `
                <tr class="expense-row">
                    <td>${dateStr}</td>
                    <td>${e.expense_type ?? e.expenseType ?? '—'}</td>
                    <td class="notes-cell">${e.notes ?? '—'}</td>
                    <td class="amount-cell">${fmt(e.amount)}</td>
                    <td>${proofBtn}</td>
                </tr>`;
        }).join('');
    }

    document.getElementById('modalTotal').textContent = fmt(total);
    document.getElementById('expenseModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeExpenseModal() {
    document.getElementById('expenseModal')?.classList.remove('active');
    document.body.style.overflow = '';
}

window.viewProof = function(expenseId) {
    const expense = State.expenses.find(e => e.expense_id === parseInt(expenseId));
    if (!expense) return;
    const baseUrl    = String(CONFIG.API_BASE).replace(/\/+$/, '');
    const processUrl = `${baseUrl}/uploads/${expense.process_photo}`;
    const receiptUrl = `${baseUrl}/uploads/${expense.receipt_photo}`;
    const proofModal = document.getElementById('proofModal');
    const proofBox   = proofModal.querySelector('.proof-modal-box');
    proofBox.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <h3 style="margin:0;font-size:16px;font-weight:700;color:#fff;">Proof of Expense</h3>
            <button id="closeProofModal" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 20px 20px;">
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="background:#1A6B3C;color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:0.5px;">PROCESS PHOTO</span>
                </div>
                <div style="padding:10px;">
                    <img src="${processUrl}" alt="Process" style="width:100%;height:220px;border-radius:6px;object-fit:cover;cursor:zoom-in;display:block;"
                        onclick="openFullscreen('${processUrl}')"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;height:220px;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:13px;">Not available</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="background:#1a3a6b;color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;letter-spacing:0.5px;">RECEIPT PHOTO</span>
                </div>
                <div style="padding:10px;">
                    <img src="${receiptUrl}" alt="Receipt" style="width:100%;height:220px;border-radius:6px;object-fit:cover;cursor:zoom-in;display:block;"
                        onclick="openFullscreen('${receiptUrl}')"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;height:220px;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:13px;">Not available</div>
                </div>
            </div>
        </div>`;
    proofBox.querySelector('#closeProofModal').addEventListener('click', () => proofModal.classList.remove('active'));
    proofModal.classList.add('active');
};

window.openFullscreen = function(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;cursor:zoom-out;`;
    overlay.innerHTML = `<img src="${url}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;" />`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
};

searchInput?.addEventListener('input',   () => { State.searchQuery = searchInput.value; render(); updateSummaryCard(); });
typeFilterEl?.addEventListener('change', () => { State.typeFilter  = typeFilterEl.value; render(); });
periodSelect?.addEventListener('change', () => {
    State.period = periodSelect.value;
    monthYearFilters.style.display = State.period === 'monthly' ? 'flex' : 'none';
    updateSummaryCard(); render();
});
monthSelect?.addEventListener('change', () => { State.month = parseInt(monthSelect.value); updateSummaryCard(); render(); });
yearSelect?.addEventListener('change',  () => { State.year  = parseInt(yearSelect.value);  updateSummaryCard(); render(); });

document.getElementById('closeModal')?.addEventListener('click', closeExpenseModal);
document.getElementById('expenseModal')?.addEventListener('click', e => { if (e.target.id === 'expenseModal') closeExpenseModal(); });
document.getElementById('proofModal')?.addEventListener('click',  e => { if (e.target.id === 'proofModal') document.getElementById('proofModal').classList.remove('active'); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeExpenseModal();
        document.getElementById('proofModal')?.classList.remove('active');
        document.querySelectorAll('[style*="z-index: 99999"]').forEach(el => el.remove());
    }
});

document.addEventListener('DOMContentLoaded', () => fetchData());