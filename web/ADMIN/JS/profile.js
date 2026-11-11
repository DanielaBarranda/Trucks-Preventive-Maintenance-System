// ========================================
// STARQUEEN PMTS - Profile
// ========================================

SessionManager.guard('Admin');

const storedUserId = SessionManager.get('user_id');
const storedEmail  = SessionManager.get('email');

// ── DOM Refs ────────────────────────────
const loadingOverlay       = document.getElementById('loadingOverlay');
const profileAvatar        = document.getElementById('profileAvatar');
const profileName          = document.getElementById('profileName');
const profileRole          = document.getElementById('profileRole');
const profileEmail         = document.getElementById('profileEmail');
const profileId            = document.getElementById('profileId');
const profileRoleMeta      = document.getElementById('profileRoleMeta');
const profileEmailMeta     = document.getElementById('profileEmailMeta');
const usernameInput        = document.getElementById('usernameInput');
const saveUsernameBtn      = document.getElementById('saveUsernameBtn');
const usernameFeedback     = document.getElementById('usernameFeedback');
const currentPasswordInput = document.getElementById('currentPasswordInput');
const newPasswordInput     = document.getElementById('newPasswordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const savePasswordBtn      = document.getElementById('savePasswordBtn');
const passwordFeedback     = document.getElementById('passwordFeedback');

function showLoading() { loadingOverlay?.classList.add('active'); }
function hideLoading() { loadingOverlay?.classList.remove('active'); }

function showFeedback(el, message, type) {
    el.textContent = message;
    el.className   = `form-feedback ${type}`;
    setTimeout(() => { el.textContent = ''; el.className = 'form-feedback'; }, 4000);
}

let currentUser = null;

async function loadUser() {
    showLoading();
    try {
        const res  = await fetch(`${CONFIG.API_BASE}/api/Users/${storedUserId}`);
        const user = await res.json();
        currentUser = user;
        renderProfile(user);
    } catch (err) {
        console.error('Error loading user:', err);
        renderProfile({
            user_id:  storedUserId,
            username: SessionManager.get('username'),
            email:    storedEmail,
            role:     SessionManager.get('role'),
        });
    } finally {
        hideLoading();
    }
}

function renderProfile(user) {
    const initial = (user.username || 'A')[0].toUpperCase();
    profileAvatar.textContent    = initial;
    profileName.textContent      = user.username  || '—';
    profileRole.textContent      = user.role      || '—';
    profileEmail.textContent     = user.email     || '—';
    profileId.textContent        = `#${user.user_id}`;
    profileRoleMeta.textContent  = user.role      || '—';
    profileEmailMeta.textContent = user.email     || '—';
    usernameInput.value          = user.username  || '';
}

saveUsernameBtn?.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim();
    if (!newUsername) { showFeedback(usernameFeedback, 'Username cannot be empty.', 'error'); return; }
    if (newUsername === currentUser?.username) { showFeedback(usernameFeedback, 'No changes made.', 'error'); return; }

    saveUsernameBtn.disabled    = true;
    saveUsernameBtn.textContent = 'Saving...';

    try {
        const updated = { username: newUsername, email: currentUser?.email, role: currentUser?.role };
        const res = await fetch(`${CONFIG.API_BASE}/api/Users/${storedUserId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(updated)
        });

        if (res.ok) {
            currentUser.username = newUsername;
            // Update SessionManager so sidebar reflects new name
            localStorage.setItem('username', newUsername);
            renderProfile(currentUser);
            showFeedback(usernameFeedback, '✓ Username updated successfully!', 'success');
            const sidebarName = document.getElementById('sidebarUsername');
            if (sidebarName) sidebarName.textContent = newUsername;
        } else {
            showFeedback(usernameFeedback, 'Failed to update username. Try again.', 'error');
        }
    } catch (err) {
        showFeedback(usernameFeedback, 'Network error. Please try again.', 'error');
    } finally {
        saveUsernameBtn.disabled    = false;
        saveUsernameBtn.textContent = 'Save Username';
    }
});

savePasswordBtn?.addEventListener('click', async () => {
    const currentPw = currentPasswordInput.value;
    const newPw     = newPasswordInput.value;
    const confirmPw = confirmPasswordInput.value;

    if (!currentPw || !newPw || !confirmPw) {
        showFeedback(passwordFeedback, 'Please fill in all password fields.', 'error'); return;
    }
    if (newPw.length < 5) {
        showFeedback(passwordFeedback, 'New password must be at least 5 characters.', 'error'); return;
    }
    if (newPw !== confirmPw) {
        showFeedback(passwordFeedback, 'New passwords do not match.', 'error'); return;
    }

    savePasswordBtn.disabled    = true;
    savePasswordBtn.textContent = 'Saving...';

    try {
        // The server checks the current password (passwords are never sent to the browser)
        const res = await fetch(`${CONFIG.API_BASE}/api/auth/change-password`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ current_password: currentPw, new_password: newPw })
        });

        if (res.ok) {
            currentPasswordInput.value = '';
            newPasswordInput.value     = '';
            confirmPasswordInput.value = '';
            showFeedback(passwordFeedback, '✓ Password changed successfully!', 'success');
        } else {
            const data = await res.json().catch(() => ({}));
            showFeedback(passwordFeedback, data.message || 'Failed to change password. Try again.', 'error');
        }
    } catch (err) {
        showFeedback(passwordFeedback, 'Network error. Please try again.', 'error');
    } finally {
        savePasswordBtn.disabled    = false;
        savePasswordBtn.textContent = 'Change Password';
    }
});

document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        input.type  = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
});

document.addEventListener('DOMContentLoaded', () => loadUser());