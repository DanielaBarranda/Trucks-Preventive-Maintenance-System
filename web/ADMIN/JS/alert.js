// ========================================
// STARQUEEN PMTS - Alerts / Notifications
// ========================================

SessionManager.guard('Admin');

const POLL_INTERVAL_MS = 30_000;
let pollTimer = null;

const State = {
    notifications: [],
    trucks: [],
    typeFilter: 'all',
    knownIds: new Set(),
    expandedIds: new Set(),
};

const notifList      = document.getElementById('notifList');
const emptyState     = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const unreadBadge    = document.getElementById('unreadBadge');
const markAllReadBtn = document.getElementById('markAllReadBtn');
const typeFilters    = document.getElementById('typeFilters');

function showLoading() { loadingOverlay?.classList.add('active'); }
function hideLoading() { loadingOverlay?.classList.remove('active'); }

function normalize(n) {
    return {
        id:         n.admin_notification_id ?? n.adminNotificationId,
        truckId:    n.truck_id    ?? n.truckId,
        isRead:     n.is_read     ?? n.isRead     ?? false,
        isResolved: n.is_resolved ?? n.isResolved ?? false,
        createdAt:  n.created_at  ?? n.createdAt,
        resolvedAt: n.resolved_at ?? n.resolvedAt,
        message:    n.message || '',
        type:       (n.type || 'information').toLowerCase(),
        task:       n.maintenance_task ?? n.maintenanceTask ?? ''
    };
}

function formatRelative(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date)) return '—';
    const diffSecs = Math.floor((new Date() - date) / 1000);
    if (diffSecs < 60)    return 'Just now';
    if (diffSecs < 3600)  return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
}

function formatFull(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        + ' · ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getTruckDisplayName(truckId) {
    const truck = State.trucks.find(t => (t.truck_ID ?? t.truckId) === truckId);
    if (!truck) return `Truck #${truckId}`;
    return `${truck.truckName} · ${truck.plateNumber}`;
}

function getTruckFullName(truckId) {
    const truck = State.trucks.find(t => (t.truck_ID ?? t.truckId) === truckId);
    if (!truck) return `Truck #${truckId}`;
    return `${truck.truckName} (${truck.truckType}) · ${truck.plateNumber}`;
}

async function fetchData() {
    showLoading();
    try { await loadAll(); }
    finally { hideLoading(); }
}

async function loadAll() {
    try {
        const [notifData, truckData] = await Promise.all([
            fetch(`${CONFIG.API_BASE}/api/AdminNotifications`).then(r => r.json()).catch(() => []),
            fetch(`${CONFIG.API_BASE}/api/Trucks`).then(r => r.json()).catch(() => []),
        ]);

        const incoming = (notifData || []).map(normalize);
        const newIds   = incoming.filter(n => !State.knownIds.has(n.id)).map(n => n.id);
        incoming.forEach(n => State.knownIds.add(n.id));
        State.notifications = incoming;
        State.trucks        = truckData || [];

        updateUnreadBadge();
        updateFilterCounts();
        renderAcknowledgementRate();
        renderUnreadPerTruck();
        render(newIds);

    } catch (err) {
        console.error('Error in loadAll:', err);
    }
}

