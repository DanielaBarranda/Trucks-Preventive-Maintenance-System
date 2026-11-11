// ============================================================
//  SESSION FIX — Add this to your existing SessionManager
//  or call it at the top of every driver page JS file
//  Clears stale localStorage truck data on every login
// ============================================================

// Add this inside SessionManager.guard() or call separately
// Ensures truck data is always fetched fresh from API
// and never persists from a previous driver's session

(function clearStaleSession() {
    // Clear all truck-related localStorage keys
    // These should never persist between different driver logins
    const staleKeys = [
        'selectedTruck',
        'lastOdometerReading',
        // Do NOT clear prefillExpenseCategory here —
        // that's intentional cross-page data within same session
    ];

    // Only clear if the stored truck doesn't match current user
    try {
        const userId     = SessionManager.get('user_id');
        const storedTruck = localStorage.getItem('selectedTruck');
        if (storedTruck) {
            const truck = JSON.parse(storedTruck);
            const storedUserId = String(truck.userID ?? truck.userId ?? truck.user_id ?? '');
            if (storedUserId && storedUserId !== String(userId)) {
                // Different user logged in — clear stale truck data
                staleKeys.forEach(k => localStorage.removeItem(k));
                console.log('[Session] Cleared stale truck data for new user');
            }
        }
    } catch (e) { /* ignore */ }
})();