// ========================================
// STARQUEEN PMTS - Config & Session Manager
// ========================================

const CONFIG = {
    API_BASE: 'https://localhost:7273'
};

const SessionManager = {

    SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

    // ── Save session after successful login ──
    save(data) {
        localStorage.setItem('user_id',    data.user_id);
        localStorage.setItem('username',   data.username);
        localStorage.setItem('email',      data.email);
        localStorage.setItem('role',       data.role);
        localStorage.setItem('login_time', Date.now().toString());
    },

    // ── Check if session is valid ──
    isValid() {
        const loginTime = localStorage.getItem('login_time');
        const role      = localStorage.getItem('role');

        if (!loginTime || !role) return false;

        const elapsed = Date.now() - parseInt(loginTime);
        return elapsed < this.SESSION_DURATION;
    },

    // ── Get a session value ──
    get(key) {
        return localStorage.getItem(key);
    },

    // ── Clear session on logout ──
    clear() {
        localStorage.removeItem('user_id');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('role');
        localStorage.removeItem('login_time');
    },

    // ── Auth guard: call on every protected page ──
    // Pass the required role ('Admin', 'Driver', or null for any)
    guard(requiredRole = null) {
        if (!this.isValid()) {
            this.clear();
            window.location.replace('/ADMIN/HTML/login.html');
            return false;
        }

        if (requiredRole && this.get('role') !== requiredRole) {
            // Logged in but wrong role → redirect to their correct dashboard
            const role = this.get('role');
            if (role === 'Admin') {
                window.location.replace('/ADMIN/HTML/admin-dashboard.html');
            } else if (role === 'Driver') {
                window.location.replace('/DRIVERS/HTML/driver-dashboard.html');
            }
            return false;
        }

        return true;
    },

    // ── Logout: clear + block back button ──
    logout(redirectUrl = '/ADMIN/HTML/login.html') {
        this.clear();
        window.location.replace(redirectUrl); // replace() removes page from history
    }
};