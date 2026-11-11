// ========================================
// STARQUEEN PMTS - Driver Sidebar
// ========================================

const SidebarComponent = {

    getActivePage() {
        return document.body.dataset.sidebarPage || 'driver-dashboard';
    },

    getHTML(activePage) {
        const navItems = [
            { id: 'driver-dashboard', label: 'Dashboard', href: '/DRIVERS/HTML/driver-dashboard.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <circle cx="8.07" cy="8.07" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="8.07" cy="20.63" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="20.63" cy="8.07" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="20.63" cy="20.63" r="7.18" stroke="currentColor" stroke-width="1.5"/>
                </svg>`
            },
            { id: 'truck-activity', label: 'Truck Activity', href: '/DRIVERS/HTML/truck-activity.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <polyline points="2,16 7,10 12,17 17,11 24,16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            { id: 'truck-maintenance', label: 'Truck Maintenance Logs', href: '/DRIVERS/HTML/maintenance-log.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <circle cx="14.5" cy="14.5" r="11" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M14.5 9v5.5l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`
            },
            { id: 'truck-expense', label: 'Truck Expense', href: '/DRIVERS/HTML/truck-expense.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <rect x="3" y="6" width="23" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M3 12h23M10 6V4M19 6V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`
            },
            { id: 'truck-odometer', label: 'Truck Odometer', href: '/DRIVERS/HTML/truck-odometer.html', icon: `
                <svg width="29" height="29" viewBox="0 0 29 29" fill="none">
                    <path d="M5 18a9 9 0 1119 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M14.5 18l-4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <circle cx="14.5" cy="18" r="1.5" fill="currentColor"/>
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
                        <span id="userInitials">D</span>
                    </div>
                    <div class="profile-info">
                        <h3 id="sidebarUsername">Driver</h3>
                        <p id="userRole">Driver</p>
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
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M13 7l4 3-4 3M17 10H8M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
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
        // ── Auth guard: Driver only ──
        if (!SessionManager.guard('Driver')) return;

        const activePage = this.getActivePage();
        document.body.insertAdjacentHTML('afterbegin', this.getHTML(activePage));

        const username = SessionManager.get('username') || 'Driver';
        const role     = SessionManager.get('role')     || 'Driver';
        const initials = username.charAt(0).toUpperCase();

        document.getElementById('sidebarUsername').textContent = username;
        document.getElementById('userRole').textContent        = role;
        document.getElementById('userInitials').textContent    = initials;

        document.getElementById('profileSection')?.addEventListener('click', () => {
            window.location.href = '/DRIVERS/HTML/driver-profile.html';
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