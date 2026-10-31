/**
 * main.js - The Little Planet (Sweet 16 for Miruna / Rumi)
 * Core Application Bundle: EventBus, Animation Helpers, Router, Page Container, Stage 1 (Birthday Reveal)
 */

(function () {
    'use strict';

    // --- 1. EventBus (Pub/Sub) ---
    const EventBus = {
        events: {},
        on(event, callback) {
            if (!this.events[event]) this.events[event] = [];
            this.events[event].push(callback);
        },
        off(event, callback) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        },
        emit(event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(callback => callback(data));
        }
    };

    // --- 2. Animation & Accessibility Helpers ---
    const prefersReducedMotion = () => {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    let statusRegion = null;

    const announceStatus = (message) => {
        if (!statusRegion) {
            statusRegion = document.getElementById('status-region');
        }
        if (!statusRegion) return;
        statusRegion.textContent = '';
        setTimeout(() => {
            statusRegion.textContent = message;
        }, 100);
    };

    const particleBurst = (container, x, y) => {
        if (prefersReducedMotion()) return;
        const colors = ['#D4AF7F', '#D7A3AD', '#F1E7DC', '#9B8CB8'];
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'star-particle';
            const angle = Math.random() * Math.PI * 2;
            const distance = 40 + Math.random() * 60;
            particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
            particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 800);
        }
    };

    // --- Haptic Feedback (Vibration API) ---
    const haptics = {
        impact: (style = 'light') => {
            if (navigator.vibrate) {
                try {
                    if (style === 'light') navigator.vibrate(15);
                    else if (style === 'medium') navigator.vibrate(30);
                    else if (style === 'heavy') navigator.vibrate(50);
                    else if (style === 'soft') navigator.vibrate([10, 5, 10]);
                } catch (e) {
                    // Ignore vibration errors (permission, unsupported, etc.)
                }
            }
        },
        notification: (type = 'success') => {
            if (navigator.vibrate) {
                try {
                    if (type === 'success') navigator.vibrate([15, 30, 15]);
                    else if (type === 'warning') navigator.vibrate([50, 20, 50]);
                    else if (type === 'error') navigator.vibrate([80, 40, 80]);
                } catch (e) {}
            }
        }
    };
    window.LittlePlanetHaptics = haptics;

    // --- 3. Stages & Router ---
    const STAGES = {
        STAGE_1: 'birthday-reveal',
        STAGE_2: 'cake-wish',
        STAGE_3: 'little-planet',
        STAGE_4: 'little-note',
        STAGE_5: 'rumi-lore',
        STAGE_6: 'museum-of-rumi',
        STAGE_7: 'libra-constellation',
        STAGE_8: 'three-wishes',
        STAGE_9: 'piece-of-you',
        STAGE_10: 'her-little-planet',
        STAGE_11: 'closing-note'
    };

    const registry = new Map();
    let currentStage = null;

    // Track unlocked stages (stages the user has completed)
    const unlockedStages = new Set([STAGES.STAGE_1]);

    // Synchronously hydrate state on script parse (FOUC prevention).
    // Hydrate unlockedStages from the persisted state so the sequential gate
    // knows which stages the user has completed. The active session is also
    // read here, but currentStage is only restored when a valid stage hash is
    // present in the URL — a bare URL load always renders the welcome stage.
    const initialStorageState = window.LittlePlanetStorage ? window.LittlePlanetStorage.loadState() : null;
    if (initialStorageState && initialStorageState.unlockedStages) {
        initialStorageState.unlockedStages.forEach(s => unlockedStages.add(s));
    }

    // Hydrate unlockedStages from the active session so the sequential gate
    // knows which stages the user has already completed. The session itself
    // never auto-expires, and currentStage is only restored when a valid
    // stage hash is present in the URL — never on a bare URL load.
    let activeSession = null;
    if (window.LittlePlanetStorage && window.LittlePlanetStorage.loadActiveSession) {
        activeSession = window.LittlePlanetStorage.loadActiveSession();
        if (activeSession && Array.isArray(activeSession.unlockedStages)) {
            activeSession.unlockedStages.forEach(s => unlockedStages.add(s));
        }
    }
    
    // Stage order for forward/back navigation
    const STAGE_ORDER = [
        STAGES.STAGE_1,
        STAGES.STAGE_2,
        STAGES.STAGE_3,
        STAGES.STAGE_4,
        STAGES.STAGE_5,
        STAGES.STAGE_6,
        STAGES.STAGE_7,
        STAGES.STAGE_8,
        STAGES.STAGE_9,
        STAGES.STAGE_10,
        STAGES.STAGE_11
    ];

    const registerStage = (stageId, renderFn) => {
        registry.set(stageId, renderFn);
    };

    // Check if a stage can be navigated to
    const canNavigateTo = (targetStage) => {
        const currentIndex = STAGE_ORDER.indexOf(currentStage);
        const targetIndex = STAGE_ORDER.indexOf(targetStage);

        if (targetIndex === -1) {
            // Special routes outside the sequential stage order (e.g. /#miss-u-rumi)
            // are not subject to sequential gating.
            return targetStage === 'miss-u-rumi' && registry.has(targetStage);
        }

        // Any stage that has already been unlocked is reachable, whether the
        // user is moving forward, backward, or restoring from a saved session
        // (where currentStage may be null and the gate would otherwise reject
        // a valid forward stage on first paint).
        if (unlockedStages.has(targetStage)) {
            return true;
        }

        // Can only go forward if the NEXT stage is unlocked
        // (must complete current stage first)
        return targetIndex === currentIndex + 1;
    };

    // Mark a stage as completed/unlocked
    const unlockStage = (stageId) => {
        unlockedStages.add(stageId);
        if (window.LittlePlanetStorage) {
            const st = window.LittlePlanetStorage.loadState();
            st.unlockedStages = Array.from(unlockedStages);
            window.LittlePlanetStorage.saveState(st);
            // Extend/reset the 2-minute session saver on every unlock.
            if (window.LittlePlanetStorage.touchSession) {
                window.LittlePlanetStorage.touchSession(currentStage || stageId, Array.from(unlockedStages));
            }
        }
    };

    // Get the previous unlocked stage for back navigation
    const getPreviousUnlockedStage = () => {
        const currentIndex = STAGE_ORDER.indexOf(currentStage);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (unlockedStages.has(STAGE_ORDER[i])) {
                return STAGE_ORDER[i];
            }
        }
        return STAGES.STAGE_1;
    };

    const navigateTo = (stageId) => {
        if (stageId === currentStage) return;

        // Enforce sequential gating: can only navigate forward if next stage is unlocked
        // Can always navigate backward to unlocked stages
        if (!canNavigateTo(stageId)) {
            announceStatus('Complete the current page to continue.');
            return;
        }

        const appRoot = document.getElementById('main-content');
        if (!appRoot) return;

        try {
            executeStageTransition(stageId, appRoot);
            currentStage = stageId;
            window.location.hash = stageId;

            if (window.LittlePlanetStorage) {
                const st = window.LittlePlanetStorage.loadState();
                st.currentStage = stageId;
                st.unlockedStages = Array.from(unlockedStages);
                if (!st.scrollPositions) st.scrollPositions = {};
                st.scrollPositions[stageId] = window.scrollY;
                window.LittlePlanetStorage.saveState(st);
                // Extend/reset the 2-minute session saver on every navigation
                // so an accidental tab close within 2 minutes restores progress.
                if (window.LittlePlanetStorage.touchSession) {
                    window.LittlePlanetStorage.touchSession(stageId, Array.from(unlockedStages));
                }
            }

            window.scrollTo({ top: 0, behavior: 'instant' });
        } catch (err) {
            console.error('Stage render failed:', err);
            announceStatus('Something went wrong. Please try again.');
        }
    };

    // Ensure initial hash is set if page loads without one
    // ALWAYS redirect to birthday-reveal (never to admin)
    const ensureInitialHash = () => {
        if (!window.location.hash) {
            window.location.hash = STAGES.STAGE_1;
        }
    };

    const executeStageTransition = (stageId, container) => {
        container.innerHTML = '';
        currentStage = stageId;

        // Update hash without triggering hashchange loop
        if (window.location.hash !== `#${stageId}`) {
            try {
                window.history.replaceState(null, '', `#${stageId}`);
            } catch (e) {
                // ignore
            }
        }

        const renderFn = registry.get(stageId) || registry.get(STAGES.STAGE_1);
        if (renderFn) {
            const stageElement = renderFn();
            container.appendChild(stageElement);
        }
    };

    // --- 4. Page Container & UI Components ---
    const PageContainer = (contentNode, themeClass = 'page--cosmic') => {
        const section = document.createElement('section');
        section.className = `page-container ${themeClass}`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'content-wrapper';
        wrapper.appendChild(contentNode);
        
        section.appendChild(wrapper);
        return section;
    };

    const PaperCard = (titleText, bodyText) => {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        if (titleText) {
            const h2 = document.createElement('h2');
            h2.className = 'storybook-heading';
            h2.textContent = titleText;
            card.appendChild(h2);
        }
        
        if (bodyText) {
            const p = document.createElement('p');
            p.className = 'body-text';
            p.textContent = bodyText;
            card.appendChild(p);
        }
        
        return card;
    };

    // --- 5. Stage 1: Birthday Reveal Implementation ---
    const renderStage1 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-birthday-reveal';

        // Decorative starfield background layer
        const starfield = document.createElement('div');
        starfield.className = 'starfield';
        container.appendChild(starfield);

        const revealContainer = document.createElement('div');
        revealContainer.className = 'reveal-container';

        // Central gathering glow
        const glowBg = document.createElement('div');
        glowBg.className = 'reveal-glow-bg';
        revealContainer.appendChild(glowBg);

        // Sequential text lines
        const line1 = document.createElement('p');
        line1.className = 'reveal-line reveal-line--1';
        line1.textContent = 'Welcome, Miruna.';

        const line2 = document.createElement('p');
        line2.className = 'reveal-line reveal-line--2';
        line2.textContent = 'Something special awaits you.';

        const line3 = document.createElement('h1');
        line3.className = 'reveal-line reveal-line--3 reveal-title';
        line3.textContent = 'Happy Sweet 16, Miruna! ✨';

        const line4 = document.createElement('p');
        line4.className = 'reveal-line reveal-line--4';
        line4.textContent = 'A whole new chapter begins.';

        // Action area with the primary button
        const actionArea = document.createElement('div');
        actionArea.className = 'reveal-action';

        const celebrateBtn = document.createElement('button');
        celebrateBtn.className = 'btn btn--primary';
        celebrateBtn.textContent = "Let's celebrate →";
        celebrateBtn.addEventListener('click', () => {
            if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('medium');
            unlockStage(STAGES.STAGE_2);
            navigateTo(STAGES.STAGE_2);
        });

        actionArea.appendChild(celebrateBtn);

        revealContainer.appendChild(line1);
        revealContainer.appendChild(line2);
        revealContainer.appendChild(line3);
        revealContainer.appendChild(line4);
        revealContainer.appendChild(actionArea);

        container.appendChild(revealContainer);

        // Staggered sequential reveal animation
        const runSequentialReveal = () => {
            if (prefersReducedMotion()) {
                // Reduced motion: show all lines immediately
                [line1, line2, line3, line4].forEach(el => el.classList.add('is-visible'));
                actionArea.classList.add('is-visible');
                return;
            }

            const delays = [0, 700, 1400, 2100];
            const elements = [line1, line2, line3, line4];

            elements.forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delays[index]);
            });

            // Show button after the 4th line has appeared
            setTimeout(() => {
                actionArea.classList.add('is-visible');
            }, delays[3] + 600);
        };

        // Run sequential reveal after a brief delay on page load
        setTimeout(runSequentialReveal, 400);

        return PageContainer(container, 'page--cosmic');
    };

    const initRouter = () => {
        if (!statusRegion) {
            statusRegion = document.getElementById('status-region');
        }
        ensureInitialHash();
        boot();
    };

    // --- 6. App Initialization ---
    const boot = () => {
        registerStage(STAGES.STAGE_1, renderStage1);
        // NOTE: The /#miss-u-rumi route is normally registered by admin.js
        // (loaded after this file). It is intentionally NOT registered here so
        // boot() can run before admin.js has parsed without throwing a
        // ReferenceError.
        //
        // Inline fallback: if admin.js failed to load (or the route was never
        // registered by the time boot runs), /#miss-u-rumi still renders an
        // explicit dashboard shell instead of a blank screen. There is no
        // password form or key prompt — the unguessable route itself is the
        // access control. We never rely on a dynamic import that can fail
        // silently.
        if (!registry.has('miss-u-rumi')) {
            registerStage('miss-u-rumi', renderInlineAdminFallback);
        }

        const initialHash = window.location.hash.replace('#', '');
        let targetStage = STAGES.STAGE_1;

        // A bare URL (empty hash) ALWAYS renders the welcome reveal stage.
        // We never restore currentStage from local storage here — saved
        // progress is only honored when a valid stage hash is present in the
        // URL (explicit deep link) or when the user navigates back into an
        // active session. Hitting Refresh on the bare URL therefore stays on
        // /#birthday-reveal instead of jumping to an old saved stage.
        if (!initialHash) {
            targetStage = STAGES.STAGE_1;
        } else if (initialHash === 'miss-u-rumi') {
            // /#miss-u-rumi always renders the admin dashboard immediately —
            // there is no password form or key prompt. Never a blank screen.
            targetStage = 'miss-u-rumi';
        } else if (initialHash && registry.has(initialHash)) {
            targetStage = initialHash;
        } else if (initialStorageState && initialStorageState.currentStage && registry.has(initialStorageState.currentStage)) {
            targetStage = initialStorageState.currentStage;
        }

        navigateTo(targetStage);

        if (initialStorageState && initialStorageState.scrollPositions && initialStorageState.scrollPositions[targetStage]) {
            setTimeout(() => {
                window.scrollTo(0, initialStorageState.scrollPositions[targetStage]);
            }, 50);
        }
        window.addEventListener('hashchange', onHashChange);
    };

    const onHashChange = () => {
        const hash = window.location.hash.replace('#', '');
        // A bare URL (empty hash) ALWAYS resolves to the welcome state —
        // never to the admin route. An unknown hash leaves the current
        // stage alone instead of teleporting the user back to the start.
        let target;
        if (!hash) {
            target = STAGES.STAGE_1;
        } else if (registry.has(hash)) {
            target = hash;
        } else {
            return;
        }
        if (target !== currentStage) {
            navigateTo(target);
        }
    };

    // --- Helper: Create a back navigation button ---
    const renderBackButton = (targetStage) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--back';
        btn.innerHTML = '← Back';
        btn.addEventListener('click', () => {
            if (!canNavigateTo(targetStage)) return;
            navigateTo(targetStage);
        });

        const wrap = document.createElement('div');
        wrap.className = 'back-nav-wrap';
        wrap.appendChild(btn);
        return wrap;
    };

    // --- Helper: Confirmation modal (shared by Wish + Add my star) ---
    // Returns a Promise that resolves with true (confirmed) or false (cancelled).
    // Safe to call multiple times — each call creates its own overlay.
    const confirmAction = (message, confirmLabel = 'Yes, lock it in ✨', cancelLabel = 'Cancel') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-labelledby', 'confirm-msg');
            overlay.innerHTML = `
                <div class="confirm-card" role="alertdialog" aria-describedby="confirm-msg">
                    <div class="confirm-icon" aria-hidden="true">✨</div>
                    <p id="confirm-msg" class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button type="button" class="btn btn--primary confirm-confirm">${confirmLabel}</button>
                        <button type="button" class="btn btn--secondary confirm-cancel">${cancelLabel}</button>
                    </div>
                </div>`;
            document.body.classList.add('is-modal-open');
            document.body.appendChild(overlay);

            // Force reflow so the transition plays
            requestAnimationFrame(() => overlay.classList.add('is-visible'));

            const cleanup = (result) => {
                document.body.classList.remove('is-modal-open');
                overlay.classList.remove('is-visible');
                setTimeout(() => overlay.remove(), 250);
                resolve(result);
            };

            overlay.querySelector('.confirm-confirm').addEventListener('click', () => cleanup(true));
            overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', escHandler); }
                else if (e.key === 'Enter') { cleanup(true); document.removeEventListener('keydown', escHandler); }
            });
            overlay.querySelector('.confirm-confirm').focus();
        });
    };

    // --- Inline admin dashboard fallback (no dynamic imports) ---------------
    // If admin.js failed to load for any reason, /#miss-u-rumi still renders
    // an explicit dashboard shell instead of a blank screen. There is no
    // password form or key prompt: the unguessable route itself is the access
    // control. If admin.js IS loaded, its renderAdminPage takes over.
    const renderInlineAdminFallback = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-admin';

        const starfield = document.createElement('div');
        starfield.className = 'starfield';
        container.appendChild(starfield);

        const stage = document.createElement('div');
        stage.className = 'admin-stage';

        const title = document.createElement('h2');
        title.className = 'storybook-heading';
        title.textContent = 'Admin Panel';
        stage.appendChild(title);

        const note = document.createElement('p');
        note.className = 'admin-hint body-text';
        note.textContent = 'Admin dashboard (admin.js unavailable).';
        stage.appendChild(note);

        container.appendChild(stage);

        return PageContainer(container, 'page--cosmic');
    };

    window.LittlePlanet = {
        STAGES,
        registerStage,
        navigateTo,
        navigate: navigateTo, // Alias for admin.js compatibility
        initRouter: () => {
            if (!statusRegion) {
                statusRegion = document.getElementById('status-region');
            }
            boot();
        },
        boot,
        announceStatus,
        prefersReducedMotion,
        particleBurst,
        PageContainer,
        renderBackButton,
        confirmAction,
        unlockStage,
        get statusRegion() { return statusRegion; },
        makeStarfield: () => {
            const sf = document.createElement('div');
            sf.className = 'starfield';
            sf.setAttribute('aria-hidden', 'true');
            return sf;
        },
        EventBus
    };

    // Auto-initialize the router on page load so the SPA renders immediately.
    // (The test suite calls boot()/initRouter() manually, which is why it
    // passed while the live page rendered a blank screen.)
    //
    // Deferred to DOMContentLoaded so every classic <script> below main.js
    // (notably admin.js, which registers the /#miss-u-rumi route) has finished
    // registering before boot() runs. A synchronous call here would reference
    // renderAdminPage before admin.js defines it.
    const autoInit = () => {
        if (window.LittlePlanet) window.LittlePlanet.initRouter();
    };
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})();