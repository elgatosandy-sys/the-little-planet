/**
 * storage.js - The Little Planet
 * LocalStorage persistence, refresh recovery, and state management.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'rumi_planet_state_v1';
    const SESSION_KEY = 'rumi_planet_session_v1';

    const defaultState = {
        currentStage: 'birthday-reveal',
        scrollPositions: {},
        unlockedStages: ['birthday-reveal'],
        lockedWish: '',
        starSaved: false,
        stageOverrides: {}
    };

    const STATE_API = '/api/state';
    const CLIENT_ID_KEY = 'rumi_planet_client_id_v1';

    const getClientId = () => {
        try {
            let cid = localStorage.getItem(CLIENT_ID_KEY);
            if (!cid) {
                cid = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
                localStorage.setItem(CLIENT_ID_KEY, cid);
            }
            return cid;
        } catch {
            return 'default_user';
        }
    };

    const loadState = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...defaultState };
            const parsed = JSON.parse(raw);
            return { ...defaultState, ...parsed };
        } catch (e) {
            console.warn('LocalStorage read failed (private browsing?):', e);
            return { ...defaultState };
        }
    };

    const saveState = (newState) => {
        let updated;
        try {
            const current = loadState();
            updated = { ...current, ...newState, timestamp: Date.now() };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('LocalStorage write failed:', e);
            return false;
        }

        // Push state to cloud backend asynchronously with fallback
        syncToCloud(updated);
        return true;
    };

    const syncToCloud = async (state) => {
        try {
            await fetch(STATE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: 'rumi_global_session',
                    state: state
                })
            });
        } catch (err) {
            // Offline / network failure — local state persists safely
        }
    };

    const syncCloudState = async () => {
        try {
            const resp = await fetch(`${STATE_API}?session_id=rumi_global_session`);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.ok && data.state) {
                    const local = loadState();
                    // Merge cloud state if newer or local is initial
                    if (!local.timestamp || (data.state.timestamp && data.state.timestamp >= local.timestamp)) {
                        const merged = { ...defaultState, ...data.state };
                        try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                        } catch {}
                        return merged;
                    }
                }
            }
        } catch (err) {
            // Offline fallback - use localStorage
        }
        return loadState();
    };

    // --- Progress Session Saver ---
    // Tracks currentStage and unlockedStages so an accidental tab close or
    // re-entry restores the user to the furthest stage reached. There is NO
    // automatic expiration: sessions persist until the user explicitly clears
    // them (factory reset, reset progress, etc.), so navigation is never
    // interrupted by a timer check.
    const touchSession = (stageId, unlockedArray) => {
        try {
            const existing = loadActiveSession();
            const now = Date.now();
            const currentStage = stageId || (existing ? existing.currentStage : 'birthday-reveal');
            const unlockedStages = unlockedArray || (existing ? existing.unlockedStages : ['birthday-reveal']);

            const sessionData = {
                currentStage,
                unlockedStages,
                lastActive: now
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
            return sessionData;
        } catch (e) {
            return null;
        }
    };

    const loadActiveSession = () => {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.currentStage) return null;
            // No wall-clock expiry: the session stays valid until explicitly
            // cleared, so re-entry always restores the last stage reached.
            return parsed;
        } catch (e) {
            return null;
        }
    };

    const clearActiveSession = () => {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (e) {}
    };

    const deleteLockedWish = () => {
        const state = loadState();
        state.lockedWish = '';
        saveState(state);
    };

    const resetSavedStar = () => {
        const state = loadState();
        state.starSaved = false;
        saveState(state);
    };

    const resetProgressToStage1 = () => {
        const state = loadState();
        state.currentStage = 'birthday-reveal';
        state.unlockedStages = ['birthday-reveal'];
        state.scrollPositions = {};
        saveState(state);
        clearActiveSession();
    };

    const fullFactoryReset = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SESSION_KEY);
        } catch (e) {}
    };

    // --- Reset progress (admin "Reset Progress") ---------------------------
    // Clears the visitor's active state and recipient progress — current
    // stage, unlocked stages, scroll positions, and the active session —
    // WITHOUT destroying underlying tokens or deleting any backup/legacy
    // files. The server-side wish/star records (wishes.db) and the admin key
    // file are untouched; only the local journey is rewound to the welcome
    // stage so the recipient can walk through the experience again.
    const resetProgress = () => {
        const state = loadState();
        state.currentStage = 'birthday-reveal';
        state.unlockedStages = ['birthday-reveal'];
        state.scrollPositions = {};
        saveState(state);
        clearActiveSession();
    };

    const exportStateJSON = () => {
        const state = loadState();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `rumi_planet_state_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const importStateJSON = (jsonString) => {
        try {
            const parsed = JSON.parse(jsonString);
            saveState(parsed);
            window.location.reload();
            return true;
        } catch (e) {
            alert('Invalid JSON file.');
            return false;
        }
    };

    window.LittlePlanetStorage = {
        loadState,
        saveState,
        syncCloudState,
        syncToCloud,
        touchSession,
        loadActiveSession,
        clearActiveSession,
        deleteLockedWish,
        resetSavedStar,
        resetProgressToStage1,
        resetProgress,
        fullFactoryReset,
        exportStateJSON,
        importStateJSON
    };
})();
