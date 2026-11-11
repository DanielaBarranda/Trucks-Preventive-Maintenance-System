// ========================================
// STARQUEEN PMTS - Shared Sidebar (Admin)
// ========================================

const SidebarComponent = {

    getActivePage() {
        return document.body.dataset.sidebarPage || 'dashboard';
    },

    getHTML(activePage) {
        const navItems = [
            { id: 'dashboard', label: 'Dashboard', href: '/ADMIN/HTML/admin-dashboard.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <circle cx="8.07" cy="8.07" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="8.07" cy="20.63" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="20.63" cy="8.07" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="20.63" cy="20.63" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                </svg>`
            },
            { id: 'active-trucks', label: 'Activity Logs', href: '/ADMIN/HTML/activity-logs.html', icon: `
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 16L16 12L20 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`
            },
            { id: 'pending-maintenance', label: 'Pending Maintenance', href: '/ADMIN/HTML/pending-maintenance.html', icon: `
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 10v6l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`
            },
            { id: 'expenses', label: 'Expenses', href: '/ADMIN/HTML/expenses.html', icon: `
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="6" y="8" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M6 14h20M12 8V6M20 8V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`
            },
            { id: 'alerts', label: 'Alerts and Notifications', href: '/ADMIN/HTML/alert.html', icon: `
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 8v8M16 22v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="2"/>
                </svg>`
            },
        ];

        const navHTML = navItems.map(item => `
            <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}" data-nav="${item.id}">
                ${item.icon}
                <span>${item.label}</span>
            </a>
        `).join('');

        return `
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
            <aside class="sidebar" id="sidebar">
                <div class="profile-section" id="profileSection" style="cursor:pointer;" title="View Profile">
                    <div class="profile-avatar">
                        <span id="userInitials">U</span>
                    </div>
                    <div class="profile-info">
                        <h3 id="sidebarUsername">User</h3>
                        <p id="userRole">Fleet Management</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-left:auto;opacity:0.5;">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="sidebar-divider"></div>
                <nav class="sidebar-nav">
                    ${navHTML}
                </nav>
                <div class="sidebar-logout">
                    <div class="sidebar-divider"></div>
                    <button class="logout-btn" id="logoutBtn">
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <!-- Logout Confirmation Modal -->
            <div class="modal-overlay" id="logoutModal">
                <div class="modal-box">
                    <div class="modal-icon">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <path d="M20 10L26 16L20 22" stroke="#1f3c88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M26 16H12" stroke="#1f3c88" stroke-width="2" stroke-linecap="round"/>
                            <path d="M12 6H7a1 1 0 00-1 1v18a1 1 0 001 1h5" stroke="#1f3c88" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <h2 class="modal-title">Log Out</h2>
                    <p class="modal-message">Are you sure you want to log out of your account?</p>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" id="cancelLogout">Cancel</button>
                        <button class="modal-btn confirm" id="confirmLogout">Log Out</button>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        // ── Auth guard: Admin only ──
        if (!SessionManager.guard('Admin')) return;

        const activePage = this.getActivePage();
        document.body.insertAdjacentHTML('afterbegin', this.getHTML(activePage));

        // Fill in user info from session
        const username = SessionManager.get('username') || 'User';
        const role     = SessionManager.get('role')     || 'Fleet Management';
        const initials = username.charAt(0).toUpperCase();

        document.getElementById('sidebarUsername').textContent = username;
        document.getElementById('userRole').textContent        = role;
        document.getElementById('userInitials').textContent    = initials;

        // Profile click → go to profile page
        document.getElementById('profileSection')?.addEventListener('click', () => {
            window.location.href = '/ADMIN/HTML/profile.html';
        });

        const hamburgerBtn  = document.getElementById('hamburgerBtn');
        const sidebar       = document.getElementById('sidebar');
        const overlay       = document.getElementById('sidebarOverlay');
        const logoutBtn     = document.getElementById('logoutBtn');
        const logoutModal   = document.getElementById('logoutModal');
        const cancelLogout  = document.getElementById('cancelLogout');
        const confirmLogout = document.getElementById('confirmLogout');

        let isOpen = false;

        function openSidebar() {
            sidebar?.classList.add('active');
            overlay?.classList.add('active');
            hamburgerBtn?.classList.add('active');
            document.body.style.overflow = 'hidden';
            isOpen = true;
        }

        function closeSidebar() {
            sidebar?.classList.remove('active');
            overlay?.classList.remove('active');
            hamburgerBtn?.classList.remove('active');
            document.body.style.overflow = '';
            isOpen = false;
        }

        function openLogoutModal() {
            logoutModal?.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLogoutModal() {
            logoutModal?.classList.remove('active');
            document.body.style.overflow = '';
        }

        hamburgerBtn?.addEventListener('click', () => isOpen ? closeSidebar() : openSidebar());
        overlay?.addEventListener('click', () => closeSidebar());

        logoutBtn?.addEventListener('click', () => openLogoutModal());
        cancelLogout?.addEventListener('click', () => closeLogoutModal());

        // ── Logout: clear session + block back button ──
        confirmLogout?.addEventListener('click', () => {
            SessionManager.logout('/ADMIN/HTML/login.html');
        });

        logoutModal?.addEventListener('click', (e) => {
            if (e.target === logoutModal) closeLogoutModal();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && isOpen) closeSidebar();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (logoutModal?.classList.contains('active')) closeLogoutModal();
                else if (isOpen) closeSidebar();
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => SidebarComponent.init());