function updateUnreadBadge() {
    const count = State.notifications.filter(n => !n.isRead).length;
    if (unreadBadge) {
        unreadBadge.textContent   = `${count} Unread`;
        unreadBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

function updateFilterCounts() {
    const all = State.notifications;
    document.getElementById('filterCountAll').textContent     = all.length;
    document.getElementById('filterCountUrgent').textContent  = all.filter(n => n.type === 'urgent').length;
    document.getElementById('filterCountWarning').textContent = all.filter(n => n.type === 'warning').length;
    document.getElementById('filterCountInfo').textContent    = all.filter(n => n.type === 'information').length;
}

// ── Acknowledgement Rate ──────────────────────────────────────────────────
function renderAcknowledgementRate() {
    const container = document.getElementById('spAcknowledgementRate');
    if (!container) return;

    const byTruck = {};
    State.notifications.forEach(n => {
        if (!byTruck[n.truckId]) byTruck[n.truckId] = { truckId: n.truckId, read: 0, unread: 0 };
        n.isRead ? byTruck[n.truckId].read++ : byTruck[n.truckId].unread++;
    });

    const rows = Object.values(byTruck).sort((a, b) => b.unread - a.unread);

    container.innerHTML = `
        <div class="sp-section-card">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <path d="M2 10l5 5 11-9" stroke="currentColor" stroke-width="1.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 class="sp-section-title">Notification Acknowledgement Rate</h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Truck</th>
                            <th>Read</th>
                            <th>Unread</th>
                            <th>Total</th>
                            <th>Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(r => {
                            const truck  = State.trucks.find(t => (t.truck_ID ?? t.truckId) === r.truckId);
                            const name   = truck?.truckName   ?? `Truck #${r.truckId}`;
                            const plate  = truck?.plateNumber ?? '—';
                            const total  = r.read + r.unread;
                            const rate   = total > 0 ? Math.round((r.read / total) * 100) : 0;
                            const color  = rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626';
                            return `<tr>
                                <td>
                                    <strong>${name}</strong>
                                    <div style="font-size:11px;color:#9ca3af;">${plate}</div>
                                </td>
                                <td><span class="count-pill green">${r.read}</span></td>
                                <td><span class="count-pill red">${r.unread}</span></td>
                                <td>${total}</td>
                                <td>
                                    <div class="rate-bar-wrapper">
                                        <div class="rate-bar">
                                            <div class="rate-bar-fill" style="width:${rate}%;background:${color}"></div>
                                        </div>
                                        <span class="rate-label" style="color:${color}">${rate}%</span>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('') : `
                            <tr>
                                <td colspan="5" style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">
                                    No notification data yet
                                </td>
                            </tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── Unread Per Truck ──────────────────────────────────────────────────────
function renderUnreadPerTruck() {
    const container = document.getElementById('spUnreadPerTruck');
    if (!container) return;

    const unreadActive = State.notifications.filter(n => !n.isRead && n.type !== 'information');

    if (!unreadActive.length) {
        container.innerHTML = '';
        return;
    }

    const byTruck = {};
    unreadActive.forEach(n => {
        if (!byTruck[n.truckId]) byTruck[n.truckId] = { truckId: n.truckId, unread: 0 };
        byTruck[n.truckId].unread++;
    });

    const rows = Object.values(byTruck).sort((a, b) => b.unread - a.unread);

    container.innerHTML = `
        <div class="sp-section-card">
            <div class="sp-section-header">
                <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M10 6v5M10 14h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <h3 class="sp-section-title">Unread Maintenance Alerts Per Truck</h3>
            </div>
            <div class="sp-table-wrapper">
                <table class="sp-table">
                    <thead>
                        <tr>
                            <th>Truck</th>
                            <th>Plate</th>
                            <th>Unread Alerts</th>
                            <th>Priority</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => {
                            const truck    = State.trucks.find(t => (t.truck_ID ?? t.truckId) === r.truckId);
                            const name     = truck?.truckName   ?? `Truck #${r.truckId}`;
                            const plate    = truck?.plateNumber ?? '—';
                            const priority = r.unread >= 5
                                ? '<span class="alert-pill critical">Critical</span>'
                                : r.unread >= 3
                                ? '<span class="alert-pill high">High</span>'
                                : '<span class="alert-pill medium">Medium</span>';
                            return `<tr>
                                <td><strong>${name}</strong></td>
                                <td>${plate}</td>
                                <td><span class="count-pill red">${r.unread}</span></td>
                                <td>${priority}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

function getNotifTitle(n) {
    if (n.isResolved) return 'Issue Resolved';
    if (n.type === 'urgent')  return 'Overdue Maintenance';
    if (n.type === 'warning') return 'Upcoming Maintenance';
    const msg = n.message.toLowerCase(), task = n.task.toLowerCase();
    if (msg.includes('odometer') || task === 'odometer update') return 'Odometer Update';
    if (msg.includes('expense'))  return 'Expense Submitted';
    if (msg.includes('resolved')) return 'Maintenance Resolved';
    return 'Information';
}

function getTypeConfig(type) {
    const configs = {
        urgent:      { label: 'URGENT',   badgeCls: 'urgent',   icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#fee2e2"/><path d="M9 5v5M9 12.5h.01" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/></svg>` },
        warning:     { label: 'WARNING',  badgeCls: 'warning',  icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#fef9c3"/><path d="M9 5v5M9 12.5h.01" stroke="#ca8a04" stroke-width="1.8" stroke-linecap="round"/></svg>` },
        resolved:    { label: 'RESOLVED', badgeCls: 'resolved', icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#dcfce7"/><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
        information: { label: 'INFO',     badgeCls: 'info',     icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="#dbeafe"/><path d="M9 8.5v5M9 5.5h.01" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round"/></svg>` }
    };
    return configs[type] || configs.information;
}

// ── render() ──────────────────────────────────────────────────────────────
function render(newIds = []) {
    if (!notifList) return;
    notifList.innerHTML = '';

    let items = State.notifications.map(n => ({
        ...n,
        displayTruck: getTruckDisplayName(n.truckId),
        fullTruck:    getTruckFullName(n.truckId),
        title:        getNotifTitle(n),
        isNew:        newIds.includes(n.id)
    }));

    if (State.typeFilter !== 'all') items = items.filter(n => n.type === State.typeFilter);
    if (items.length === 0) { emptyState.style.display = 'flex'; return; }
    emptyState.style.display = 'none';

    items.sort((a, b) =>
        a.isRead === b.isRead
            ? new Date(b.createdAt) - new Date(a.createdAt)
            : a.isRead ? 1 : -1
    );

    items.forEach(item => {
        const config = getTypeConfig(item.isResolved ? 'resolved' : item.type);
        const card   = document.createElement('div');
        const isExp  = State.expandedIds.has(item.id);

        card.className = [
            'notif-card',
            item.isResolved ? 'resolved' : item.type,
            item.isRead ? 'read' : 'unread',
            isExp ? 'expanded' : '',
            item.isNew ? 'new-flash' : ''
        ].filter(Boolean).join(' ');

        card.dataset.notifId = item.id;

        const dateRel  = item.isResolved && item.resolvedAt
            ? `Resolved ${formatRelative(item.resolvedAt)}`
            : formatRelative(item.createdAt);
        const dateFull = item.isResolved && item.resolvedAt
            ? `Resolved · ${formatFull(item.resolvedAt)}`
            : formatFull(item.createdAt);

        const showTask    = item.task && item.task !== 'Odometer Update';
        const footerRight = item.isRead
            ? `<span class="notif-read-label">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:4px;vertical-align:middle">
                    <path d="M1.5 6.5l3 3 6-6" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>Read
               </span>`
            : `<span class="notif-auto-read-hint">Click to expand · marks as read</span>`;

        card.innerHTML = `
            <div class="notif-card-header">
                <div class="notif-top-row">
                    <div class="notif-type-icon">${config.icon}</div>
                    <div class="notif-title-col">
                        <div class="notif-title-row">
                            ${!item.isRead ? `<span class="notif-unread-dot"></span>` : ''}
                            <span class="notif-title">${item.title}</span>
                            <span class="notif-type-badge ${config.badgeCls}">${config.label}</span>
                        </div>
                        <span class="notif-truck">${item.displayTruck}</span>
                    </div>
                    <div class="notif-meta-col">
                        <span class="notif-time">${dateRel}</span>
                        <svg class="notif-chevron" width="16" height="16" viewBox="0 0 16 16">
                            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5"
                                  stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="notif-card-body">
                <div class="notif-body-grid">
                    <div class="notif-body-left">
                        ${showTask ? `
                        <div class="notif-detail-row">
                            <span class="notif-detail-label">Task</span>
                            <span class="notif-task-preview ${item.isResolved ? 'resolved' : item.type}">${item.task}</span>
                        </div>` : ''}
                        <div class="notif-detail-row">
                            <span class="notif-detail-label">Truck</span>
                            <span class="notif-detail-value">${item.fullTruck}</span>
                        </div>
                        <div class="notif-detail-row">
                            <span class="notif-detail-label">Date</span>
                            <span class="notif-detail-value">${dateFull}</span>
                        </div>
                    </div>
                    <div class="notif-body-right">
                        <p class="notif-message">${item.message}</p>
                    </div>
                </div>
                <div class="notif-card-footer">
                    <span></span>
                    ${footerRight}
                </div>
            </div>`;

        if (isExp) {
            const body = card.querySelector('.notif-card-body');
            if (body) body.style.display = 'block';
        }

        const header = card.querySelector('.notif-card-header');
        if (header) {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCard(item.id, card, item);
            });
        }

        notifList.appendChild(card);
    });
}

// ── toggleCard — one card open at a time, no overlap ─────────────────────
function toggleCard(id, cardEl, item) {
    const body   = cardEl.querySelector('.notif-card-body');
    const isOpen = State.expandedIds.has(id);

    State.expandedIds.forEach(openId => {
        if (openId === id) return;
        const openCard = notifList.querySelector(`[data-notif-id="${openId}"]`);
        if (!openCard) return;
        const openBody = openCard.querySelector('.notif-card-body');
        if (openBody) openBody.style.display = 'none';
        openCard.classList.remove('expanded');
    });
    State.expandedIds.clear();

    if (isOpen) {
        cardEl.classList.remove('expanded');
        if (body) body.style.display = 'none';
    } else {
        State.expandedIds.add(id);
        cardEl.classList.add('expanded');
        if (body) body.style.display = 'block';
        if (!item.isRead) markAsRead(id, cardEl, item);
    }
}

async function markAsRead(id, cardEl, item) {
    item.isRead = true;
    const n = State.notifications.find(x => x.id === id);
    if (n) n.isRead = true;

    cardEl.classList.replace('unread', 'read');
    cardEl.querySelector('.notif-unread-dot')?.remove();
    const hint = cardEl.querySelector('.notif-auto-read-hint');
    if (hint) {
        hint.outerHTML = `<span class="notif-read-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:4px;vertical-align:middle">
                <path d="M1.5 6.5l3 3 6-6" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>Read
        </span>`;
    }

    updateUnreadBadge();
    updateFilterCounts();
    renderAcknowledgementRate();
    renderUnreadPerTruck();

    try {
        await fetch(`${CONFIG.API_BASE}/api/AdminNotifications/${id}/read`, { method: 'PUT' });
    } catch (e) {
        console.warn('Could not sync read status', e);
    }
}

async function markAllAsRead() {
    State.notifications.forEach(n => { n.isRead = true; });
    State.expandedIds.clear();
    updateUnreadBadge();
    updateFilterCounts();
    renderAcknowledgementRate();
    renderUnreadPerTruck();
    render();
    try {
        await fetch(`${CONFIG.API_BASE}/api/AdminNotifications/read-all`, { method: 'PUT' });
    } catch (e) {
        console.warn('Could not sync mark-all', e);
    }
}

function startPolling() { stopPolling(); pollTimer = setInterval(loadAll, POLL_INTERVAL_MS); }
function stopPolling()  { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

document.addEventListener('visibilitychange', () =>
    document.hidden ? stopPolling() : startPolling()
);

typeFilters?.addEventListener('click', e => {
    const btn = e.target.closest('.notif-filter-btn');
    if (!btn) return;
    typeFilters.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.typeFilter = btn.dataset.type;
    render();
});

markAllReadBtn?.addEventListener('click', markAllAsRead);

document.addEventListener('DOMContentLoaded', async () => {
    await fetchData();
    startPolling();
});