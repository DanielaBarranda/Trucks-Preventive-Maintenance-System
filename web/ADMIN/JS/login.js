// ========================================
// STARQUEEN PMTS - Login Script
// Connected to API
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    // ── If already logged in, skip login page ──
    if (SessionManager.isValid()) {
        const role = SessionManager.get('role');
        if (role === 'Admin') {
            window.location.replace('/ADMIN/HTML/admin-dashboard.html');
        } else if (role === 'Driver') {
            window.location.replace('/DRIVERS/HTML/driver-dashboard.html');
        }
        return;
    }

    // =============================
    // Element References
    // =============================
    const loginForm         = document.getElementById('loginForm');
    const emailInput        = document.getElementById('email');
    const passwordInput     = document.getElementById('password');
    const emailError        = document.getElementById('email-error');
    const passwordError     = document.getElementById('password-error');
    const forgotPasswordLink = document.querySelector('.forgot-password-link');

    if (!loginForm) return;

    // =============================
    // Validation Functions
    // =============================
    const showError = (input, errorEl, message) => {
        input.classList.add('error');
        errorEl.textContent = message;
        input.setAttribute('aria-invalid', 'true');
    };

    const clearError = (input, errorEl) => {
        input.classList.remove('error');
        errorEl.textContent = '';
        input.setAttribute('aria-invalid', 'false');
    };

    const validateEmail = () => {
        const value = emailInput.value.trim();
        if (!value) {
            showError(emailInput, emailError, 'Please enter your email');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            return false;
        }
        clearError(emailInput, emailError);
        return true;
    };

    const validatePassword = () => {
        const value = passwordInput.value;
        if (!value) {
            showError(passwordInput, passwordError, 'Please enter your password');
            return false;
        }
        clearError(passwordInput, passwordError);
        return true;
    };

    // =============================
    // Debounced Real-Time Validation
    // =============================
    const debounce = (func, delay = 400) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    emailInput.addEventListener('input', debounce(() => {
        emailInput.value ? validateEmail() : clearError(emailInput, emailError);
    }));

    passwordInput.addEventListener('input', debounce(() => {
        passwordInput.value ? validatePassword() : clearError(passwordInput, passwordError);
    }));

    // =============================
    // Form Submission
    // =============================
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isEmailValid    = validateEmail();
        const isPasswordValid = validatePassword();

        if (!isEmailValid || !isPasswordValid) {
            (!isEmailValid ? emailInput : passwordInput).focus();
            return;
        }

        const submitBtn = loginForm.querySelector('.login-button');
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Logging in...';

        await handleLogin(
            emailInput.value.trim(),
            passwordInput.value,
            submitBtn
        );
    });

    // =============================
    // Real Login — calls API
    // =============================
    async function handleLogin(email, password, button) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // ── Save session via SessionManager ──
                SessionManager.save(data);

                // ── Redirect based on role ──
                if (data.role === 'Admin') {
                    window.location.replace('/ADMIN/HTML/admin-dashboard.html');
                } else if (data.role === 'Driver') {
                    window.location.replace('/DRIVERS/HTML/driver-dashboard.html');
                } else {
                    window.location.replace('/ADMIN/HTML/admin-dashboard.html');
                }

            } else {
                showError(emailInput, emailError, data.message || 'Invalid email or password');
                showError(passwordInput, passwordError, ' ');
                button.disabled    = false;
                button.textContent = 'Login';
            }

        } catch (error) {
            console.error('Login error:', error);
            showError(emailInput, emailError, 'Cannot connect to server. Please try again.');
            button.disabled    = false;
            button.textContent = 'Login';
        }
    }

    // =============================
    // Forgot Password
    // =============================
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Please contact your administrator to reset your password.');
    });

    // =============================
    // Input Focus Styling
    // =============================
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('focus', () =>
            input.parentElement.classList.add('focused')
        );
        input.addEventListener('blur', () =>
            input.parentElement.classList.remove('focused')
        );
    });

    // =============================
    // Remember Email
    // =============================
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) emailInput.value = savedEmail;

    // =============================
    // Auto Focus
    // =============================
    setTimeout(() => emailInput.focus(), 100);

    console.log('StarQueen Login System Ready');
});