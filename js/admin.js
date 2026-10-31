/**
 * admin.js - The Little Planet
 * Admin page module: secret-route admin dashboard at /#miss-u-rumi.
 *
 * Accessing /#miss-u-rumi renders the admin dashboard immediately — there is
 * no password form, no key prompt, and no client-side session token gate.
 * The route itself (an unguessable hash) is the access control.
 * Wish and star retrieval hit server-side /api/admin/wishes and /api/admin/stars.
 */

// Admin module - loaded after main.js, so window.LittlePlanet should be available
const WISHES_API = '/api/admin/wishes';
const STARS_API = '/api/admin/stars';

// Render admin panel content
const renderAdminContent = () => {
    const app = window.LittlePlanet;
    if (!app) return null;
    const { PageContainer, makeStarfield, renderBackButton, STAGES, navigateTo } = app;

    const container = document.createElement('div');
    container.className = 'stage-content stage-admin';

    container.appendChild(makeStarfield());

    if (renderBackButton) {
        container.appendChild(renderBackButton(STAGES.STAGE_1));
    }

    const stage = document.createElement('div');
    stage.className = 'admin-stage';

    const title = document.createElement('h2');
    title.className = 'storybook-heading';
    title.textContent = 'Admin Panel';
    title.style.textAlign = 'center';
    title.style.color = 'var(--color-burgundy)';
    stage.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'overline';
    subtitle.textContent = 'Secret Control Room';
    subtitle.style.textAlign = 'center';
    subtitle.style.marginTop = 'var(--space-xs)';
    subtitle.style.color = 'var(--color-pink-violet)';
    stage.appendChild(subtitle);

    const escapeHtml = (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatTimestamp = (iso) => {
        if (!iso) return 'Unknown time';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        try {
            return d.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return d.toISOString();
        }
    };

    const statusMsgEl = document.createElement('p');
    statusMsgEl.id = 'admin-auth-status';
    statusMsgEl.className = 'admin-auth-status';
    statusMsgEl.setAttribute('role', 'status');
    statusMsgEl.setAttribute('aria-live', 'polite');
    statusMsgEl.style.minHeight = '1.2em';
    statusMsgEl.style.marginBottom = 'var(--space-md)';
    statusMsgEl.style.color = 'var(--color-pink-violet)';

    // Breakdown overview card
    const breakdownCard = document.createElement('div');
    breakdownCard.className = 'card';
    breakdownCard.style.marginBottom = 'var(--space-lg)';
    breakdownCard.style.padding = 'var(--space-md) var(--space-lg)';
    breakdownCard.style.background = 'var(--color-warm-cream)';
    breakdownCard.style.border = '1px solid var(--color-border-paper)';

    const breakdownHead = document.createElement('div');
    breakdownHead.style.display = 'flex';
    breakdownHead.style.alignItems = 'baseline';
    breakdownHead.style.justifyContent = 'space-between';
    breakdownHead.style.gap = 'var(--space-xs)';

    const breakdownH3 = document.createElement('h3');
    breakdownH3.textContent = 'Response Breakdown';
    breakdownH3.style.fontFamily = 'var(--font-serif)';
    breakdownH3.style.fontSize = 'var(--text-h4-size)';
    breakdownH3.style.color = 'var(--color-burgundy)';
    breakdownHead.appendChild(breakdownH3);

    const breakdownTotal = document.createElement('span');
    breakdownTotal.id = 'admin-breakdown-total';
    breakdownTotal.className = 'admin-submissions-count';
    breakdownTotal.style.color = 'var(--color-pink-violet)';
    breakdownTotal.textContent = '0 wishes · 0 stars';
    breakdownHead.appendChild(breakdownTotal);

    breakdownCard.appendChild(breakdownHead);

    const breakdownGrid = document.createElement('div');
    breakdownGrid.id = 'admin-breakdown-grid';
    breakdownGrid.style.display = 'grid';
    breakdownGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    breakdownGrid.style.gap = 'var(--space-xs)';
    breakdownGrid.style.marginTop = 'var(--space-sm)';

    const breakdownItems = [
        { key: 'wishes', label: 'Wishes saved', value: '0' },
        { key: 'stars', label: 'Stars saved', value: '0' },
        { key: 'locked', label: 'Wish locked', value: 'No' },
        { key: 'stage', label: 'Current stage', value: 'Birthday Reveal' },
    ];

    breakdownItems.forEach((item) => {
        const cell = document.createElement('div');
        cell.style.background = 'var(--color-warm-cream)';
        cell.style.borderRadius = 'var(--radius-md)';
        cell.style.padding = 'var(--space-xs) var(--space-sm)';
        cell.style.border = '1px solid var(--color-border-paper)';
        cell.innerHTML = `
            <span class="status-pill status-pill--active" style="font-size:0.6rem;padding:1px 8px;margin-bottom:4px;display:inline-block;color:var(--color-burgundy);background:var(--color-dusty-pink);">${item.label}</span>
            <div class="admin-breakdown__value" id="admin-breakdown-${item.key}" style="font-family:var(--font-serif);font-size:1.1rem;color:var(--color-burgundy);margin-top:2px;">${item.value}</div>
        `;
        breakdownGrid.appendChild(cell);
    });

    breakdownCard.appendChild(breakdownGrid);

    // Submissions section (Wishes & Stars)
    const submissionsSection = document.createElement('div');
    submissionsSection.id = 'admin-submissions-section';

    const submissionsHead = document.createElement('div');
    submissionsHead.className = 'admin-submissions-head';
    submissionsHead.style.display = 'flex';
    submissionsHead.style.alignItems = 'baseline';
    submissionsHead.style.justifyContent = 'space-between';
    submissionsHead.style.gap = 'var(--space-xs)';

    const submissionsH3 = document.createElement('h3');
    submissionsH3.textContent = 'Submissions';
    submissionsH3.style.fontFamily = 'var(--font-serif)';
    submissionsH3.style.fontSize = 'var(--text-h3-size)';
    submissionsH3.style.color = 'var(--color-burgundy)';
    submissionsHead.appendChild(submissionsH3);

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'btn btn--secondary btn--sm';
    refreshBtn.id = 'admin-refresh-submissions';
    refreshBtn.textContent = 'Refresh Submissions';
    submissionsHead.appendChild(refreshBtn);

    submissionsSection.appendChild(submissionsHead);

    const submissionsList = document.createElement('div');
    submissionsList.id = 'admin-submissions-list';
    submissionsList.className = 'admin-submissions-list';
    submissionsList.setAttribute('aria-live', 'polite');
    submissionsList.style.marginTop = 'var(--space-sm)';
    submissionsList.style.maxHeight = '50vh';
    submissionsList.style.overflowY = 'auto';
    submissionsList.style.display = 'flex';
    submissionsList.style.flexDirection = 'column';
    submissionsList.style.gap = 'var(--space-xs)';
    submissionsList.style.paddingRight = 'var(--space-3xs)';
    submissionsSection.appendChild(submissionsList);

    stage.appendChild(statusMsgEl);
    stage.appendChild(breakdownCard);
    stage.appendChild(submissionsSection);

    // Single State Control section: Reset Progress ONLY
    const actionsSection = document.createElement('div');
    actionsSection.className = 'admin-section';
    actionsSection.style.marginTop = 'var(--space-lg)';
    actionsSection.style.paddingTop = 'var(--space-md)';
    actionsSection.style.borderTop = '1px solid var(--color-border-paper)';

    const actionsH3 = document.createElement('h3');
    actionsH3.textContent = 'State Controls';
    actionsH3.style.fontFamily = 'var(--font-serif)';
    actionsH3.style.fontSize = 'var(--text-h4-size)';
    actionsH3.style.color = 'var(--color-burgundy)';
    actionsH3.style.marginBottom = 'var(--space-sm)';
    actionsSection.appendChild(actionsH3);

    const actionsHint = document.createElement('p');
    actionsHint.className = 'admin-hint';
    actionsHint.textContent = 'Reset the recipient\'s journey back to the welcome stage. Saved wishes, stars, and server records remain intact.';
    actionsHint.style.marginBottom = 'var(--space-sm)';
    actionsHint.style.color = 'var(--color-burgundy)';
    actionsSection.appendChild(actionsHint);

    const actionsBtnRow = document.createElement('div');
    actionsBtnRow.className = 'admin-btn-row';
    actionsBtnRow.style.display = 'flex';
    actionsBtnRow.style.flexWrap = 'wrap';
    actionsBtnRow.style.gap = 'var(--space-xs)';
    actionsBtnRow.style.marginTop = 'var(--space-xs)';

    const resetProgressBtn = document.createElement('button');
    resetProgressBtn.type = 'button';
    resetProgressBtn.className = 'btn btn--primary btn--lg';
    resetProgressBtn.id = 'admin-reset-progress';
    resetProgressBtn.textContent = 'Reset Progress';
    actionsBtnRow.appendChild(resetProgressBtn);

    actionsSection.appendChild(actionsBtnRow);
    stage.appendChild(actionsSection);

    container.appendChild(stage);

    // Fetch and event handlers after DOM mount
    setTimeout(() => {
        const statusEl = document.getElementById('admin-auth-status');
        const listEl = document.getElementById('admin-submissions-list');
        const refreshEl = document.getElementById('admin-refresh-submissions');
        const resetEl = document.getElementById('admin-reset-progress');

        const setStatus = (msg, isError = false) => {
            if (statusEl) {
                statusEl.textContent = msg || '';
                statusEl.style.color = isError ? 'var(--color-dusty-pink)' : 'var(--color-pink-violet)';
            }
        };

        const updateBreakdown = (wishesCount, starsCount) => {
            const totalEl = document.getElementById('admin-breakdown-total');
            const wishVal = document.getElementById('admin-breakdown-wishes');
            const starVal = document.getElementById('admin-breakdown-stars');
            const lockedVal = document.getElementById('admin-breakdown-locked');
            const stageVal = document.getElementById('admin-breakdown-stage');

            if (totalEl) totalEl.textContent = `${wishesCount} ${wishesCount === 1 ? 'wish' : 'wishes'} · ${starsCount} ${starsCount === 1 ? 'star' : 'stars'}`;
            if (wishVal) wishVal.textContent = String(wishesCount);
            if (starVal) starVal.textContent = String(starsCount);

            const localState = (window.LittlePlanetStorage && typeof window.LittlePlanetStorage.loadState === 'function')
                ? window.LittlePlanetStorage.loadState() : null;
            if (lockedVal) lockedVal.textContent = (localState && localState.lockedWish) ? 'Yes' : 'No';
            if (stageVal) stageVal.textContent = (localState && localState.currentStage)
                ? String(localState.currentStage).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                : 'Birthday Reveal';
        };

        const deleteWishRecord = async (id) => {
            if (!confirm(`Are you sure you want to delete wish #${id}?`)) return;
            setStatus(`Deleting wish #${id}…`);
            try {
                const resp = await fetch(`${WISHES_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
                const data = await resp.json();
                if (resp.ok && data.ok) {
                    setStatus(`Wish #${id} deleted.`);
                    fetchSubmissions();
                } else {
                    setStatus(`Failed to delete wish #${id}.`, true);
                }
            } catch (e) {
                setStatus('Network error deleting wish.', true);
            }
        };

        const deleteStarRecord = async (id) => {
            if (!confirm(`Are you sure you want to delete star #${id}?`)) return;
            setStatus(`Deleting star #${id}…`);
            try {
                const resp = await fetch(`${STARS_API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
                const data = await resp.json();
                if (resp.ok && data.ok) {
                    setStatus(`Star #${id} deleted.`);
                    fetchSubmissions();
                } else {
                    setStatus(`Failed to delete star #${id}.`, true);
                }
            } catch (e) {
                setStatus('Network error deleting star.', true);
            }
        };

        const renderSubmissions = (wishes, stars) => {
            if (!listEl) return;
            listEl.innerHTML = '';

            const hasWishes = Array.isArray(wishes) && wishes.length > 0;
            const hasStars = Array.isArray(stars) && stars.length > 0;

            if (!hasWishes && !hasStars) {
                listEl.innerHTML = '<p class="admin-submissions-empty" style="color:var(--color-burgundy);opacity:0.8;">No submissions recorded yet.</p>';
                return;
            }

            const frag = document.createDocumentFragment();

            if (hasWishes) {
                wishes.forEach((w) => {
                    const row = document.createElement('div');
                    row.className = 'admin-submission admin-submission--wish';
                    row.style.background = 'var(--color-warm-cream)';
                    row.style.border = '1px solid var(--color-border-paper)';
                    row.style.borderRadius = 'var(--radius-lg)';
                    row.style.padding = 'var(--space-sm) var(--space-md)';
                    row.style.marginBottom = 'var(--space-xs)';
                    row.style.boxShadow = 'var(--shadow-xs)';

                    row.innerHTML = `
                        <div class="admin-submission__meta" style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-xs);margin-bottom:var(--space-3xs);flex-wrap:wrap;">
                            <span class="status-pill" style="font-size:0.65rem;padding:2px 10px;background:var(--color-dusty-pink);color:var(--color-burgundy);border-radius:var(--radius-full);">Wish ✨</span>
                            <span class="admin-submission__id" style="font-family:var(--font-sans);font-size:0.7rem;font-weight:700;color:var(--color-pink-violet);">#${escapeHtml(w.id)}</span>
                            <span class="admin-submission__time" style="font-family:var(--font-sans);font-size:0.7rem;color:var(--color-burgundy);opacity:0.75;">${escapeHtml(formatTimestamp(w.created_at))}</span>
                            <button type="button" class="btn btn--secondary btn--sm admin-delete-item-btn" style="padding:2px 8px;font-size:0.7rem;margin-left:auto;">Delete Wish</button>
                        </div>
                        <p class="admin-submission__text" style="font-family:var(--font-sans);font-size:var(--text-small-size);line-height:1.5;color:var(--color-burgundy);margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(w.wish)}</p>
                    `;

                    const delBtn = row.querySelector('.admin-delete-item-btn');
                    if (delBtn) {
                        delBtn.addEventListener('click', () => deleteWishRecord(w.id));
                    }
                    frag.appendChild(row);
                });
            }

            if (hasStars) {
                stars.forEach((s) => {
                    const row = document.createElement('div');
                    row.className = 'admin-submission admin-submission--star';
                    row.style.background = 'var(--color-warm-cream)';
                    row.style.border = '1px solid var(--color-border-paper)';
                    row.style.borderRadius = 'var(--radius-lg)';
                    row.style.padding = 'var(--space-sm) var(--space-md)';
                    row.style.marginBottom = 'var(--space-xs)';
                    row.style.boxShadow = 'var(--shadow-xs)';

                    row.innerHTML = `
                        <div class="admin-submission__meta" style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-xs);margin-bottom:var(--space-3xs);flex-wrap:wrap;">
                            <span class="status-pill" style="font-size:0.65rem;padding:2px 10px;background:var(--color-gold);color:var(--color-burgundy);border-radius:var(--radius-full);">Star 🌟</span>
                            <span class="admin-submission__id" style="font-family:var(--font-sans);font-size:0.7rem;font-weight:700;color:var(--color-pink-violet);">#${escapeHtml(s.id)}</span>
                            <span class="admin-submission__time" style="font-family:var(--font-sans);font-size:0.7rem;color:var(--color-burgundy);opacity:0.75;">${escapeHtml(formatTimestamp(s.created_at))}</span>
                            <button type="button" class="btn btn--secondary btn--sm admin-delete-item-btn" style="padding:2px 8px;font-size:0.7rem;margin-left:auto;">Delete Star</button>
                        </div>
                        <p class="admin-submission__text" style="font-family:var(--font-sans);font-size:var(--text-small-size);line-height:1.5;color:var(--color-burgundy);margin:0;white-space:pre-wrap;word-break:break-word;">${escapeHtml(s.message)}</p>
                    `;

                    const delBtn = row.querySelector('.admin-delete-item-btn');
                    if (delBtn) {
                        delBtn.addEventListener('click', () => deleteStarRecord(s.id));
                    }
                    frag.appendChild(row);
                });
            }

            listEl.appendChild(frag);
        };

        const fetchSubmissions = async () => {
            setStatus('Loading submissions…');
            try {
                const [wishesResp, starsResp] = await Promise.all([
                    fetch(WISHES_API, { method: 'GET' }),
                    fetch(STARS_API, { method: 'GET' }),
                ]);

                let wishes = [];
                let stars = [];

                if (wishesResp.ok) {
                    const wishesData = await wishesResp.json();
                    if (wishesData && wishesData.ok && Array.isArray(wishesData.wishes)) {
                        wishes = wishesData.wishes;
                    }
                }

                if (starsResp.ok) {
                    const starsData = await starsResp.json();
                    if (starsData && starsData.ok && Array.isArray(starsData.stars)) {
                        stars = starsData.stars;
                    }
                }

                renderSubmissions(wishes, stars);
                updateBreakdown(wishes.length, stars.length);
                setStatus('');
            } catch (err) {
                setStatus('Could not connect to the server.', true);
            }
        };

        if (resetEl) {
            resetEl.addEventListener('click', () => {
                if (confirm('Reset recipient progress back to the welcome stage? This clears active journey state but keeps all saved wishes and stars intact.')) {
                    if (window.LittlePlanetStorage) window.LittlePlanetStorage.resetProgress();
                    navigateTo(STAGES.STAGE_1);
                }
            });
        }

        if (refreshEl) {
            refreshEl.addEventListener('click', fetchSubmissions);
        }

        // Initial fetch on view render
        fetchSubmissions();
    }, 0);

    return app.PageContainer(container, 'page--cosmic');
};

// Main render function for /#miss-u-rumi secret route
const renderAdminPage = () => renderAdminContent();

// Register admin route
if (window.LittlePlanet) {
    window.LittlePlanet.registerStage('miss-u-rumi', renderAdminPage);

    if (window.location.hash.replace('#', '') === 'miss-u-rumi') {
        window.LittlePlanet.navigate('miss-u-rumi');
    }
}

// Expose on window for debugging
window.LittlePlanetAdmin = {
    renderAdminPage,
    renderAdminContent,
};
