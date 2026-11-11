// ========================================
// STARQUEEN PMTS - Config & Session Manager
// ========================================

// The API serves this front end, so API calls go to the same origin.
// (That also lets the browser send the HttpOnly login cookie automatically.)
const CONFIG = {
    API_BASE: window.location.origin
};

// ── Escape text before putting it into innerHTML ──
// Use for anything a user typed: names, farm, address, notes, messages...
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Global 401 handling ──
// If the login cookie is missing or expired, any API call returns 401.
// Send the user back to the login page instead of showing empty data.
(function installAuthRedirect() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = String(args[0]?.url ?? args[0] ?? '');
        if (response.status === 401 && !url.includes('/api/auth/')) {
            SessionManager.clear();
            window.location.replace('/ADMIN/HTML/login.html');
        }
        return response;
    };
})();

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
        // Clear the server-side login cookie too (keepalive survives the redirect)
        fetch(`${CONFIG.API_BASE}/api/auth/logout`, { method: 'POST', keepalive: true }).catch(() => {});
        this.clear();
        window.location.replace(redirectUrl); // replace() removes page from history
    }
};