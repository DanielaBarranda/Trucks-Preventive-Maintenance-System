// ============================================================
//  TRUCK ODOMETER — truck-odometer.js
//  Supports KM-based and Month-based (per component) tracking
//  Month mode: locks components until interval is reached
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

    SessionManager.guard('Driver');

    // ── Load truck from API using session user_id ───────────
    let truckId     = null;
    let plateNumber = null;
    let truckType   = null;

    try {
        const userId = SessionManager.get('user_id');
        const base   = String(CONFIG.API_BASE).replace(/\/+$/, '');
        const trucks = await fetch(`${base}/api/Trucks`).then(r => r.json()).catch(() => []);
        const truck  = (trucks || []).find(t =>
            String(t.userID ?? t.userId ?? t.user_id) === String(userId)
        );
        if (truck) {
            truckId     = parseInt(truck.truck_ID ?? truck.truckId ?? truck.truck_id) || null;
            plateNumber = truck.plateNumber ?? truck.plate_number ?? null;
            truckType   = truck.truckType   ?? truck.truck_type   ?? null;
            const plateEl = document.getElementById('plateNumber');
            if (plateEl && plateNumber) {
                const name  = truck.truckName ?? truck.truck_name ?? '';
                plateEl.textContent = name ? `${name} ${plateNumber}` : plateNumber;
            }
        }
    } catch (e) { console.error('Failed to load truck:', e); }

    // ── Mode toggle ──────────────────────────────────────────
    let mode = 'km';
    const kmCard      = document.getElementById('kmCard');
    const monthCard   = document.getElementById('monthCard');
    const toggleKm    = document.getElementById('toggleKm');
    const toggleMonth = document.getElementById('toggleMonth');

    toggleKm?.addEventListener('click', () => {
        mode = 'km';
        toggleKm.classList.add('active');
        toggleMonth.classList.remove('active');
        kmCard.style.display    = '';
        monthCard.style.display = 'none';
    });

    toggleMonth?.addEventListener('click', async () => {
        mode = 'month';
        toggleMonth.classList.add('active');
        toggleKm.classList.remove('active');
        monthCard.style.display = '';
        kmCard.style.display    = 'none';
        await loadComponents();
    });

    // ── KM Mode ──────────────────────────────────────────────
    const displayEl = document.getElementById('odometerDisplay');
    const valueEl   = document.getElementById('displayValue');
    const digitBtns = document.querySelectorAll('.odo-key.digit');
    const clearBtn  = document.getElementById('clearBtn');
    const backBtn   = document.getElementById('backBtn');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    let current = '';

    function updateDisplay() {
        if (current === '') {
            valueEl.textContent = '—';
            valueEl.classList.add('placeholder');
            displayEl.classList.remove('has-value');
        } else {
            valueEl.textContent = Number(current).toLocaleString();
            valueEl.classList.remove('placeholder');
            displayEl.classList.add('has-value');
        }
    }

    function appendDigit(d) {
        if (current.length >= 10) return;
        if (current === '' && d === '0') return;
        current += d;
        updateDisplay();
    }

    digitBtns.forEach(btn => btn.addEventListener('click', () => appendDigit(btn.dataset.val)));
    clearBtn?.addEventListener('click', () => { current = ''; updateDisplay(); });
    backBtn?.addEventListener('click',  () => { current = current.slice(0, -1); updateDisplay(); });

    document.addEventListener('keydown', e => {
        if (mode !== 'km') return;
        if (e.key >= '0' && e.key <= '9') appendDigit(e.key);
        else if (e.key === 'Backspace') { current = current.slice(0, -1); updateDisplay(); }
        else if (e.key === 'Escape')    { current = ''; updateDisplay(); }
        else if (e.key === 'Enter')     submitBtn?.click();
    });

    // ── Month Mode: Load Components with Lock Status ──────────
    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const currentYear = new Date().getFullYear();
    const now         = new Date();

    let components    = [];
    let lastSubmitted = {};
    let loaded        = false;

    async function loadComponents() {
        if (loaded) return;
        const componentList = document.getElementById('componentList');
        if (!componentList) return;

        componentList.innerHTML = `
            <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                Loading components...
            </div>`;

        try {
            const base = String(CONFIG.API_BASE).replace(/\/+$/, '');

            let type = truckType;
            if (!type) {
                try {
                    const uid    = SessionManager.get('user_id');
                    const b      = String(CONFIG.API_BASE).replace(/\/+$/, '');
                    const trucks = await fetch(`${b}/api/Trucks`).then(r => r.json()).catch(() => []);
                    const t      = (trucks || []).find(x =>
                        String(x.userID ?? x.userId ?? x.user_id) === String(uid)
                    );
                    if (t) {
                        const combined = ((t.truckType || '') + ' ' + (t.truckName || '')).toUpperCase();
                        if      (combined.includes('ELF'))  type = 'ELF Truck';
                        else if (combined.includes('FWD'))  type = 'FWD Truck';
                        else if (combined.includes('10W'))  type = '10W Truck';
                        else if (combined.includes('TW'))   type = 'TW Truck';
                        else if (combined.includes('WING')) type = 'Wing Van';
                    }
                } catch (e) { /* ignore */ }
            }

            const [refs, submissions] = await Promise.all([
                fetch(`${base}/api/MaintenanceReference`).then(r => r.json()).catch(() => []),
                truckId
                    ? fetch(`${base}/api/TruckMaintenanceLogs/last-submission/${truckId}`)
                        .then(r => r.json()).catch(() => [])
                    : Promise.resolve([]),
            ]);

            components = (refs || [])
                .filter(r => (r.truck_type ?? r.truckType) === type)
                .map(r => ({
                    reference_id:     r.reference_id     ?? r.referenceId,
                    maintenance_task: r.maintenance_task ?? r.maintenanceTask,
                    month_interval:   r.month_interval   ?? null,
                }));

            lastSubmitted = {};
            (submissions || []).forEach(s => {
                lastSubmitted[s.reference_id] = {
                    last_submitted_at: s.last_submitted_at,
                    month_interval:    s.month_interval,
                };
            });

            if (!components.length) {
                componentList.innerHTML = `
                    <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                        No components found for your truck type.
                    </div>`;
                return;
            }

            loaded = true;
            renderComponentInputs(componentList);

        } catch (err) {
            componentList.innerHTML = `
                <div style="text-align:center;padding:24px;color:#dc2626;font-size:13px;">
                    Failed to load components. Please refresh.
                </div>`;
        }
    }

    // ── Check if component is locked ─────────────────────────
    function getLockStatus(refId, monthInterval) {
        const sub = lastSubmitted[refId];
        if (!sub || !sub.last_submitted_at) return { locked: false };

        const lastDate      = new Date(sub.last_submitted_at);
        const interval      = monthInterval ?? sub.month_interval ?? 6;
        const monthsElapsed = ((now.getFullYear() - lastDate.getFullYear()) * 12)
                            + now.getMonth() - lastDate.getMonth();
        const monthsLeft    = interval - monthsElapsed;

        if (monthsLeft > 0) {
            const nextDue = new Date(lastDate);
            nextDue.setMonth(nextDue.getMonth() + interval);
            return { locked: true, monthsLeft, lastDate, nextDue, interval };
        }

        return { locked: false, lastDate, interval, overdue: Math.abs(monthsLeft) };
    }

    function renderComponentInputs(container) {
        container.innerHTML = components.map(c => {
            const lock = getLockStatus(c.reference_id, c.month_interval);

            if (lock.locked) {
                const lastStr = `${MONTH_NAMES[lock.lastDate.getMonth()]} ${lock.lastDate.getFullYear()}`;
                const nextStr = `${MONTH_NAMES[lock.nextDue.getMonth()]} ${lock.nextDue.getFullYear()}`;
                return `
                    <div class="odo-component-row odo-component-row--locked"
                         data-ref-id="${c.reference_id}">
                        <div class="odo-component-info">
                            <div class="odo-component-name">${c.maintenance_task}</div>
                            <div class="odo-component-meta">
                                Last: ${lastStr} · Next due: ${nextStr}
                            </div>
                        </div>
                        <div class="odo-component-lock">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <rect x="3" y="11" width="18" height="11" rx="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            ${lock.monthsLeft} month${lock.monthsLeft !== 1 ? 's' : ''} left
                        </div>
                    </div>`;
            } else {
                const hint = lock.lastDate
                    ? `Last: ${MONTH_NAMES[lock.lastDate.getMonth()]} ${lock.lastDate.getFullYear()}${lock.overdue > 0 ? ` · ${lock.overdue} month${lock.overdue !== 1 ? 's' : ''} overdue` : ''}`
                    : 'No previous record';

                return `
                    <div class="odo-component-row odo-component-row--open"
                         data-ref-id="${c.reference_id}">
                        <div class="odo-component-info">
                            <div class="odo-component-name">${c.maintenance_task}</div>
                            <div class="odo-component-meta">${hint}</div>
                        </div>
                        <div class="odo-component-inputs">
                            <select class="odo-select odo-select-sm"
                                    id="month_${c.reference_id}">
                                <option value="">Month</option>
                                ${MONTH_NAMES.map((m, i) =>
                                    `<option value="${i+1}">${m}</option>`
                                ).join('')}
                            </select>
                            <select class="odo-select odo-select-sm"
                                    id="year_${c.reference_id}">
                                <option value="">Year</option>
                                ${Array.from({length: 6}, (_, i) => currentYear - i).map(y =>
                                    `<option value="${y}">${y}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>`;
            }
        }).join('');

        const locked   = components.filter(c => getLockStatus(c.reference_id, c.month_interval).locked).length;
        const unlocked = components.length - locked;
        const summary  = document.getElementById('componentSummary');
        if (summary) {
            summary.textContent = `${unlocked} component${unlocked !== 1 ? 's' : ''} available to update · ${locked} locked`;
            summary.style.display = 'block';
        }
    }

    // ── Toast ────────────────────────────────────────────────
    function showToast(message, type = 'success') {
        let toast = document.getElementById('odoToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'odoToast';
            toast.style.cssText = `
                position:fixed;bottom:24px;right:24px;z-index:9999;
                padding:13px 20px;border-radius:10px;font-size:14px;
                font-weight:600;color:#fff;max-width:320px;
                opacity:0;transform:translateY(8px);
                transition:all 0.3s ease;pointer-events:none;`;
            document.body.appendChild(toast);
        }
        toast.textContent      = message;
        toast.style.background = type === 'success' ? '#2e7d32' : '#c62828';
        toast.style.opacity    = '1';
        toast.style.transform  = 'translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity   = '0';
            toast.style.transform = 'translateY(8px)';
        }, 3000);
    }

    // ── Submit KM ────────────────────────────────────────────
    // FIXED: button stays enabled and resets properly on validation failure
    submitBtn?.addEventListener('click', async () => {
        // FIXED: always re-enable button first before validation check
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Submit Reading';

        if (!current) {
            displayEl.style.borderColor = '#CC2222';
            displayEl.style.boxShadow   = '0 0 0 3px rgba(204,34,34,0.12)';
            setTimeout(() => {
                displayEl.style.borderColor = '';
                displayEl.style.boxShadow   = '';
            }, 1800);
            return; // exit early — button already re-enabled above
        }

        if (!truckId) {
            showToast('No truck assigned.', 'error');
            return;
        }

        // Only disable button when actually submitting
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Submitting…';

        try {
            const res = await fetch(`${CONFIG.API_BASE}/api/TruckOdometer`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    odometer_id: 0,
                    truck_id:    truckId,
                    current_km:  parseInt(current),
                    recorded_at: new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error(`Server error (${res.status})`);
            try { localStorage.setItem('lastOdometerReading', current); } catch (e) {}
            showToast('Odometer reading saved successfully!', 'success');
            setTimeout(() => { window.location.href = '/DRIVERS/HTML/maintenance-log.html'; }, 1500);
        } catch (err) {
            showToast(err.message || 'Submission failed.', 'error');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Submit Reading';
        }
    });

    // ── Submit Month (per component, skips locked) ────────────
    // FIXED: validate FIRST before disabling button
    // so button never gets stuck in disabled state on error
    const submitBtnMonth = document.getElementById('submitBtnMonth');
    const cancelBtnMonth = document.getElementById('cancelBtnMonth');

    submitBtnMonth?.addEventListener('click', async () => {
        if (!truckId) { showToast('No truck assigned.', 'error'); return; }
        if (!components.length) { showToast('Components not loaded yet.', 'error'); return; }

        const componentDates = [];
        let hasError = false;

        const unlocked = components.filter(c =>
            !getLockStatus(c.reference_id, c.month_interval).locked
        );

        if (!unlocked.length) {
            showToast('All components are locked — nothing to update.', 'error');
            return;
        }

        // FIXED: run full validation BEFORE disabling the button
        unlocked.forEach(c => {
            const monthEl = document.getElementById(`month_${c.reference_id}`);
            const yearEl  = document.getElementById(`year_${c.reference_id}`);
            const month   = parseInt(monthEl?.value);
            const year    = parseInt(yearEl?.value);

            if (!month || !year) {
                hasError = true;
                if (monthEl) monthEl.style.borderColor = '#CC2222';
                if (yearEl)  yearEl.style.borderColor  = '#CC2222';
            } else {
                if (monthEl) monthEl.style.borderColor = '';
                if (yearEl)  yearEl.style.borderColor  = '';

                const lastDate = new Date(year, month - 1, 1);
                if (lastDate > now) {
                    showToast('Last maintenance date cannot be in the future.', 'error');
                    hasError = true;
                    return;
                }

                componentDates.push({
                    reference_id:         c.reference_id,
                    last_maintenance_date: lastDate.toISOString(),
                });
            }
        });

        // FIXED: if validation fails, show error and return WITHOUT disabling button
        if (hasError) {
            showToast('Please fill in all available component dates.', 'error');
            // Button remains enabled — user can fix and resubmit without refreshing
            return;
        }

        // Only disable button AFTER successful validation
        submitBtnMonth.disabled    = true;
        submitBtnMonth.textContent = 'Submitting…';

        try {
            const res = await fetch(`${CONFIG.API_BASE}/api/TruckOdometer/month`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ truck_id: truckId, components: componentDates }),
            });
            if (!res.ok) throw new Error(`Server error (${res.status})`);
            showToast('Month-based check submitted!', 'success');
            loaded = false;
            setTimeout(() => { window.location.href = '/DRIVERS/HTML/maintenance-log.html'; }, 1500);
        } catch (err) {
            showToast(err.message || 'Submission failed.', 'error');
            submitBtnMonth.disabled    = false;
            submitBtnMonth.textContent = 'Submit Check';
        }
    });

    cancelBtn?.addEventListener('click',      () => window.history.back());
    cancelBtnMonth?.addEventListener('click', () => window.history.back());

    updateDisplay();
});