// ============================================================
//  TRUCK EXPENSE — truck-expense.js
//  BEHAVIOR:
//    1. Driver submits expense
//    2. Backend saves expense + calls InsertExpenseNotification()
//       which resolves the matching maintenance notification
//    3. Maintenance Log status goes back to Good
//    4. Admin is notified
// ============================================================

SessionManager.guard('Driver');

const state = {
    processFile:  null,
    receiptFile:  null,
    submitted:    false,
    truckId:      null,
    plateNumber:  null,
};

function $(id) { return document.getElementById(id); }
function triggerFileInput(inputId) { $(inputId).click(); }

function showLoading() {
    const el = $('loadingOverlay');
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
}

function hideLoading() {
    const el = $('loadingOverlay');
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
}

function showToast(message, type = 'success') {
    let toast = $('expenseToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'expenseToast';
        toast.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:9999;
            padding:13px 20px; border-radius:10px; font-size:14px;
            font-weight:600; color:#fff; max-width:320px;
            opacity:0; transform:translateY(8px);
            transition:all 0.3s ease; pointer-events:none;`;
        document.body.appendChild(toast);
    }
    toast.textContent      = message;
    toast.style.background = type === 'success' ? '#2e7d32' : '#c62828';
    toast.style.opacity    = '1';
    toast.style.transform  = 'translateY(0)';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateY(8px)';
    }, 3500);
}

// ── Load truck info from API (always fresh, never localStorage) ──
async function loadTruckInfo() {
    try {
        const userId = SessionManager.get('user_id');
        const base   = String(CONFIG.API_BASE).replace(/\/+$/, '');
        const trucks = await fetch(`${base}/api/Trucks`).then(r => r.json()).catch(() => []);
        const truck  = (trucks || []).find(t =>
            String(t.userID ?? t.userId ?? t.user_id) === String(userId)
        );
        if (truck) {
            state.truckId     = parseInt(truck.truck_ID ?? truck.truckId ?? truck.truck_id) || null;
            state.plateNumber = truck.plateNumber ?? truck.plate_number ?? null;
            const name        = truck.truckName   ?? truck.truck_name   ?? '';
            const plateEl     = $('headerPlate');
            if (plateEl) {
                plateEl.textContent = name
                    ? `${name} ${state.plateNumber}`
                    : (state.plateNumber ?? '—');
            }
        }
    } catch (e) { console.error('Failed to load truck:', e); }
}

// ── Safe date parser ──────────────────────────────────────────
function safeFormatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeGetYearMonth(raw) {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── SP: Expense History ───────────────────────────────────────
// FIXED: Now fetches from /api/TruckExpenses (raw list) instead of
// /api/TruckExpenses/analysis (which returns summary data, not individual rows)
async function loadExpenseAnalysis() {
    const container = $('expenseAnalysisSection');
    if (!container || !state.truckId) return;

    try {
        const base = String(CONFIG.API_BASE).replace(/\/+$/, '');

        // FIXED: fetch raw expense list, not the analysis SP summary
        const data = await fetch(`${base}/api/TruckExpenses`)
            .then(r => r.json()).catch(() => []);

        // Filter for this truck only
        const myExpenses = (data || []).filter(e =>
            String(e.truck_id ?? e.truckId) === String(state.truckId)
        );

        if (!myExpenses.length) {
            container.innerHTML = `
                <div class="expense-history-section">
                    <div class="expense-history-header">
                        <h3 class="expense-history-title">My Expense History</h3>
                        <span class="expense-history-total">Total: ₱0.00</span>
                    </div>
                    <div class="expense-history-empty">No expense records yet</div>
                </div>`;
            return;
        }

        // FIXED: safe year-month extraction, filter out nulls
        const months = [...new Set(
            myExpenses
                .map(e => safeGetYearMonth(e.expense_date ?? e.expenseDate))
                .filter(Boolean)
        )].sort((a, b) => b.localeCompare(a));

        const MONTH_NAMES = ['January','February','March','April','May','June',
                             'July','August','September','October','November','December'];

        const totalAmount = myExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        container.innerHTML = `
            <div class="expense-history-section">
                <div class="expense-history-header">
                    <div class="expense-history-title-row">
                        <h3 class="expense-history-title">My Expense History</h3>
                        <span class="expense-history-total">
                            Total: ₱${totalAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}
                        </span>
                    </div>
                    <select class="expense-month-filter" id="expenseMonthFilter">
                        <option value="all">All Months</option>
                        ${months.map(ym => {
                            const [y, m] = ym.split('-');
                            return `<option value="${ym}">${MONTH_NAMES[parseInt(m)-1]} ${y}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div id="expenseHistoryRows"></div>
            </div>`;

        function renderRows(filter) {
            const rows = filter === 'all' ? myExpenses : myExpenses.filter(e => {
                const ym = safeGetYearMonth(e.expense_date ?? e.expenseDate);
                return ym === filter;
            });

            const rowContainer = $('expenseHistoryRows');
            if (!rowContainer) return;

            if (!rows.length) {
                rowContainer.innerHTML = `<div class="expense-history-empty">No records for selected month</div>`;
                return;
            }

            rowContainer.innerHTML = `
                <div class="expense-history-table">
                    <div class="expense-history-thead">
                        <div>Date</div>
                        <div>Category</div>
                        <div style="text-align:right">Amount</div>
                    </div>
                    ${rows.map(e => {
                        // FIXED: safe date formatting
                        const date = safeFormatDate(e.expense_date ?? e.expenseDate);
                        return `
                            <div class="expense-history-row">
                                <div class="expense-history-date">${date}</div>
                                <div class="expense-history-category">${escapeHtml(e.expense_type ?? e.expenseType ?? '—')}</div>
                                <div class="expense-history-amount">
                                    ₱${Number(e.amount || 0).toLocaleString('en-PH', {minimumFractionDigits:2})}
                                </div>
                            </div>`;
                    }).join('')}
                    <div class="expense-history-footer">
                        <div></div>
                        <div style="font-weight:700;">Subtotal</div>
                        <div class="expense-history-amount" style="font-weight:800;">
                            ₱${rows.reduce((s,e) => s + Number(e.amount||0), 0)
                                .toLocaleString('en-PH', {minimumFractionDigits:2})}
                        </div>
                    </div>
                </div>`;
        }

        renderRows('all');
        $('expenseMonthFilter')?.addEventListener('change', e => renderRows(e.target.value));

    } catch (err) {
        console.error('Expense history failed:', err);
    }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadTruckInfo();
    await loadExpenseAnalysis();

    // Pre-fill expense category if coming from maintenance log
    try {
        const prefill = localStorage.getItem('prefillExpenseCategory');
        if (prefill) {
            const categoryEl = $('expenseCategory');
            if (categoryEl) {
                categoryEl.value = prefill;
                categoryEl.classList.remove('error-field');
            }
            localStorage.removeItem('prefillExpenseCategory');
        }
    } catch (e) { /* ignore */ }
});

// ── Modal ─────────────────────────────────────────────────────
function openModal() {
    $('uploadModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    $('uploadModal').classList.remove('active');
    document.body.style.overflow = '';
}

$('uploadModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

$('openUploadModal').addEventListener('click', openModal);
$('openUploadModal2')?.addEventListener('click', openModal);

// ── File Selection ────────────────────────────────────────────
function handleFileSelect(type, input) {
    const file = input.files[0];
    if (!file) return;

    const isProcess      = type === 'process';
    const dropzoneId     = isProcess ? 'processDropzone'      : 'receiptDropzone';
    const innerWrapperId = isProcess ? 'processDropzoneInner' : 'receiptDropzoneInner';

    if (isProcess) state.processFile = file;
    else           state.receiptFile = file;

    const dropzone = $(dropzoneId);
    const inner    = $(innerWrapperId);

    dropzone.classList.add('has-file');
    inner.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#1A6B3C">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        <p class="dropzone-text" style="color:#1A6B3C">${escapeHtml(file.name)}</p>
        <p class="dropzone-hint">${formatBytes(file.size)}</p>`;
    updateModalSubmitBtn();
}

function updateModalSubmitBtn() {
    $('modalSubmitBtn').disabled = !(state.processFile && state.receiptFile);
}

function submitPhotos() {
    if (!state.processFile || !state.receiptFile) return;
    $('photoTrigger').style.display  = 'none';
    $('photoChips').style.display    = 'flex';
    $('chipProcessName').textContent = 'Process Photo: ' + state.processFile.name;
    $('chipReceiptName').textContent = 'Receipt Photo: ' + state.receiptFile.name;
    $('photoSection').classList.add('has-files');
    closeModal();
}

$('modalSubmitBtn').disabled = true;

// ── Validation ────────────────────────────────────────────────
function validateForm() {
    let valid = true;
    ['expenseDate', 'expenseCategory', 'expenseCost'].forEach(id => {
        const el = $(id);
        if (!el?.value?.trim()) {
            el?.classList.add('error-field');
            valid = false;
        } else {
            el?.classList.remove('error-field');
        }
    });
    if (!state.processFile || !state.receiptFile) {
        $('photoSection').style.borderColor = '#CC2222';
        valid = false;
    } else {
        $('photoSection').style.borderColor = '';
    }
    return valid;
}

['expenseDate', 'expenseCategory', 'expenseCost'].forEach(id => {
    $(id)?.addEventListener('input', () => $(id)?.classList.remove('error-field'));
});

// ── Submit Expense ────────────────────────────────────────────
async function handleSubmit() {
    if (state.submitted) return;
    if (!validateForm()) return;

    if (!state.truckId) {
        showToast('No truck assigned. Please log in again.', 'error');
        return;
    }

    const btn       = $('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Submitting…';
    showLoading();

    try {
        const formData = new FormData();
        formData.append('truck_id',      state.truckId);
        formData.append('expense_date',  $('expenseDate').value);
        formData.append('expense_type',  $('expenseCategory').value.trim());
        formData.append('amount',        $('expenseCost').value);
        formData.append('notes',         $('expenseNotes')?.value?.trim() || '');
        formData.append('process_photo', state.processFile);
        formData.append('receipt_photo', state.receiptFile);

        const baseUrl  = String(CONFIG.API_BASE).replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/api/TruckExpenses`, {
            method: 'POST',
            body:   formData,
        });

        if (!response.ok) {
            let errMsg = `Server error (${response.status})`;
            try {
                const errData = await response.json();
                errMsg = errData.message ?? errData.title ?? errMsg;
            } catch (_) {}
            throw new Error(errMsg);
        }

        state.submitted = true;
        showToast('Expense submitted! Maintenance status updated to Good.', 'success');

        // Reload expense history to reflect new record
        await loadExpenseAnalysis();

        // Show success overlay
        const overlay = $('successOverlay');
        if (overlay) overlay.classList.add('active');

    } catch (err) {
        console.error('Expense submission failed:', err);
        showToast(err.message || 'Submission failed. Please try again.', 'error');
        btn.disabled    = false;
        btn.textContent = 'Submit Expense';
    } finally {
        hideLoading();
    }
}

// ── Reset Form ────────────────────────────────────────────────
function resetForm() {
    const overlay = $('successOverlay');
    if (overlay) overlay.classList.remove('active');

    state.processFile = null;
    state.receiptFile = null;
    state.submitted   = false;

    ['expenseDate', 'expenseCategory', 'expenseCost', 'expenseNotes'].forEach(id => {
        const el = $(id);
        if (el) { el.value = ''; el.classList.remove('error-field'); }
    });

    $('photoTrigger').style.display = 'flex';
    $('photoChips').style.display   = 'none';
    $('photoSection').removeAttribute('style');
    $('photoSection').classList.remove('has-files');

    resetDropzone('process');
    resetDropzone('receipt');

    const btn = $('submitBtn');
    btn.textContent = 'Submit Expense';
    btn.classList.remove('submitted');
    btn.disabled    = false;
    $('modalSubmitBtn').disabled = true;

    // Reload expense history after reset
    loadExpenseAnalysis();
}

function resetDropzone(type) {
    const isProcess  = type === 'process';
    const dropzoneId = isProcess ? 'processDropzone'      : 'receiptDropzone';
    const innerId    = isProcess ? 'processDropzoneInner' : 'receiptDropzoneInner';
    const inputId    = isProcess ? 'processFileInput'     : 'receiptFileInput';
    const hint       = isProcess ? 'PNG, JPG — up to 5MB' : 'PNG, JPG — up to 10MB';

    $(dropzoneId)?.classList.remove('has-file');
    const inputEl = $(inputId);
    if (inputEl) inputEl.value = '';
    const innerEl = $(innerId);
    if (innerEl) innerEl.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        <p class="dropzone-text">Click to upload</p>
        <p class="dropzone-hint">${hint}</p>`;
}

function formatBytes(bytes) {
    if (bytes < 1024)    return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}