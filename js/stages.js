/**
 * stages.js - The Little Planet
 * Stage 2 (Cake & Wish) and Stage 3 (The Little Planet) render functions.
 * Loaded after main.js; uses helpers exposed on window.LittlePlanet.
 */

(function () {
    'use strict';

    const app = window.LittlePlanet;
    if (!app) return;

    const { STAGES, registerStage, navigateTo, announceStatus, unlockStage, renderBackButton, confirmAction } = app;
    const prefersReducedMotion = app.prefersReducedMotion;
    const particleBurst = app.particleBurst;
    const PageContainer = app.PageContainer;
    const makeStarfield = app.makeStarfield;

    // Tiny shared helper: a single golden star particle drifting out.
    const spawnDriftStar = (container, x, y) => {
        const p = document.createElement('div');
        p.className = 'star-particle';
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.background = '#D4AF7F';
        container.appendChild(p);
        setTimeout(() => p.remove(), 1400);
    };

    // Client-side unique idempotency key (so repeated clicks / retries
    // never create a second database record).
    const newIdempotencyKey = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    };

    // --- Stage 2: Cake & Wish Implementation (rebuilt from scratch) ---
    const renderStage2 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-cake-wish';

        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_1));
        }

        const stage = document.createElement('div');
        stage.className = 'wish-stage';

        // Header text
        const header = document.createElement('div');
        header.className = 'wish-header';

        const title = document.createElement('h2');
        title.className = 'wish-title';
        title.textContent = 'Make a wish, Miruna! \u2728';

        const subtitle = document.createElement('p');
        subtitle.className = 'wish-subtitle';
        subtitle.textContent = 'Sixteen candles, one wish. Make it count!';

        // Instruction is HIDDEN until the wish is saved (Stage 1 → Stage 2).
        const instruction = document.createElement('p');
        instruction.className = 'wish-instruction is-hidden';
        instruction.textContent = 'Double-click the candles to blow them out \u2728';
        instruction.setAttribute('aria-hidden', 'true');

        header.appendChild(title);
        header.appendChild(subtitle);
        header.appendChild(instruction);

        // ---- Cake SVG with exactly 16 candles, every base flat on the frosting ----
        const cakeWrapper = document.createElement('div');
        // Locked by default: candle clicks are disabled until the wish is saved.
        cakeWrapper.className = 'wish-cake wish-cake--locked';

        // Back row (8) sits slightly higher, front row (8) lower — all on the
        // frosting surface. Candle bottom y = baseY; body extends UP from there.
        const backRow = [];
        const frontRow = [];
        for (let i = 0; i < 8; i++) {
            backRow.push(82 + i * 21);   // 82..227
            frontRow.push(90 + i * 19);  // 90..224
        }

        const candleColors = ['#D4AF7F', '#D7A3AD', '#F1E7DC', '#9B8CB8'];

        // backRowBase = 112, frontRowBase = 118 (frosting top edge)
        const buildCandle = (x, baseY, index, isBack) => {
            const color = candleColors[index % candleColors.length];
            const bodyH = isBack ? 14 : 16;
            const bodyW = isBack ? 4 : 5;
            const wickTop = baseY - bodyH - 4;
            return (
                '<g transform="translate(' + x + ', 0)">' +
                // Candle body: bottom edge lands exactly on baseY (the frosting)
                '<rect x="' + (-bodyW / 2) + '" y="' + (baseY - bodyH) + '" width="' + bodyW + '" height="' + bodyH + '" rx="2" fill="' + color + '" opacity="' + (isBack ? 0.9 : 1) + '"/>' +
                // Wick
                '<rect x="-0.75" y="' + wickTop + '" width="1.5" height="4" fill="#17151B"/>' +
                // Flame (no flicker animation — pure static vectors; hidden by .is-out)
                '<g class="wish-flame" aria-hidden="true">' +
                '<ellipse cx="0" cy="' + (wickTop - 3) + '" rx="3.5" ry="5.5" fill="url(#flameGlow)" opacity="0.55"/>' +
                '<path d="M0 ' + (wickTop - 10) + ' C 3 ' + (wickTop - 6) + ', 3 ' + wickTop + ', 0 ' + (wickTop + 1) + ' C -3 ' + wickTop + ', -3 ' + (wickTop - 6) + ', 0 ' + (wickTop - 10) + ' Z" fill="url(#flameGrad)"/>' +
                '<path d="M0 ' + (wickTop - 6) + ' C 1.5 ' + (wickTop - 3.5) + ', 1.5 ' + (wickTop - 1) + ', 0 ' + wickTop + ' C -1.5 ' + (wickTop - 1) + ', -1.5 ' + (wickTop - 3.5) + ', 0 ' + (wickTop - 6) + ' Z" fill="#FFF3D6" opacity="0.9"/>' +
                '</g>' +
                // Invisible tap target over the whole candle column
                '<rect class="wish-candle-hit" x="-8" y="' + (wickTop - 12) + '" width="16" height="' + (12 + bodyH + 4) + '" rx="4" role="button" tabindex="0" aria-label="Candle ' + (index + 1) + ' of 16"/>' +
                '</g>'
            );
        };

        // Back row sits slightly higher (base at y=112), front row lower (y=118),
        // so all 16 candle bases land exactly on the frosting top surface.
        let candlesSvg = '';
        backRow.forEach((x, i) => { candlesSvg += buildCandle(x, 112, i, true); });
        frontRow.forEach((x, i) => { candlesSvg += buildCandle(x, 118, i + 8, false); });

        const cakeSvgMarkup =
            '<svg class="wish-cake-svg" viewBox="0 0 310 260" xmlns="http://www.w3.org/2000/svg" ' +
            'role="group" aria-label="A two-tier cake with sixteen lit candles on the frosting, decorated with moons and stars.">' +
            '<defs>' +
            '<linearGradient id="cakeBaseGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#5A2F3B"/><stop offset="100%" stop-color="#482630"/>' +
            '</linearGradient>' +
            '<linearGradient id="cakeTopGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#6B3A48"/><stop offset="100%" stop-color="#482630"/>' +
            '</linearGradient>' +
            '<linearGradient id="frostingGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#F1E7DC"/><stop offset="100%" stop-color="#E8D8C8"/>' +
            '</linearGradient>' +
            '<radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">' +
            '<stop offset="0%" stop-color="#D4AF7F" stop-opacity="0.7"/>' +
            '<stop offset="100%" stop-color="#D4AF7F" stop-opacity="0"/>' +
            '</radialGradient>' +
            '<linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#F5D49A"/>' +
            '<stop offset="60%" stop-color="#D4AF7F"/>' +
            '<stop offset="100%" stop-color="#C99860"/>' +
            '</linearGradient>' +
            '<linearGradient id="plateGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#9B8CB8"/><stop offset="100%" stop-color="#7A6A98"/>' +
            '</linearGradient>' +
            '</defs>' +
            // Cake stand / plate
            '<ellipse cx="155" cy="244" rx="140" ry="14" fill="url(#plateGrad)" opacity="0.7"/>' +
            '<rect x="135" y="228" width="40" height="16" fill="#7A6A98" opacity="0.6"/>' +
            '<ellipse cx="155" cy="228" rx="120" ry="10" fill="#8C7CA8" opacity="0.55"/>' +
            // Bottom tier + scalloped frosting
            '<path d="M 45 228 L 45 185 Q 45 175 55 175 L 255 175 Q 265 175 265 185 L 265 228 Z" fill="url(#cakeBaseGrad)"/>' +
            '<path d="M 45 185 Q 45 175 55 175 L 255 175 Q 265 175 265 185' +
            ' L 265 195 Q 258 202 250 196 Q 242 205 232 197 Q 224 206 212 198' +
            ' Q 204 207 192 199 Q 184 206 172 198 Q 164 206 150 198' +
            ' Q 142 206 128 198 Q 120 205 108 197 Q 100 204 88 197' +
            ' Q 80 204 68 196 Q 60 202 52 195 Q 47 192 45 185 Z" fill="url(#frostingGrad)"/>' +
            '<circle cx="70" cy="210" r="2" fill="#D4AF7F"/>' +
            '<circle cx="100" cy="218" r="1.5" fill="#D7A3AD"/>' +
            '<circle cx="135" cy="208" r="2" fill="#F1E7DC"/>' +
            '<circle cx="170" cy="217" r="1.5" fill="#D4AF7F"/>' +
            '<circle cx="205" cy="208" r="2" fill="#D7A3AD"/>' +
            '<circle cx="240" cy="215" r="1.5" fill="#F1E7DC"/>' +
            // Top tier + scalloped frosting (top surface sits at y = 110)
            '<path d="M 75 175 L 75 118 Q 75 108 85 108 L 225 108 Q 235 108 235 118 L 235 175 Z" fill="url(#cakeTopGrad)"/>' +
            '<path d="M 75 118 Q 75 108 85 108 L 225 108 Q 235 108 235 118' +
            ' L 235 126 Q 228 132 220 127 Q 212 134 202 128 Q 194 135 182 129' +
            ' Q 174 134 162 128 Q 154 133 142 128 Q 134 133 122 128' +
            ' Q 114 133 104 127 Q 96 131 88 126 Q 81 129 75 118 Z" fill="url(#frostingGrad)"/>' +
            // The 16 candles (rendered after frosting so they sit on top of it)
            candlesSvg +
            '</svg>';

        cakeWrapper.innerHTML = cakeSvgMarkup;

        // ---- Step 1: "Make a wish ✨" prompt button ----
        const promptBtn = document.createElement('button');
        promptBtn.type = 'button';
        promptBtn.className = 'btn btn--primary wish-prompt-btn';
        promptBtn.textContent = 'Make a wish \u2728';

        // ---- Step 2: Wish form container (hidden initially) ----
        const wishForm = document.createElement('div');
        wishForm.className = 'wish-form is-hidden';
        wishForm.setAttribute('aria-hidden', 'true');

        const label = document.createElement('label');
        label.className = 'wish-label';
        label.setAttribute('for', 'wish-textarea');
        label.textContent = 'Your wish:';

        const wishTextarea = document.createElement('textarea');
        wishTextarea.id = 'wish-textarea';
        wishTextarea.className = 'wish-textarea';
        wishTextarea.placeholder = 'Your wish goes here...';
        wishTextarea.setAttribute('maxlength', '1000');
        wishTextarea.setAttribute('aria-describedby', 'wish-char-counter');

        const wishCharCounter = document.createElement('p');
        wishCharCounter.id = 'wish-char-counter';
        wishCharCounter.className = 'wish-char-counter';
        wishCharCounter.textContent = '0 / 1,000';
        wishCharCounter.setAttribute('aria-live', 'polite');

        const submitWishBtn = document.createElement('button');
        submitWishBtn.type = 'button';
        submitWishBtn.className = 'btn btn--primary wish-submit-btn';
        submitWishBtn.textContent = 'Save my wish \u2728';

        wishForm.appendChild(label);
        wishForm.appendChild(wishTextarea);
        wishForm.appendChild(wishCharCounter);
        wishForm.appendChild(submitWishBtn);

        // Wire Step 1 -> Step 2 transition
        promptBtn.addEventListener('click', () => {
            if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('medium');
            promptBtn.style.display = 'none';
            promptBtn.setAttribute('aria-hidden', 'true');
            wishForm.classList.remove('is-hidden');
            wishForm.setAttribute('aria-hidden', 'false');
            wishTextarea.focus();
            announceStatus('Make a wish text box revealed. Type your wish and save.');
        });

        // ---- Outcome card (hidden until the wish is submitted) ----
        const outcome = document.createElement('div');
        outcome.className = 'wish-outcome';
        outcome.setAttribute('aria-hidden', 'true');

        const outcomeCard = document.createElement('div');
        outcomeCard.className = 'wish-outcome-card';

        const outcomeTitle = document.createElement('h3');
        outcomeTitle.className = 'wish-outcome-title';
        outcomeTitle.textContent = 'Wish received! \uD83C\uDF0C';

        const outcomeLine1 = document.createElement('p');
        outcomeLine1.className = 'wish-outcome-line';
        outcomeLine1.textContent = 'The universe has been notified.';

        const outcomeLine2 = document.createElement('p');
        outcomeLine2.className = 'wish-outcome-line';
        outcomeLine2.textContent = 'Delivery time may vary. Results not guaranteed.';

        outcomeCard.appendChild(outcomeTitle);
        outcomeCard.appendChild(outcomeLine1);
        outcomeCard.appendChild(outcomeLine2);
        outcome.appendChild(outcomeCard);

        // Navigation to Page 3 — locked until the wish is submitted
        const openPresentBtn = document.createElement('button');
        openPresentBtn.type = 'button';
        openPresentBtn.className = 'btn btn--primary btn--locked';
        openPresentBtn.disabled = true;
        openPresentBtn.textContent = 'Open your present \u2192';
        openPresentBtn.addEventListener('click', () => {
            if (openPresentBtn.disabled) return;
            if (unlockStage) unlockStage(STAGES.STAGE_3);
            navigateTo(STAGES.STAGE_3);
        });
        outcome.appendChild(openPresentBtn);

        // ---- Interaction logic ----
        let candlesBlown = false;
        let wishSaved = false;

        const blowOutCandles = () => {
            if (candlesBlown) return;
            candlesBlown = true;

            // INSTANT blowout: all 16 flames removed in a single synchronous pass
            cakeWrapper.querySelectorAll('.wish-flame').forEach((flame) => {
                flame.classList.add('is-out');
                flame.parentNode.removeChild(flame);
            });

            // Particle burst from cake center
            const rect = cakeWrapper.getBoundingClientRect();
            particleBurst(cakeWrapper, rect.width / 2, rect.height / 2);

            announceStatus('Candles blown out! Wish received outcome revealed.');

            // Reveal outcome + unlock navigation to Page 3 ONLY NOW
            outcome.classList.add('is-visible');
            outcome.setAttribute('aria-hidden', 'false');
            openPresentBtn.classList.remove('btn--locked');
            openPresentBtn.disabled = false;
        };

        const saveWish = async () => {
            if (wishSaved) return;
            wishSaved = true;

            const typedWish = wishTextarea.value.trim();
            submitWishBtn.disabled = true;
            submitWishBtn.textContent = 'Saving\u2026';

            if (typedWish && typedWish.length <= 1000) {
                try {
                    await fetch('/api/wishes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: newIdempotencyKey(), wish: typedWish }),
                    });
                } catch (err) {
                    // Network failure must never block the UI update.
                }
            }

            // Lock the form and hide it cleanly
            wishForm.classList.add('is-hidden');
            wishForm.setAttribute('aria-hidden', 'true');
            wishTextarea.disabled = true;
            submitWishBtn.disabled = true;
            submitWishBtn.textContent = 'Wish saved \u2728';

            // UNLOCK candle interaction now (Stage 2).
            cakeWrapper.classList.remove('wish-cake--locked');
            instruction.classList.remove('is-hidden');
            instruction.setAttribute('aria-hidden', 'false');
            announceStatus('Wish saved. Double-click the candles to blow them out.');
        };

        wishTextarea.addEventListener('input', () => {
            wishCharCounter.textContent = wishTextarea.value.length + ' / 1,000';
        });

        // The single "Save my wish ✨" button:
        // saves the typed wish (best-effort) — does NOT blow out candles.
        submitWishBtn.addEventListener('click', async () => {
            if (wishSaved || submitWishBtn.disabled) return;
            const confirmed = await confirmAction(
                'Are you sure you want to lock this in? ✨',
                'Yes, lock it in ✨',
                'Cancel'
            );
            if (!confirmed) return;
            if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('medium');
            saveWish();
        });

        // Double-tap / double-click on any candle blows them out.
        // Candle hits are disabled while the cake is locked (Stage 1).
        cakeWrapper.querySelectorAll('.wish-candle-hit').forEach((hitEl) => {
            let lastTap = 0;
            hitEl.addEventListener('click', () => {
                if (candlesBlown) return;
                if (cakeWrapper.classList.contains('wish-cake--locked')) return;
                const now = Date.now();
                if (now - lastTap < 400) { blowOutCandles(); return; }
                lastTap = now;
            });
            hitEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (cakeWrapper.classList.contains('wish-cake--locked')) return;
                blowOutCandles();
            });
            hitEl.addEventListener('keydown', (e) => {
                if (candlesBlown) return;
                if (cakeWrapper.classList.contains('wish-cake--locked')) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    blowOutCandles();
                }
            });
        });

        // Assemble
        stage.appendChild(header);
        stage.appendChild(cakeWrapper);
        stage.appendChild(promptBtn);
        stage.appendChild(wishForm);
        stage.appendChild(outcome);

        container.appendChild(stage);

        return PageContainer(container, 'page--cosmic');
    };


    // --- Stage 3: The Little Planet Implementation ---
    const renderStage3 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-little-planet';

        container.appendChild(makeStarfield());

        // Universal back button — works on desktop and mobile so users can
        // step back to the previous stage seamlessly.
        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_2));
        }

        const stage = document.createElement('div');
        stage.className = 'planet-stage';

        // ---- Gift Box Interactive Area ----
        const giftArea = document.createElement('div');
        giftArea.className = 'gift-interactive-area';
        giftArea.setAttribute('role', 'button');
        giftArea.setAttribute('tabindex', '0');
        giftArea.setAttribute('aria-label', 'Tap the gift box to open your present.');
        giftArea.setAttribute('aria-live', 'polite');

        // Golden glow ring behind gift
        const glowRing = document.createElement('div');
        glowRing.className = 'gift-glow-ring';
        giftArea.appendChild(glowRing);

        // Little Planet illustration (hidden until opened)
        const planetWrapper = document.createElement('div');
        planetWrapper.className = 'planet-illustration-wrapper';
        planetWrapper.setAttribute('aria-hidden', 'true');

        const planetSvgMarkup = `
<svg class="planet-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="oceanGrad" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#C9A8C9"/>
      <stop offset="45%" stop-color="#A88B9E"/>
      <stop offset="100%" stop-color="#6B5B82"/>
    </radialGradient>
    <radialGradient id="atmosGrad" cx="50%" cy="50%" r="50%">
      <stop offset="85%" stop-color="rgba(215, 163, 173, 0)"/>
      <stop offset="95%" stop-color="rgba(215, 163, 173, 0.25)"/>
      <stop offset="100%" stop-color="rgba(215, 163, 173, 0.1)"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(215, 163, 173, 0.2)"/>
      <stop offset="30%" stop-color="rgba(215, 163, 173, 0.85)"/>
      <stop offset="50%" stop-color="rgba(241, 231, 220, 1)"/>
      <stop offset="70%" stop-color="rgba(215, 163, 173, 0.85)"/>
      <stop offset="100%" stop-color="rgba(215, 163, 173, 0.2)"/>
    </linearGradient>
    <radialGradient id="shadingGrad" cx="32%" cy="30%" r="80%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="45%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(23,21,27,0.35)"/>
    </radialGradient>
    <clipPath id="planetClip">
      <circle cx="110" cy="110" r="62"/>
    </clipPath>
  </defs>

  <!-- Atmosphere glow -->
  <circle cx="110" cy="110" r="72" fill="url(#atmosGrad)"/>

  <!-- Ring (back half, behind planet) -->
  <g class="planet-ring-back" opacity="0.8">
    <ellipse cx="110" cy="110" rx="100" ry="22" transform="rotate(-20 110 110)"
      fill="none" stroke="url(#ringGrad)" stroke-width="8" opacity="0.5"/>
    <ellipse cx="110" cy="110" rx="94" ry="18" transform="rotate(-20 110 110)"
      fill="none" stroke="url(#ringGrad)" stroke-width="3" opacity="0.35"/>
  </g>

  <!-- Planet body group (gentle floating motion) -->
  <g class="planet-body-group">
    <!-- Ocean sphere (pink-violet) -->
    <circle cx="110" cy="110" r="62" fill="url(#oceanGrad)"/>

    <!-- Continents (muted green) clipped to sphere -->
    <g clip-path="url(#planetClip)" fill="#6B8E6B" opacity="0.85">
      <path d="M 70 75 Q 78 65 92 68 Q 105 70 108 80 Q 110 90 102 96 Q 90 100 82 95 Q 72 88 70 75 Z"/>
      <path d="M 135 95 Q 148 92 155 102 Q 158 112 152 120 Q 142 125 135 118 Q 130 108 135 95 Z"/>
      <path d="M 75 125 Q 82 118 92 122 Q 100 128 96 138 Q 88 145 78 140 Q 72 132 75 125 Z"/>
      <ellipse cx="128" cy="78" rx="8" ry="5"/>
    </g>

    <!-- Surface shading (light from top-left) -->
    <circle cx="110" cy="110" r="62" fill="url(#shadingGrad)"/>

    <!-- Subtle surface highlight -->
    <ellipse cx="85" cy="85" rx="20" ry="14" fill="rgba(241, 231, 220, 0.15)" transform="rotate(-20 85 85)"/>

    <!-- Tiny moon -->
    <circle cx="178" cy="55" r="8" fill="#F1E7DC" opacity="0.9"/>
    <circle cx="175" cy="52" r="2" fill="#D7A3AD" opacity="0.5"/>
    <circle cx="181" cy="58" r="1.5" fill="#D7A3AD" opacity="0.4"/>
  </g>

  <!-- Ring (front half, in front of planet) -->
  <g class="planet-ring-front" opacity="0.95">
    <path d="M 15 100 Q 60 125, 110 130 Q 160 125, 205 100"
      fill="none" stroke="url(#ringGrad)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 22 105 Q 62 128, 110 133 Q 158 128, 198 105"
      fill="none" stroke="url(#ringGrad)" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
  </g>

  <!-- Sparkles around planet -->
  <circle cx="40" cy="60" r="2" fill="#D4AF7F"/>
  <circle cx="185" cy="150" r="1.5" fill="#D7A3AD"/>
  <circle cx="170" cy="45" r="1" fill="#F1E7DC"/>
</svg>`;

        planetWrapper.innerHTML = planetSvgMarkup;
        giftArea.appendChild(planetWrapper);

        // Gift Box SVG
        const giftSvgMarkup = `
<svg class="gift-svg" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="giftBoxGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5A2F3B"/>
      <stop offset="100%" stop-color="#482630"/>
    </linearGradient>
    <linearGradient id="giftLidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6B3A48"/>
      <stop offset="100%" stop-color="#482630"/>
    </linearGradient>
    <linearGradient id="ribbonGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8B8C0"/>
      <stop offset="100%" stop-color="#D7A3AD"/>
    </linearGradient>
    <radialGradient id="giftInnerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(241, 231, 220, 0.85)"/>
      <stop offset="100%" stop-color="rgba(215, 163, 173, 0)"/>
    </radialGradient>
  </defs>

  <!-- Box base — 100% opaque fills; fully hides the planet behind it -->
  <g class="gift-box-base" opacity="1">
    <rect x="30" y="80" width="120" height="80" rx="6" fill="url(#giftBoxGrad)"/>
    <!-- Box edge highlight (pre-blended solid hex — no alpha) -->
    <rect x="30" y="80" width="120" height="6" rx="3" fill="#69414B"/>
    <!-- Box front ribbon (vertical) — fully opaque -->
    <rect x="82" y="80" width="16" height="80" fill="url(#ribbonGrad)"/>
  </g>
  <!-- Light from inside the box (hidden until opened; a glow layer, not a box face) -->
  <ellipse cx="90" cy="82" rx="55" ry="18" fill="url(#giftInnerGlow)" class="gift-inner-glow" opacity="0"/>

  <!-- Lid group (animated) — 100% opaque fills -->
  <g class="gift-lid-group" opacity="1">
    <rect x="24" y="60" width="132" height="28" rx="6" fill="url(#giftLidGrad)"/>
    <!-- Lid ribbon stripe — fully opaque -->
    <rect x="82" y="60" width="16" height="28" fill="url(#ribbonGrad)"/>
    <!-- Lid top edge highlight (pre-blended solid hex — no alpha) -->
    <rect x="24" y="60" width="132" height="4" rx="2" fill="#7B4F5A"/>
  </g>

  <!-- Ribbon group (bow on top) -->
  <g class="gift-ribbon-group">
    <path d="M 90 60 Q 70 45 60 52 Q 55 58 65 62 Q 75 66 90 60 Z" fill="url(#ribbonGrad)"/>
    <path d="M 90 60 Q 110 45 120 52 Q 125 58 115 62 Q 105 66 90 60 Z" fill="url(#ribbonGrad)"/>
    <ellipse cx="90" cy="60" rx="5" ry="4" fill="#E8B8C0"/>
    <path d="M 65 62 Q 58 70 55 78" fill="none" stroke="url(#ribbonGrad)" stroke-width="4" stroke-linecap="round"/>
    <path d="M 115 62 Q 122 70 125 78" fill="none" stroke="url(#ribbonGrad)" stroke-width="4" stroke-linecap="round"/>
  </g>

  <!-- Floating sparkles around gift -->
  <circle cx="25" cy="45" r="2" fill="#D4AF7F" opacity="0.7">
    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="160" cy="40" r="1.5" fill="#D7A3AD" opacity="0.7">
    <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite"/>
  </circle>
  <circle cx="170" cy="90" r="1" fill="#F1E7DC" opacity="0.6">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
  </circle>
  <circle cx="15" cy="100" r="1.5" fill="#D4AF7F" opacity="0.6">
    <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite"/>
  </circle>
</svg>`;

        // Append the gift box SVG inside its own wrapper node.
        // (Using innerHTML += directly on giftArea would re-parse and destroy
        // the planetWrapper node appended above — a real DOM bug.)
        const giftSvgContainer = document.createElement('div');
        giftSvgContainer.className = 'gift-svg-container';
        giftSvgContainer.innerHTML = giftSvgMarkup;
        giftArea.appendChild(giftSvgContainer);

        // ---- Gift Text / Status Area ----
        const textArea = document.createElement('div');
        textArea.className = 'planet-text-area';

        // Mysterious hint (visible before opening)
        const hintText = document.createElement('p');
        hintText.className = 'gift-hint-text';
        hintText.textContent = 'Tap the gift box to open your present 🎁';

        // Stage 1 message
        const stage1Msg = document.createElement('p');
        stage1Msg.className = 'gift-hint-text';
        stage1Msg.textContent = "Something's inside… 👀";
        stage1Msg.style.display = 'none';

        // Planet reveal card (shown after stage 2)
        const revealCard = document.createElement('div');
        revealCard.className = 'planet-reveal-card';

        const revealHeadline = document.createElement('h2');
        revealHeadline.className = 'planet-headline';
        revealHeadline.textContent = 'Meet your Little Planet. 🪐';

        const revealSubline = document.createElement('p');
        revealSubline.className = 'planet-subline';
        revealSubline.textContent = 'A little world of its own.';

        const exploreBtn = document.createElement('button');
        exploreBtn.className = 'btn btn--primary';
        exploreBtn.textContent = "Let's explore →";
        exploreBtn.addEventListener('click', () => {
            if (exploreBtn.disabled) return;
            exploreBtn.disabled = true;
            exploreBtn.textContent = 'Exploring...';
            if (unlockStage) unlockStage(STAGES.STAGE_4);
            navigateTo(STAGES.STAGE_4);
        });

        revealCard.appendChild(revealHeadline);
        revealCard.appendChild(revealSubline);
        revealCard.appendChild(exploreBtn);

        textArea.appendChild(hintText);
        textArea.appendChild(stage1Msg);
        textArea.appendChild(revealCard);

        // ---- Gift Opening Logic (two-stage unmount) ----
        // Click 1: opens/loosens the ribbon and lid. Planet stays hidden.
        // Click 2: reveals the floating planet AND removes the gift box wrapper
        // from the DOM entirely so no leftover translucent frames remain.
        let giftOpened = false;
        let giftUnwrapped = false;

        const openGift = () => {
            if (giftOpened) return;
            if (!giftUnwrapped) {
                // STAGE 1: Unwrap/open the ribbon and lid
                giftUnwrapped = true;
                giftArea.classList.add('stage--unwrapped');
                stage1Msg.style.display = 'block';
                hintText.style.display = 'none';
                announceStatus('The ribbon is loose! Tap again to reveal your present.');
                return;
            }

            // STAGE 2: Reveal the planet and completely remove the gift box
            giftOpened = true;
            hintText.style.display = 'none';
            stage1Msg.style.display = 'none';

            // Completely unmount/remove the gift box SVG container from DOM.
            // This removes the box base, lid, ribbon, and all wrapper elements.
            const giftSvgContainer = giftArea.querySelector('.gift-svg-container');
            if (giftSvgContainer) giftSvgContainer.remove();

            // Strip the solid burgundy background so the planet floats cleanly.
            giftArea.classList.add('stage--opened');

            // Particle burst from where the box was
            const rect = giftArea.getBoundingClientRect();
            particleBurst(giftArea, rect.width / 2, rect.height / 2);

            // Show planet and reveal card
            stage.classList.add('is-revealed');
            setTimeout(() => {
                revealCard.classList.add('is-visible');
                announceStatus('Your Little Planet has appeared! A little world of its own.');
            }, prefersReducedMotion() ? 100 : 900);
        };

        // Wire up gift interactions
        giftArea.addEventListener('click', openGift);
        giftArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openGift();
            }
        });

        // Assemble stage
        stage.appendChild(giftArea);
        stage.appendChild(textArea);

        container.appendChild(stage);

        return PageContainer(container, 'page--cosmic');
    };

    // --- Stage 4: A Little Note for Rumi ---
    const renderStage4 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-little-note';

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_3));
        }

        const stage = document.createElement('div');
        stage.className = 'note-stage';

        // Title
        const title = document.createElement('h2');
        title.className = 'note-title';
        title.textContent = 'A Little Note for Rumi';

        // ---- Clean paper letter card (real, selectable HTML text) ----
        const letterCard = document.createElement('div');
        letterCard.className = 'letter-card';

        // Subtle golden sparkles around the letter card
        const sparkles = document.createElement('div');
        sparkles.className = 'note-sparkles';
        sparkles.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 9; i++) {
            const dot = document.createElement('span');
            dot.className = 'note-sparkle';
            dot.style.left = `${8 + Math.random() * 84}%`;
            dot.style.top = `${6 + Math.random() * 88}%`;
            dot.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
            dot.style.animationDuration = `${(2.4 + Math.random() * 2).toFixed(2)}s`;
            sparkles.appendChild(dot);
        }

        const letter = document.createElement('div');
        letter.setAttribute('role', 'document');
        letter.setAttribute('aria-label', 'A letter for Miruna');
        letter.innerHTML = `
    <p class="letter__greeting">Miruna, la mulţi ani!! ❤️</p>
    <p class="letter__line">16 already, damn 😭 Hope you have a really good birthday and that this year brings you lots of good things.</p>
    <p class="letter__line">I'm glad we got to talk again, and honestly, it's nice having you around again. We've had some pretty funny memories together, especially the mascara incident 💀 and I'm glad we have those memories.</p>
    <p class="letter__line">I hope we get to make some more, too. Anyway, I made you this little thing for your birthday, and I hope you like it. Have a good oneee 🫶</p>
    <div class="letter-heart-frame">
      <svg class="letter-heart-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="heartOuterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#D7A3AD"/>
            <stop offset="100%" stop-color="#B58496"/>
          </linearGradient>
          <linearGradient id="heartInnerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E8B4C0"/>
            <stop offset="100%" stop-color="#D7A3AD"/>
          </linearGradient>
        </defs>
        <path d="M100 160 C 40 110, 10 70, 10 40 C 10 18, 28 0, 50 0 C 70 0, 85 12, 100 32 C 115 12, 130 0, 150 0 C 172 0, 190 18, 190 40 C 190 70, 160 110, 100 160 Z" fill="url(#heartOuterGrad)"/>
        <path d="M100 142 C 52 100, 28 68, 28 44 C 28 28, 40 14, 56 14 C 71 14, 82 22, 100 38 C 118 22, 129 14, 144 14 C 160 14, 172 28, 172 44 C 172 68, 148 100, 100 142 Z" fill="url(#heartInnerGrad)"/>
      </svg>
    </div>
  `;

        letterCard.appendChild(sparkles);
        letterCard.appendChild(letter);

        // Continue button
        const exploreBtn = document.createElement('button');
        exploreBtn.type = 'button';
        exploreBtn.className = 'btn btn--primary';
        exploreBtn.textContent = 'Keep exploring →';
        exploreBtn.addEventListener('click', () => {
            if (exploreBtn.disabled) return;
            exploreBtn.disabled = true;
            exploreBtn.textContent = 'Exploring...';
            if (unlockStage) unlockStage(STAGES.STAGE_5);
            navigateTo(STAGES.STAGE_5);
        });

        stage.appendChild(title);
        stage.appendChild(letterCard);
        stage.appendChild(exploreBtn);
        container.appendChild(stage);

        return PageContainer(container, 'page--burgundy');
    };

    // --- Stage 5: The Rumi Lore™ (Scrapbook Cards) ---
    const renderStage5 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-rumi-lore';

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_4));
        }

        const stage = document.createElement('div');
        stage.className = 'scrapbook-stage';

        // Floating doodles layer behind cards
        const doodles = document.createElement('div');
        doodles.className = 'scrapbook-doodles';
        doodles.setAttribute('aria-hidden', 'true');
        const doodlePositions = [
            { cls: 'doodle-heart',  top: '8%',  left: '6%' },
            { cls: 'doodle-star',   top: '14%', right: '8%' },
            { cls: 'doodle-spiral', top: '82%', left: '5%' },
            { cls: 'doodle-sparkle', top: '88%', right: '7%' }
        ];
        doodlePositions.forEach(d => {
            const span = document.createElement('span');
            span.className = 'doodle ' + d.cls;
            span.style.top = d.top;
            if (d.right !== undefined) { span.style.left = 'auto'; span.style.right = d.right; }
            else { span.style.left = d.left; }
            doodles.appendChild(span);
        });

        const title = document.createElement('h2');
        title.className = 'scrapbook-title';
        title.textContent = 'The Rumi Lore™';

        const subtitle = document.createElement('p');
        subtitle.className = 'scrapbook-subtitle';
        subtitle.textContent = 'Tap a card to peek inside.';

        const cardsData = [
            {
                id: 'lore-1',
                emoji: '💇‍♀️',
                title: 'Hair Color Crisis™',
                tape: 'tape--pink',
                tilt: 'rotate(-2deg)',
                text: 'Remember when you were trying to decide between black and blonde bangs, and then you ended up choosing red hair instead? 😭 GIRL, HOW DID WE GET THERE 💀',
            },
            {
                id: 'lore-2',
                emoji: '💌',
                title: 'Online Boyfriend Era™',
                tape: 'tape--gold',
                tilt: 'rotate(1.5deg)',
                text: "Girl, remember when you'd get a new online boyfriend every few weeks? 😭💀 I swear there was always a new chapter to that story. HOW DID YOU KEEP UP WITH ALL OF IT 😭",
            },
            {
                id: 'lore-3',
                emoji: '📸',
                title: 'Character Development™',
                tape: 'tape--lavender',
                tilt: 'rotate(-1.5deg)',
                text: "It's actually funny how much you've changed over the years 😭 You went from not wanting people to take pictures of you to asking me for old pictures of you that I was literally never allowed to take in the first place 💀 GIRL, HOW WAS I SUPPOSED TO HAVE THEM 😭",
            }
        ];

        const readSet = new Set();

        const grid = document.createElement('div');
        grid.className = 'scrapbook-cards';

        const museumBtn = document.createElement('button');
        museumBtn.type = 'button';
        museumBtn.className = 'btn btn--primary btn--locked';
        museumBtn.disabled = true;
        museumBtn.textContent = 'Visit the museum →';

        museumBtn.addEventListener('click', () => {
            if (unlockStage) unlockStage(STAGES.STAGE_6);
            navigateTo(STAGES.STAGE_6);
        });

        const checkCompletion = () => {
            if (readSet.size >= cardsData.length) {
                museumBtn.classList.remove('btn--locked');
                museumBtn.disabled = false;
                announceStatus('All lore cards read! The museum is unlocked.');
            }
        };

        // Render each scrapbook card
        cardsData.forEach((item) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'lore-card';
            cardEl.style.setProperty('--card-tilt', item.tilt);
            cardEl.setAttribute('role', 'button');
            cardEl.setAttribute('tabindex', '0');
            cardEl.setAttribute('aria-label', `${item.title}. Tap to open.`);

            // Tape strip
            const tape = document.createElement('div');
            tape.className = 'lore-card__tape ' + item.tape;

            // Front side
            const front = document.createElement('div');
            front.className = 'lore-card__front';
            front.innerHTML = `
                <span class="lore-card__emoji">${item.emoji}</span>
                <span class="lore-card__title">${item.title}</span>
                <span class="lore-card__hint">tap to open</span>
            `;

            // Back side — inline expansion instead of modal popup
            const back = document.createElement('div');
            back.className = 'lore-card__back';
            back.innerHTML = `
                <span class="lore-card__back-title">${item.emoji} ${item.title}</span>
                <p class="lore-card__text">${item.text}</p>
            `;

            cardEl.appendChild(tape);
            cardEl.appendChild(front);
            cardEl.appendChild(back);

            const markRead = () => {
                readSet.add(item.id);
                cardEl.classList.add('is-read');
                checkCompletion();
            };

            cardEl.addEventListener('click', () => {
                if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('light');
                cardEl.classList.toggle('is-open');
                if (cardEl.classList.contains('is-open')) {
                    markRead();
                }
            });

            cardEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('light');
                    cardEl.classList.toggle('is-open');
                    if (cardEl.classList.contains('is-open')) {
                        markRead();
                    }
                }
            });

            grid.appendChild(cardEl);
        });

        stage.appendChild(doodles);
        stage.appendChild(title);
        stage.appendChild(subtitle);
        stage.appendChild(grid);
        stage.appendChild(museumBtn);
        container.appendChild(stage);

        return PageContainer(container, 'page--scrapbook');
    };

    // --- Stage 6: The Museum of Rumi™ (Exhibition Room) ---
    const renderStage6 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-museum';

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_5));
        }

        const stage = document.createElement('div');
        stage.className = 'museum-stage';

        const title = document.createElement('h2');
        title.className = 'museum-title';
        title.textContent = 'The Rumi Collection™';

        const counter = document.createElement('p');
        counter.className = 'museum-counter';
        counter.setAttribute('aria-live', 'polite');
        counter.textContent = '01/04';

        // Exhibit illustrations (stylized, self-contained SVGs)
        const illos = {
            mascara: `
<svg class="exhibit-illo exhibit-illo--mascara" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A mascara wand illustration">
  <defs>
    <linearGradient id="mascaraTubeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#482630"/>
      <stop offset="50%" stop-color="#6B3A48"/>
      <stop offset="100%" stop-color="#482630"/>
    </linearGradient>
  </defs>
  <!-- tube body -->
  <rect x="42" y="78" width="36" height="70" rx="10" fill="url(#mascaraTubeGrad)"/>
  <rect x="42" y="78" width="36" height="10" rx="5" fill="#D4AF7F" opacity="0.85"/>
  <!-- cap -->
  <rect x="48" y="62" width="24" height="18" rx="6" fill="#3A1F28"/>
  <!-- wand handle -->
  <rect x="56" y="30" width="8" height="34" rx="4" fill="#3A1F28"/>
  <!-- bristles -->
  <rect x="52" y="10" width="16" height="24" rx="8" fill="#17151B"/>
  <g stroke="#17151B" stroke-width="2" stroke-linecap="round">
    <line x1="54" y1="14" x2="54" y2="30"/>
    <line x1="58" y1="12" x2="58" y2="32"/>
    <line x1="62" y1="12" x2="62" y2="32"/>
    <line x1="66" y1="14" x2="66" y2="30"/>
  </g>
  <!-- little star accent -->
  <path d="M92 40 l1.6 4 4 .5 -3 2.7 .8 4 -3.4-2.1 -3.4 2.1 .8-4 -3-2.7 4-.5 Z" fill="#D4AF7F" opacity="0.9"/>
</svg>`,
            swing: `
<svg class="exhibit-illo exhibit-illo--swing" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A giant round woven rope swing in a park">
  <defs>
    <radialGradient id="weaveGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#C9A8C9"/>
      <stop offset="100%" stop-color="#A88B9E"/>
    </radialGradient>
  </defs>
  <!-- tree branches -->
  <path d="M18 20 Q 60 34 80 44 Q 100 34 142 20" fill="none" stroke="#6B8E6B" stroke-width="7" stroke-linecap="round"/>
  <path d="M80 44 L 80 58" stroke="#6B8E6B" stroke-width="5" stroke-linecap="round"/>
  <!-- ropes -->
  <g stroke="#D4AF7F" stroke-width="3" fill="none" stroke-dasharray="1 3">
    <path d="M62 46 Q 58 78 60 104"/>
    <path d="M98 46 Q 102 78 100 104"/>
    <path d="M80 58 L 80 104"/>
  </g>
  <!-- woven round seat: concentric woven rings + cross weave -->
  <g transform="translate(80 112)">
    <ellipse cx="0" cy="0" rx="46" ry="16" fill="url(#weaveGrad)"/>
    <ellipse cx="0" cy="-2" rx="46" ry="16" fill="none" stroke="#B57684" stroke-width="2"/>
    <ellipse cx="0" cy="-2" rx="34" ry="11.5" fill="none" stroke="#B57684" stroke-width="2" opacity="0.85"/>
    <ellipse cx="0" cy="-2" rx="22" ry="7.5" fill="none" stroke="#B57684" stroke-width="2" opacity="0.7"/>
    <ellipse cx="0" cy="-2" rx="11" ry="4" fill="none" stroke="#B57684" stroke-width="2" opacity="0.55"/>
    <!-- weave strands -->
    <g stroke="#8C7CA8" stroke-width="2" opacity="0.55" fill="none">
      <path d="M-44 -4 Q -30 -14 -16 -6 Q -4 -14 8 -6 Q 20 -14 34 -6 Q 42 -12 44 -4"/>
      <path d="M-36 2 Q -22 -8 -8 0 Q 6 -8 20 0 Q 32 -8 36 2"/>
    </g>
  </g>
  <!-- ground -->
  <ellipse cx="80" cy="148" rx="64" ry="7" fill="#6B8E6B" opacity="0.35"/>
</svg>`,
            football: `
<svg class="exhibit-illo exhibit-illo--football" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A football illustration">
  <defs>
    <radialGradient id="ballGrad" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#F1E7DC"/>
      <stop offset="100%" stop-color="#D8CBBB"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="42" fill="url(#ballGrad)" stroke="#482630" stroke-width="3"/>
  <path d="M60 44 L76 54 L70 72 L50 72 L44 54 Z" fill="#482630"/>
  <g fill="none" stroke="#482630" stroke-width="2.5" stroke-linecap="round">
    <path d="M60 44 L60 18"/>
    <path d="M76 54 L98 44"/>
    <path d="M70 72 L84 94"/>
    <path d="M50 72 L36 94"/>
    <path d="M44 54 L22 44"/>
  </g>
</svg>`,
            dog: `
<svg class="exhibit-illo exhibit-illo--dog" viewBox="0 0 140 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A friendly front-facing puppy illustration">
  <defs>
    <radialGradient id="dogGrad" cx="45%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#F0C9A8"/>
      <stop offset="100%" stop-color="#D9A878"/>
    </radialGradient>
    <radialGradient id="earGrad" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#D4A070"/>
      <stop offset="100%" stop-color="#C09060"/>
    </radialGradient>
    <radialGradient id="eyeGrad" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#2A1A12"/>
      <stop offset="100%" stop-color="#1A0F0A"/>
    </radialGradient>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F0C9A8"/>
      <stop offset="100%" stop-color="#D9A878"/>
    </linearGradient>
  </defs>

  <!-- ground shadow -->
  <ellipse cx="70" cy="115" rx="44" ry="5" fill="#C89A6A" opacity="0.25"/>

  <!-- body (sitting) -->
  <path d="M46 74 Q46 58 70 58 Q94 58 94 74 L94 110 Q94 114 90 114 L50 114 Q46 114 46 110 Z" fill="url(#bodyGrad)"/>

  <!-- left hind leg -->
  <ellipse cx="52" cy="98" rx="12" ry="17" fill="#D4A070"/>

  <!-- right hind leg -->
  <ellipse cx="88" cy="98" rx="12" ry="17" fill="#D4A070"/>

  <!-- left front leg -->
  <path d="M57 98 Q54 112 57 114 L67 114 Q70 112 67 98 Z" fill="url(#bodyGrad)"/>

  <!-- right front leg -->
  <path d="M73 98 Q76 112 73 114 L83 114 Q86 112 83 98 Z" fill="url(#bodyGrad)"/>

  <!-- HEAD GROUP (animated as a whole) -->
  <g class="bella-head">
    <!-- EARS drawn first so the head circle naturally clips their upper attachment -->
    <!-- left ear (floppy) -- hangs down and flares outward from the crown -->
    <ellipse cx="44" cy="36" rx="11" ry="27" fill="url(#earGrad)" transform="rotate(-50 44 36)"/>

    <!-- right ear (floppy) -- hangs down and flares outward from the crown -->
    <ellipse cx="96" cy="36" rx="11" ry="27" fill="url(#earGrad)" transform="rotate(50 96 36)"/>

    <!-- head -->
    <circle cx="70" cy="50" r="32" fill="url(#dogGrad)"/>

    <!-- left eye -->
    <circle cx="57" cy="47" r="5.5" fill="url(#eyeGrad)"/>
    <circle cx="58.5" cy="45.5" r="2" fill="#FFFFFF"/>

    <!-- right eye -->
    <circle cx="83" cy="47" r="5.5" fill="url(#eyeGrad)"/>
    <circle cx="84.5" cy="45.5" r="2" fill="#FFFFFF"/>

    <!-- nose -->
    <ellipse cx="70" cy="60" rx="5" ry="4" fill="#2A1A12"/>

    <!-- mouth -->
    <path d="M64 64 Q70 69 76 64" stroke="#2A1A12" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>
</svg>`,
        };

        const pawPrints = `
<span class="paw" style="left:8%; top:64%" aria-hidden="true">🐾</span>
<span class="paw" style="left:20%; top:78%" aria-hidden="true">🐾</span>
<span class="paw" style="left:32%; top:68%" aria-hidden="true">🐾</span>`;

        const exhibits = [
            {
                id: 'exhibit-1',
                num: '01/04',
                tag: 'EXHIBIT #01 — MASCARA INCIDENT',
                title: 'Mascara Incident™ 💄',
                text: 'Remember that one time you and Miriam put mascara on my eyelashes? 😭 I had to wash it all off afterward, and somehow the whole thing turned into a moment that had us laughing. 💀',
                classification: 'Unnecessary chaos. Excellent entertainment.',
                icon: '💄',
                illo: illos.mascara
            },
            {
                id: 'exhibit-2',
                num: '02/04',
                tag: 'EXHIBIT #02 — CONVERSATION HEADQUARTERS',
                title: 'Spider-Web Swing 🕸️',
                text: 'That giant spider-web swing where we\'d sit, talk, and spend time together. So many conversations happened there that the swing deserves an honorary place in the museum. 😭',
                classification: 'Official conversation headquarters.',
                icon: '🕷️',
                illo: illos.swing
            },
            {
                id: 'exhibit-3',
                num: '03/04',
                tag: 'EXHIBIT #03 — PĂTRĂȚICA',
                title: 'Pătrățica Football ⚽',
                text: 'All those times we used to play pătrățica. Just a ball, a game, and another little piece of our childhood that deserves to be remembered. ⚽',
                classification: 'Childhood entertainment. Competitive behaviour under investigation.',
                icon: '⚽',
                illo: illos.football
            },
            {
                id: 'exhibit-4',
                num: '04/04',
                tag: 'EXHIBIT #04 — BELLA COLLECTION',
                title: 'Bella the DOG 🐶',
                text: 'Remember all those times I brought Bella along and we\'d spend time with her together? 🥺❤️ Bella deserves her own spot in the museum for all the times she was part of our little moments together.',
                classification: 'Good girl. Certified memory maker.',
                icon: '🐶',
                illo: illos.dog,
                stamp: '10/10 good girl 🐶'
            }
        ];

        let currentIndex = 0;
        const visitedSet = new Set([0]);

        const caseEl = document.createElement('div');
        caseEl.className = 'museum-room';
        caseEl.setAttribute('role', 'region');
        caseEl.setAttribute('aria-label', 'Museum exhibit card');

        // No translucent overlay beams or glow divs — clean museum view

        const tagEl = document.createElement('span');
        tagEl.className = 'museum-tag';

        const iconEl = document.createElement('span');
        iconEl.className = 'museum-icon';

        const exTitle = document.createElement('h3');
        exTitle.className = 'museum-exhibit-title';

        const exText = document.createElement('p');
        exText.className = 'museum-exhibit-text';

        // Illustration container — floats cleanly inside the card with no
        // awkward cylinder stands underneath it.
        const illoEl = document.createElement('div');
        illoEl.className = 'museum-illo-container';
        illoEl.setAttribute('aria-hidden', 'true');

        const classEl = document.createElement('p');
        classEl.className = 'museum-exhibit-class';

        const stampEl = document.createElement('span');
        stampEl.className = 'museum-stamp';
        stampEl.setAttribute('aria-hidden', 'true');

        // "10/10 good girl" speech-bubble tag — compact bubble positioned
        // above the puppy's head with a dynamic editorial tilt.
        stampEl.style.position = 'absolute';
        stampEl.style.right = '-12px';
        stampEl.style.top = '-10px';
        stampEl.style.zIndex = '6';
        stampEl.style.transform = 'rotate(15deg)';
        illoEl.appendChild(stampEl);

        caseEl.appendChild(tagEl);
        caseEl.appendChild(iconEl);
        caseEl.appendChild(illoEl);
        caseEl.appendChild(exTitle);
        caseEl.appendChild(exText);
        caseEl.appendChild(classEl);

        const starsBtn = document.createElement('button');
        starsBtn.type = 'button';
        starsBtn.className = 'btn btn--primary btn--locked';
        starsBtn.disabled = true;
        starsBtn.textContent = 'Follow the stars →';

        starsBtn.addEventListener('click', () => {
            if (starsBtn.disabled) return;
            starsBtn.disabled = true;
            starsBtn.textContent = 'Following...';
            if (unlockStage) unlockStage(STAGES.STAGE_7);
            navigateTo(STAGES.STAGE_7);
        });

        const updateExhibit = (index) => {
            currentIndex = index;
            visitedSet.add(index);

            const ex = exhibits[currentIndex];
            counter.textContent = ex.num;
            tagEl.textContent = ex.tag;
            iconEl.textContent = ex.icon;
            exTitle.textContent = ex.title;
            exText.textContent = ex.text;
            classEl.textContent = ex.classification || '';

            // Render the 2D-facing exhibit illustration inside its container.
            if (ex.illo) {
                illoEl.innerHTML = (ex.id === 'exhibit-4' ? pawPrints : '') + ex.illo;
            } else {
                illoEl.innerHTML = '';
            }

            // Re-attach the Bella stamp next to the illustration
            if (ex.stamp) {
                stampEl.textContent = ex.stamp;
                stampEl.style.display = 'inline-flex';
                illoEl.appendChild(stampEl);
            } else {
                stampEl.style.display = 'none';
            }

            // Unlock 'Follow the stars →' once user has reached Bella (04/04) or visited all
            if (visitedSet.size >= exhibits.length || currentIndex === 3) {
                starsBtn.classList.remove('btn--locked');
                starsBtn.disabled = false;
            }

            // Rebuild pagination dots so the active indicator tracks the
            // current exhibit (buildDots is only called once at init otherwise).
            buildDots();
        };

        const controls = document.createElement('div');
        controls.className = 'museum-controls';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'btn btn--secondary museum-nav';
        prevBtn.setAttribute('aria-label', 'Previous exhibit');
        prevBtn.textContent = '←';

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn--secondary museum-nav';
        nextBtn.setAttribute('aria-label', 'Next exhibit');
        nextBtn.textContent = '→';

        const dots = document.createElement('div');
        dots.className = 'museum-dots';
        dots.setAttribute('role', 'tablist');
        dots.setAttribute('aria-label', 'Exhibit position');

        const buildDots = () => {
            dots.innerHTML = '';
            exhibits.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'museum-dot' + (i === currentIndex ? ' is-active' : '');
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', 'Exhibit ' + (i + 1));
                dot.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false');
                dot.addEventListener('click', () => {
                    updateExhibit(i);
                });
                dots.appendChild(dot);
            });
        };

        const goPrev = () => {
            if (currentIndex > 0) {
                if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('light');
                updateExhibit(currentIndex - 1);
            }
        };

        const goNext = () => {
            if (currentIndex < exhibits.length - 1) {
                if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('light');
                updateExhibit(currentIndex + 1);
            }
        };

        prevBtn.addEventListener('click', goPrev);
        nextBtn.addEventListener('click', goNext);
        stage.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        });

        // Touch swipe support for museum carousel
        let touchStartX = 0;
        caseEl.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].clientX;
        }, { passive: true });
        caseEl.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) { // minimum swipe distance
                if (diff > 0) goNext();
                else goPrev();
            }
        }, { passive: true });

        // Single tap exhibit card interaction
        caseEl.addEventListener('click', () => {
            if (currentIndex < exhibits.length - 1) {
                updateExhibit(currentIndex + 1);
            }
        });

        controls.appendChild(prevBtn);
        controls.appendChild(dots);
        controls.appendChild(nextBtn);

        stage.appendChild(title);
        stage.appendChild(counter);
        stage.appendChild(caseEl);
        stage.appendChild(controls);
        stage.appendChild(starsBtn);
        container.appendChild(stage);

        buildDots();
        updateExhibit(0);

        return PageContainer(container, 'page--burgundy');
    };

    // --- Stub/Placeholder Stage 7 - 10 Renderers to prevent routing breaks ---
    const renderStageGeneric = (titleText, stageNum, prevStage, nextStage) => {
        const container = document.createElement('div');
        container.className = 'stage-content';
        container.appendChild(makeStarfield());

        if (renderBackButton && prevStage) {
            container.appendChild(renderBackButton(prevStage));
        }

        const stage = document.createElement('div');
        stage.style.textAlign = 'center';
        stage.style.padding = '2rem 1rem';

        const title = document.createElement('h2');
        title.style.fontFamily = 'var(--font-serif)';
        title.style.color = 'var(--color-burgundy-bright)';
        title.textContent = titleText;

        const msg = document.createElement('p');
        msg.style.color = 'var(--color-pink-violet)';
        msg.style.marginTop = '1rem';
        msg.textContent = `Stage ${stageNum} — Coming Soon! ✨`;

        stage.appendChild(title);
        stage.appendChild(msg);

        if (nextStage) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn--primary';
            nextBtn.style.marginTop = '2rem';
            nextBtn.textContent = 'Continue →';
            nextBtn.addEventListener('click', () => {
                if (unlockStage) unlockStage(nextStage);
                navigateTo(nextStage);
            });
            stage.appendChild(nextBtn);
        }

        container.appendChild(stage);
        return PageContainer(container, 'page--cosmic');
    };

    const renderStage7 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content';
        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_6));
        }

        const stage = document.createElement('div');
        stage.className = 'libra-stage';

        const title = document.createElement('h2');
        title.className = 'storybook-heading';
        title.style.color = '#FFF8E7';
        title.textContent = 'The Libra Constellation ✨';

        const subtitle = document.createElement('p');
        subtitle.className = 'body-text';
        subtitle.style.color = 'var(--color-warm-cream)';
        subtitle.textContent = "Every star has its place. Let's connect them.";

        // Constellation label
        const constellationLabel = document.createElement('p');
        constellationLabel.className = 'libra-constellation-label';
        constellationLabel.textContent = 'LIBRA';

        const instruction = document.createElement('p');
        instruction.className = 'libra-instruction';
        instruction.textContent = 'Tap star 1, then tap star 2, then star 3… follow the numbers to draw the constellation.';

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'libra-canvas-container';

        // 6-star Libra constellation layout matching reference photo
        // Reordered for a single "constant moving" path (1 -> 6)
        const starsData = [
            { id: 0, x: 64, y: 74, number: 1, name: 'Zubenelgenubi' },
            { id: 1, x: 78, y: 35, number: 2, name: 'Zubeneschamali' },
            { id: 2, x: 52, y: 8,  number: 3, name: 'Zubenelhakrabi' },
            { id: 3, x: 33, y: 28, number: 4, name: 'Tau Librae' },
            { id: 4, x: 32, y: 86, number: 5, name: 'Sigma Librae' },
            { id: 5, x: 30, y: 95, number: 6, name: 'Upsilon Librae' }
        ];

        // Sequence: 1->2->3->4->5->6, then crossbar 2->4 to close the shape
        const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 3]];
        let completedConnections = [];
        let nextConnectionIndex = 0;
        let activeAnchor = null;
        let isCompleted = false;

        // Drag / free-draw state (declared here so stopDrag() can reference them)
        let isDragging = false;
        let startStar = null;
        let activeTrailPoints = [];

        const lineLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lineLayer.setAttribute('class', 'libra-line-layer');
        lineLayer.setAttribute('viewBox', '0 0 100 100');
        lineLayer.setAttribute('preserveAspectRatio', 'none');
        lineLayer.style.pointerEvents = 'none';
        canvasContainer.appendChild(lineLayer);

        // Active drag trail (free-drawing polyline)
        const activeTrail = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        activeTrail.setAttribute('class', 'active-trail');
        activeTrail.setAttribute('fill', 'none');
        activeTrail.style.display = 'none';
        lineLayer.appendChild(activeTrail);
        activeTrail.style.display = 'none';

        const stars = [];
        starsData.forEach(data => {
            const star = document.createElement('div');
            star.className = 'libra-star';
            star.style.left = `${data.x}%`;
            star.style.top = `${data.y}%`;
            star.dataset.id = data.id;

            const num = document.createElement('span');
            num.className = 'libra-star__number';
            num.textContent = data.number;
            star.appendChild(num);

            // Tap-to-connect: each star listens for click
            star.addEventListener('click', (e) => onStarClick(data, e));

            canvasContainer.appendChild(star);
            stars.push(star);
        });

        const flashInvalid = (starData) => {
            const star = stars[starData.id];
            if (!star) return;
            star.classList.add('is-active');
            star.style.boxShadow = '0 0 0 3px rgba(212, 175, 127, 0.7)';
            setTimeout(() => {
                star.classList.remove('is-active');
                star.style.boxShadow = '';
            }, 350);
        };

        const onStarClick = (starData, e) => {
            e.preventDefault();
            e.stopPropagation();

            // If no anchor yet
            if (activeAnchor === null) {
                // Normal phase: must start from star 1
                if (nextConnectionIndex < connections.length - 1) {
                    if (starData.id !== connections[0][0]) {
                        flashInvalid(starData);
                        return;
                    }
                } else {
                    // Crossbar phase: accept either endpoint (star 2 or star 4)
                    const expected = connections[nextConnectionIndex];
                    if (starData.id !== expected[0] && starData.id !== expected[1]) {
                        flashInvalid(starData);
                        return;
                    }
                }
                if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('light');
                activeAnchor = starData;
                stars[starData.id].classList.add('is-active');
                return;
            }

            // Try to connect activeAnchor → tapped star
            tryConnect(activeAnchor, starData);
        };

        const tryConnect = (s1, s2) => {
            if (nextConnectionIndex >= connections.length) return;

            const expected = connections[nextConnectionIndex];
            const isForward = (expected[0] === s1.id && expected[1] === s2.id);
            const isBackward = (expected[0] === s2.id && expected[1] === s1.id);

            if (!isForward && !isBackward) {
                flashInvalid(s2);
                return;
            }

            const connId = expected.join('-');
            if (completedConnections.includes(connId)) return;

            completedConnections.push(connId);
            renderFixedLine(s1, s2);
            particleBurst(canvasContainer, (s2.x / 100) * canvasContainer.offsetWidth, (s2.y / 100) * canvasContainer.offsetHeight);
            announceStatus(`Connected ${s1.name} and ${s2.name}!`);
            if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('medium');

            // Clear previous active state, mark the new anchor
            stars.forEach(s => s.classList.remove('is-active'));
            nextConnectionIndex++;

            // Final crossbar (star 2 → star 4) completed the constellation
            if (nextConnectionIndex === connections.length) {
                activeAnchor = null;
                onComplete();
                return;
            }

            // Main 1→6 path is now complete — prompt for the closing crossbar
            if (nextConnectionIndex === connections.length - 1) {
                instruction.textContent = 'Now connect star 2 to star 4 to complete the constellation!';
                activeAnchor = null;
                return;
            }

            // Continue from the newly reached star
            activeAnchor = s2;
            stars[s2.id].classList.add('is-active');
        };

        const renderFixedLine = (s1, s2) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', s1.x);
            line.setAttribute('y1', s1.y);
            line.setAttribute('x2', s2.x);
            line.setAttribute('y2', s2.y);
            line.setAttribute('class', 'locked-line');

            // Progressive organic trace line animation
            const len = Math.hypot(s2.x - s1.x, s2.y - s1.y);
            line.style.strokeDasharray = `${len}`;
            line.style.strokeDashoffset = `${len}`;

            lineLayer.appendChild(line);

            requestAnimationFrame(() => {
                line.style.transition = 'stroke-dashoffset 0.45s cubic-bezier(0.33, 1, 0.68, 1)';
                line.style.strokeDashoffset = '0';
            });

            stars[s1.id].classList.add('is-connected');
            stars[s2.id].classList.add('is-connected');
        };

        const stopDrag = () => {
            isDragging = false;
            startStar = null;
            activeTrailPoints = [];
            stars.forEach(s => s.classList.remove('is-active'));
            activeTrail.style.display = 'none';
        };

        const showCompletion = () => {
            // Prevent duplicate outcome cards if triggered more than once
            if (stage.querySelector('.libra-outcome')) return;

            canvasContainer.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
            canvasContainer.style.boxShadow = '0 0 60px rgba(212, 175, 127, 0.6), 0 0 120px rgba(215, 163, 173, 0.3)';
            setTimeout(() => { canvasContainer.style.boxShadow = ''; }, 600);

            for (let i = 0; i < 40; i++) {
                setTimeout(() => {
                    particleBurst(canvasContainer, Math.random() * canvasContainer.offsetWidth, Math.random() * canvasContainer.offsetHeight);
                }, i * 30);
            }

            const outcome = document.createElement('div');
            outcome.className = 'libra-outcome is-visible';

            const msg1 = document.createElement('p');
            msg1.className = 'body-text';
            msg1.style.fontFamily = 'var(--font-serif)';
            msg1.style.fontSize = '1.4rem';
            msg1.style.color = 'var(--color-gold)';
            msg1.textContent = 'There it is. ✨';

            const msg2 = document.createElement('p');
            msg2.className = 'body-text';
            msg2.style.marginBottom = 'var(--space-md)';
            msg2.textContent = 'A little constellation, brought together one star at a time.';

            const card = document.createElement('div');
            card.className = 'libra-facts-card';

            const cardTitle = document.createElement('h3');
            cardTitle.className = 'libra-facts-card__title';
            cardTitle.textContent = '✨ Libra ✨';
            card.appendChild(cardTitle);

            const facts = [
                { icon: '👑', text: 'Aesthetic Royalty: Known for effortless beauty, immaculate style, and always having the absolute best aesthetic.' },
                { icon: '🤝', text: 'The Ultimate Peacekeeper: Naturally charming, diplomatic, and brings unmatched good energy wherever they go.' },
                { icon: '✨', text: 'Flawless Vibe: Radiates effortless grace and magnetic social energy.' }
            ];

            facts.forEach(f => {
                const factEl = document.createElement('div');
                factEl.className = 'libra-fact';
                factEl.innerHTML = `<span class="libra-fact__icon">${f.icon}</span><span>${f.text}</span>`;
                card.appendChild(factEl);
            });

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn--primary';
            nextBtn.textContent = 'Keep exploring →';
            nextBtn.addEventListener('click', () => {
                if (unlockStage) unlockStage(STAGES.STAGE_8);
                navigateTo(STAGES.STAGE_8);
            });

            outcome.appendChild(msg1);
            outcome.appendChild(msg2);
            outcome.appendChild(card);
            outcome.appendChild(nextBtn);
            stage.appendChild(outcome);

            // Mark the page as completed to disable canvas interactions and allow scrolling
            page.classList.add('is-completed');

            // Bring the completion card into view (Stage 7 page is scrollable)
            setTimeout(() => {
                outcome.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 250);
        };

        const onComplete = () => {
            // Guard: never run the completion flow twice
            if (isCompleted) return;
            isCompleted = true;

            instruction.style.display = 'none';
            // Hide star numbers so the finished constellation lines are unobstructed
            stars.forEach(s => {
                const num = s.querySelector('.libra-star__number');
                if (num) num.style.display = 'none';
            });
            showCompletion();
        };

        // Window listeners removed; pointer capture handles dragging on canvas container

        const controls = document.createElement('div');
        controls.className = 'libra-controls';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn--secondary';
        resetBtn.textContent = 'Reset';
        resetBtn.addEventListener('click', () => {
            if (autoDrawTimer) { clearTimeout(autoDrawTimer); autoDrawTimer = null; }
            completedConnections = [];
            nextConnectionIndex = 0;
            activeAnchor = null;
            isCompleted = false;
            lineLayer.querySelectorAll('.locked-line').forEach(l => l.remove());
            stars.forEach(s => {
                s.classList.remove('is-connected', 'is-active');
                // Re-show star numbers so the puzzle is playable again
                const num = s.querySelector('.libra-star__number');
                if (num) num.style.display = '';
            });
            // Remove all outcome cards (in case duplicates slipped in)
            stage.querySelectorAll('.libra-outcome').forEach(o => o.remove());
            // Lift the completed-page lock so the canvas accepts input again
            page.classList.remove('is-completed');
            instruction.style.display = 'block';
            instruction.textContent = 'Tap star 1, then tap star 2, then star 3… follow the numbers to draw the constellation.';
            lineLayer.style.filter = 'none';
            // Re-enable the Auto draw button and restore its label
            skipBtn.disabled = false;
            skipBtn.textContent = 'Auto draw';
        });

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn btn--ghost';
        skipBtn.style.color = 'var(--color-pink-violet)';
        skipBtn.textContent = 'Auto draw';
        let autoDrawTimer = null;
        skipBtn.addEventListener('click', () => {
            if (skipBtn.disabled) return;
            // If the puzzle is already completed, don't re-run the flow
            if (isCompleted || nextConnectionIndex >= connections.length) return;
            skipBtn.disabled = true;
            skipBtn.textContent = 'Drawing…';

            // Animate drawing every connection line in sequence, then trigger the outcome.
            let i = 0;
            const drawNext = () => {
                if (i >= connections.length) {
                    onComplete();
                    return;
                }
                const [a, b] = connections[i];
                const s1 = starsData[a];
                const s2 = starsData[b];

                // Mark stars as connected
                stars[a].classList.add('is-connected');
                stars[b].classList.add('is-connected');

                // Render the fixed line
                renderFixedLine(s1, s2);

                // Particle burst from the newly reached star
                particleBurst(
                    canvasContainer,
                    (s2.x / 100) * canvasContainer.offsetWidth,
                    (s2.y / 100) * canvasContainer.offsetHeight
                );

                announceStatus(`Connected ${s1.name} and ${s2.name}!`);

                i++;
                autoDrawTimer = setTimeout(drawNext, 550);
            };
            drawNext();
        });

        controls.appendChild(resetBtn);
        controls.appendChild(skipBtn);

        stage.appendChild(title);
        stage.appendChild(subtitle);
        stage.appendChild(instruction);
        stage.appendChild(canvasContainer);
        stage.appendChild(controls);
        
        container.appendChild(stage);
        const page = PageContainer(container, 'page--cosmic');
        page.classList.add('page--libra');
        return page;
    };
    const renderStage8 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content';
        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_7));
        }

        const stage = document.createElement('div');
        stage.className = 'wonders-stage';

        const title = document.createElement('h2');
        title.className = 'storybook-heading';
        title.style.color = 'var(--color-gold)';
        title.textContent = 'Three Little Wonders ✨';

        const subtitle = document.createElement('p');
        subtitle.className = 'body-text';
        subtitle.style.color = 'var(--color-warm-cream)';
        subtitle.textContent = 'Three little wishes, just for you.';

        const planetArea = document.createElement('div');
        planetArea.className = 'wonders-planet-area';

        const planet = document.createElement('div');
        planet.className = 'wonders-planet';
        planet.textContent = '🪐';
        planetArea.appendChild(planet);

        // Orbit rings for visual context
        const orbitWrap = document.createElement('div');
        orbitWrap.className = 'wonders-orbit';
        orbitWrap.innerHTML = `
            <div class="wonders-orbit__ring wonders-orbit__ring--inner"></div>
            <div class="wonders-orbit__ring wonders-orbit__ring--outer"></div>
        `;
        planetArea.appendChild(orbitWrap);

        const artifactsGrid = document.createElement('div');
        artifactsGrid.className = 'wonders-artifacts-grid';

        const wondersData = [
            {
                id: 1,
                icon: '💗',
                label: 'A Certain Someone 👀',
                title: 'A Certain Someone 👀',
                message: '"Anddd I hope things go well with that certain someone 👀🤭 May the universe finally decide to do its job."'
            },
            {
                id: 2,
                icon: '☀️',
                label: 'A Little More Happiness ☀️',
                title: 'A Little More Happiness',
                message: '"I hope you get lots of moments that make you genuinely happy, even the little ones you don\'t expect. ❤️"'
            },
            {
                id: 3,
                icon: '🌠',
                label: 'Doors Yet to Open 🌠',
                title: 'Doors Yet to Open',
                message: '"I hope life takes you to places you\'ve never imagined, opens doors you didn\'t even know existed, and gives you chances to do things you never thought you\'d get to do. May your future surprise you in ways you could never have planned. ✨❤️"'
            }
        ];

        const openedWonders = new Set();

        const showWish = (data) => {
            const overlay = document.createElement('div');
            overlay.className = 'wish-reveal';
            overlay.oncontextmenu = () => false;

            document.body.classList.add('is-modal-open');

            const card = document.createElement('div');
            card.className = 'wish-reveal-card';

            const close = () => {
                document.body.classList.remove('is-modal-open');
                overlay.remove();
                checkCompletion();
            };

            const closeBtn = document.createElement('button');
            closeBtn.className = 'wish-reveal__close';
            closeBtn.innerHTML = '✕';
            closeBtn.setAttribute('aria-label', 'Close wish');
            closeBtn.onclick = close;

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    close();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            const wishTitle = document.createElement('h3');
            wishTitle.className = 'wish-reveal__title';
            wishTitle.textContent = data.title;

            const wishText = document.createElement('p');
            wishText.className = 'wish-reveal__text';
            wishText.textContent = data.message;

            card.appendChild(closeBtn);
            card.appendChild(wishTitle);
            card.appendChild(wishText);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            openedWonders.add(data.id);
        };

        const checkCompletion = () => {
            if (openedWonders.size === 3) {
                // Unlock the 'One last little thing' button
                nextBtn.classList.remove('btn--locked');
                nextBtn.disabled = false;

                const existingComp = stage.querySelector('.wonders-completion');
                if (!existingComp) {
                    const comp = document.createElement('p');
                    comp.className = 'wonders-completion';
                    comp.textContent = 'Three little wishes, just for you. ✨';
                    stage.insertBefore(comp, nextBtn);
                }
            }
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn--primary btn--locked';
        nextBtn.disabled = true;
        nextBtn.style.marginTop = 'var(--space-xl)';
        nextBtn.textContent = 'One last little thing →';
        nextBtn.addEventListener('click', () => {
            if (nextBtn.disabled) return;
            if (unlockStage) unlockStage(STAGES.STAGE_9);
            navigateTo(STAGES.STAGE_9);
        });

        wondersData.forEach((data) => {
            const artifact = document.createElement('div');
            artifact.className = `wonder-artifact wonder-artifact--${data.id}`;
            artifact.setAttribute('tabindex', '0');
            artifact.setAttribute('role', 'button');
            artifact.setAttribute('aria-label', `Unlock wish: ${data.label}`);
            artifact.oncontextmenu = () => false;

            const icon = document.createElement('span');
            icon.className = 'wonder-artifact__icon';
            icon.textContent = data.icon;

            const label = document.createElement('span');
            label.className = 'wonder-artifact__label';
            label.textContent = data.label;

            const progressWrap = document.createElement('div');
            progressWrap.className = 'wonder-artifact__progress-wrap';
            progressWrap.innerHTML = `
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle class="wonder-artifact__progress-ring" cx="50" cy="50" r="45" fill="none" stroke="rgba(212, 175, 127, 0.2)" stroke-width="3" />
                    <circle class="wonder-artifact__progress-circle" cx="50" cy="50" r="45" />
                </svg>
            `;
            const progressCircle = progressWrap.querySelector('.wonder-artifact__progress-circle');

            artifact.appendChild(progressWrap);
            artifact.appendChild(icon);
            artifact.appendChild(label);
            planetArea.appendChild(artifact);

            let holdTimer = null;
            let progressInterval = null;
            const holdDuration = 1000; // Snappy 1-second hold
            let startTime = 0;

            const startHold = (e) => {
                if (e.cancelable) e.preventDefault();
                startTime = Date.now();
                artifact.classList.add('is-holding');
                
                progressInterval = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / holdDuration, 1);
                    const offset = 283 - (progress * 283);
                    progressCircle.style.strokeDashoffset = offset;
                }, 16);

                holdTimer = setTimeout(() => {
                    const elapsed = Date.now() - startTime;
                    if (elapsed >= holdDuration) {
                        cancelHold();
                        showWish(data);
                    }
                }, holdDuration);
            };

            const cancelHold = () => {
                clearTimeout(holdTimer);
                clearInterval(progressInterval);
                artifact.classList.remove('is-holding');
                progressCircle.style.strokeDashoffset = 283;
            };

            // STRICT HOLD-ONLY: Remove any simple click handlers
            artifact.addEventListener('mousedown', startHold);
            artifact.addEventListener('touchstart', startHold, { passive: false });
            window.addEventListener('mouseup', cancelHold);
            window.addEventListener('touchend', cancelHold);

            // Allow keyboard activation for accessibility, but keep it intentional
            artifact.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (window.LittlePlanetHaptics) window.LittlePlanetHaptics.impact('medium');
                    showWish(data);
                }
            });
        });

        stage.appendChild(title);
        stage.appendChild(subtitle);
        stage.appendChild(planetArea);
        stage.appendChild(nextBtn);

        container.appendChild(stage);
        return PageContainer(container, 'page--cosmic');
    };
    // --- Stage 9: A Little Piece of You (Paper Note) ---
    const renderStage9 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-piece-of-you';

        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_8));
        }

        const stage = document.createElement('div');
        stage.className = 'note-stage note-piece-of-you';

        // ---- Upper scene: her Little Planet with the user's star in orbit ----
        // The planet is always present so the golden star clearly belongs to
        // *her* planet's sky instead of floating in a blank void. The star
        // itself is revealed in orbit once the visitor locks in their message.
        const planetScene = document.createElement('div');
        planetScene.className = 'p9-planet-scene';
        planetScene.setAttribute('aria-hidden', 'true');

        // Lush ambient starfield: ~36 twinkling stars drifting around the planet
        const ambientStars = document.createElement('div');
        ambientStars.className = 'p9-ambient-stars';
        const starSpecs = [
            [6, 12, 2.4, 0], [14, 4, 3.1, .4], [22, 18, 2.2, .8], [31, 7, 3.4, .2],
            [39, 15, 2.6, 1.1], [48, 4, 2.9, .6], [57, 12, 2.3, 1.4], [66, 6, 3.2, .3],
            [75, 16, 2.5, .9], [84, 8, 3.0, .1], [91, 18, 2.7, 1.2], [96, 6, 2.4, .7],
            [3, 30, 2.8, 1.0], [11, 24, 2.2, .5], [27, 32, 3.3, 1.3], [44, 27, 2.5, .2],
            [61, 31, 3.1, .8], [79, 26, 2.3, 1.5], [93, 30, 2.9, .4], [8, 44, 2.6, 1.1],
            [24, 41, 3.2, .6], [52, 40, 2.4, 1.6], [72, 43, 3.0, .9], [88, 41, 2.7, .3],
            [5, 58, 3.4, .7], [18, 54, 2.5, 1.2], [36, 57, 2.9, .1], [58, 53, 2.3, 1.0],
            [78, 56, 3.1, .5], [94, 58, 2.6, 1.4], [12, 70, 2.8, .2], [30, 68, 3.3, .8],
            [50, 71, 2.4, 1.3], [69, 67, 2.7, .4], [86, 70, 3.0, 1.0], [20, 84, 2.5, .6],
            [42, 88, 3.2, 1.5], [63, 85, 2.9, .3], [82, 87, 2.6, 1.1]
        ];
        starSpecs.forEach(([x, y, dur, delay], i) => {
            const s = document.createElement('span');
            s.className = 'p9-ambient-star' + (i % 3 === 0 ? ' is-bright' : '');
            s.style.left = x + '%';
            s.style.top = y + '%';
            s.style.animationDuration = dur + 's';
            s.style.animationDelay = delay + 's';
            ambientStars.appendChild(s);
        });
        planetScene.appendChild(ambientStars);

        // The planet illustration (unique gradient ids prefixed "p9")
        const planetEl = document.createElement('div');
        planetEl.className = 'her-planet-illustration p9-planet';
        planetEl.innerHTML = `
<svg class="planet-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="p9OceanGrad" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#DDBFD6"/>
      <stop offset="30%" stop-color="#C9A8C9"/>
      <stop offset="55%" stop-color="#A88B9E"/>
      <stop offset="80%" stop-color="#856A92"/>
      <stop offset="100%" stop-color="#5C4B72"/>
    </radialGradient>
    <radialGradient id="p9AtmosGrad" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="rgba(215, 163, 173, 0)"/>
      <stop offset="90%" stop-color="rgba(215, 163, 173, 0.18)"/>
      <stop offset="95%" stop-color="rgba(155, 140, 184, 0.4)"/>
      <stop offset="100%" stop-color="rgba(155, 140, 184, 0.05)"/>
    </radialGradient>
    <linearGradient id="p9RingGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(184, 137, 79, 0.15)"/>
      <stop offset="25%" stop-color="rgba(215, 163, 173, 0.6)"/>
      <stop offset="42%" stop-color="rgba(244, 217, 166, 0.95)"/>
      <stop offset="50%" stop-color="rgba(255, 246, 224, 1)"/>
      <stop offset="58%" stop-color="rgba(244, 217, 166, 0.95)"/>
      <stop offset="75%" stop-color="rgba(215, 163, 173, 0.6)"/>
      <stop offset="100%" stop-color="rgba(184, 137, 79, 0.15)"/>
    </linearGradient>
    <radialGradient id="p9RingGlow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="rgba(212, 175, 127, 0)"/>
      <stop offset="88%" stop-color="rgba(212, 175, 127, 0.35)"/>
      <stop offset="100%" stop-color="rgba(212, 175, 127, 0)"/>
    </radialGradient>
    <radialGradient id="p9ShadingGrad" cx="30%" cy="28%" r="85%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.32)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="78%" stop-color="rgba(23,21,27,0.12)"/>
      <stop offset="100%" stop-color="rgba(23,21,27,0.42)"/>
    </radialGradient>
    <radialGradient id="p9GlowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="rgba(212, 175, 127, 0)"/>
      <stop offset="90%" stop-color="rgba(212, 175, 127, 0.22)"/>
      <stop offset="100%" stop-color="rgba(212, 175, 127, 0)"/>
    </radialGradient>
    <clipPath id="p9PlanetClip"><circle cx="120" cy="120" r="66"/></clipPath>
  </defs>

  <!-- Outer luminous halo -->
  <circle cx="120" cy="120" r="112" fill="url(#p9GlowGrad)"/>
  <!-- Atmospheric gradient bands -->
  <circle cx="120" cy="120" r="82" fill="url(#p9AtmosGrad)"/>

  <!-- Ring system: back halves -->
  <g class="planet-ring-back" opacity="0.85">
    <ellipse cx="120" cy="120" rx="112" ry="30" transform="rotate(-20 120 120)" fill="url(#p9RingGlow)"/>
    <ellipse cx="120" cy="120" rx="104" ry="26" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="9" opacity="0.55"/>
    <ellipse cx="120" cy="120" rx="97"  ry="21" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="3" opacity="0.4"/>
    <ellipse cx="120" cy="120" rx="110" ry="29" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="1.5" opacity="0.5"/>
  </g>

  <!-- Planet body -->
  <g class="planet-body-group">
    <circle cx="120" cy="120" r="66" fill="url(#p9OceanGrad)"/>
    <!-- swirling ocean currents -->
    <g clip-path="url(#p9PlanetClip)" fill="none" stroke-linecap="round">
      <path d="M 60 110 Q 95 96 128 108 Q 160 120 178 106" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
      <path d="M 66 140 Q 100 152 132 140 Q 158 131 174 140" stroke="rgba(255,255,255,0.16)" stroke-width="2.5"/>
      <path d="M 72 84 Q 104 74 136 84 Q 158 91 168 82" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
      <path d="M 82 164 Q 112 172 142 162" stroke="rgba(90,70,110,0.3)" stroke-width="2.5"/>
      <path d="M 100 96 Q 112 92 122 97" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    </g>
    <!-- Distinct muted green continents -->
    <g clip-path="url(#p9PlanetClip)">
      <path d="M 74 82 Q 82 70 98 73 Q 112 75 115 86 Q 117 97 108 103 Q 94 108 85 102 Q 75 95 74 82 Z" fill="#6B8E6B"/>
      <path d="M 74 82 Q 82 70 98 73 Q 112 75 115 86 Q 117 97 108 103 Q 94 108 85 102 Q 75 95 74 82 Z" fill="url(#p9ShadingGrad)" opacity="0.35"/>
      <path d="M 145 100 Q 158 96 166 107 Q 170 118 163 127 Q 152 132 144 124 Q 138 113 145 100 Z" fill="#71956F"/>
      <path d="M 80 132 Q 88 124 100 128 Q 110 134 106 145 Q 97 153 86 147 Q 78 140 80 132 Z" fill="#648A64"/>
      <path d="M 112 138 Q 122 134 130 141 Q 134 150 127 157 Q 116 160 110 152 Q 106 145 112 138 Z" fill="#6B8E6B"/>
      <ellipse cx="140" cy="84" rx="9" ry="6" fill="#71956F"/>
      <ellipse cx="90" cy="118" rx="6" ry="4" fill="#648A64"/>
    </g>
    <!-- Shading and soft light -->
    <circle cx="120" cy="120" r="66" fill="url(#p9ShadingGrad)"/>
    <ellipse cx="94" cy="94" rx="24" ry="16" fill="rgba(241, 231, 220, 0.14)" transform="rotate(-20 94 94)"/>
    <circle cx="120" cy="120" r="66" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
  </g>

  <!-- Ring system: front halves -->
  <g class="planet-ring-front" opacity="0.9">
    <ellipse cx="120" cy="120" rx="104" ry="26" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="9" opacity="0.7"/>
    <ellipse cx="120" cy="120" rx="97"  ry="21" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="3" opacity="0.5"/>
    <ellipse cx="120" cy="120" rx="110" ry="29" transform="rotate(-20 120 120)" fill="none" stroke="url(#p9RingGrad)" stroke-width="1.5" opacity="0.6"/>
  </g>
</svg>`;
        planetScene.appendChild(planetEl);

        // The user's golden star — revealed in orbit once they lock in their message
        const orbitStar = document.createElement('div');
        orbitStar.className = 'p9-orbit-star';
        orbitStar.innerHTML = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="p9OrbitStarGrad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#FFFBEF"/>
      <stop offset="35%" stop-color="#F4D9A6"/>
      <stop offset="70%" stop-color="#D4AF7F"/>
      <stop offset="100%" stop-color="#B8894F"/>
    </radialGradient>
    <radialGradient id="p9OrbitStarHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255, 246, 224, 0.9)"/>
      <stop offset="55%" stop-color="rgba(244, 217, 166, 0.35)"/>
      <stop offset="100%" stop-color="rgba(244, 217, 166, 0)"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#p9OrbitStarHalo)"/>
  <path d="M 50 4 L 61 36 L 95 37 L 68 58 L 78 92 L 50 72 L 22 92 L 32 58 L 5 37 L 39 36 Z"
        fill="url(#p9OrbitStarGrad)" stroke="#FFF6E0" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 50 20 L 56.4 40.4 L 78 41.2 L 61 54.4 L 67.2 75.6 L 50 63.2 L 32.8 75.6 L 39 54.4 L 22 41.2 L 43.6 40.4 Z"
        fill="rgba(255, 251, 239, 0.35)"/>
  <circle cx="43" cy="38" r="4.5" fill="rgba(255,255,255,0.6)"/>
</svg>`;
        planetEl.appendChild(orbitStar);

        stage.appendChild(planetScene);

        // Paper note card
        const noteCard = document.createElement('div');
        noteCard.className = 'note-paper-card';
        noteCard.setAttribute('aria-hidden', 'false');

        const title = document.createElement('h2');
        title.className = 'storybook-heading note-title';
        title.textContent = 'A Little Piece of You';

        const subtitle = document.createElement('p');
        subtitle.className = 'note-subtitle';
        subtitle.textContent = "We've made a little space for you here, too. \u2728";

        const question = document.createElement('p');
        question.className = 'note-question';
        question.textContent = 'If you could leave one little thing in this universe, what would it be?';

        const textarea = document.createElement('textarea');
        textarea.className = 'note-textarea';
        textarea.placeholder = 'A thought, a dream, a little message...';
        textarea.maxLength = 1000;
        textarea.rows = 4;
        textarea.setAttribute('aria-label', 'Your message');

        const charCounter = document.createElement('span');
        charCounter.className = 'note-char-counter';
        charCounter.textContent = '0 / 1,000';
        charCounter.setAttribute('aria-live', 'polite');

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'btn btn--primary note-submit-btn';
        submitBtn.textContent = 'Add my star';

        const formArea = document.createElement('div');
        formArea.className = 'note-form-area';
        formArea.appendChild(question);
        formArea.appendChild(textarea);
        formArea.appendChild(charCounter);
        formArea.appendChild(submitBtn);

        // Success state (hidden initially)
        const successArea = document.createElement('div');
        successArea.className = 'note-success';
        successArea.hidden = true;

        const successStar = document.createElement('div');
        successStar.className = 'note-success-star';
        successStar.innerHTML = `
<svg class="note-star-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="sucStarGrad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#FFF6E0"/>
      <stop offset="35%" stop-color="#F4D9A6"/>
      <stop offset="70%" stop-color="#D4AF7F"/>
      <stop offset="100%" stop-color="#B8894F"/>
    </radialGradient>
    <radialGradient id="sucStarCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255, 250, 235, 0.95)"/>
      <stop offset="100%" stop-color="rgba(255, 250, 235, 0)"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#sucStarCore)"/>
  <path d="M 50 6 L 60.2 36.8 L 92.4 38 L 66.8 57.2 L 76.6 88 L 50 70.5 L 23.4 88 L 33.2 57.2 L 7.6 38 L 39.8 36.8 Z"
        fill="url(#sucStarGrad)" stroke="#B8894F" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M 50 22 L 55.4 39.2 L 73.4 40 L 59.1 51 L 64.4 68.5 L 50 58.3 L 35.6 68.5 L 40.9 51 L 26.6 40 L 44.6 39.2 Z"
        fill="rgba(255, 246, 224, 0.35)"/>
  <circle cx="44" cy="40" r="4" fill="rgba(255, 255, 255, 0.55)"/>
</svg>`;

        const successText = document.createElement('p');
        successText.className = 'note-success-text';
        successText.textContent = 'Your star will be safe here. \u2728';

        const proceedBtn = document.createElement('button');
        proceedBtn.type = 'button';
        proceedBtn.className = 'btn btn--primary note-proceed-btn';
        proceedBtn.textContent = 'To the final letter \u2192';
        proceedBtn.disabled = true;

        successArea.appendChild(successStar);
        successArea.appendChild(successText);
        successArea.appendChild(proceedBtn);

        noteCard.appendChild(title);
        noteCard.appendChild(subtitle);
        noteCard.appendChild(formArea);

        // The success state lives OUTSIDE the paper card so it stays visible
        // after the note folds away and becomes a star.
        stage.appendChild(noteCard);
        stage.appendChild(successArea);
        container.appendChild(stage);

        // ---- Interaction logic ----
        let submitted = false;

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charCounter.textContent = `${len} / 1,000`;
            if (len >= 1000) charCounter.classList.add('is-max');
            else charCounter.classList.remove('is-max');
        });

        submitBtn.addEventListener('click', async () => {
            if (submitted) return;
            const value = textarea.value.trim();
            if (!value) {
                // Reject empty / whitespace-only input
                textarea.classList.add('note-textarea--error');
                textarea.focus();
                announceStatus('Please write a little message first.');
                setTimeout(() => textarea.classList.remove('note-textarea--error'), 600);
                return;
            }
            const confirmed = await confirmAction(
                'Are you sure you want to lock this in? ✨',
                'Yes, add my star ✨',
                'Cancel'
            );
            if (!confirmed) return;
            submitted = true;
            submitBtn.disabled = true;

            // Persist best-effort (like other stages); never block UI
            try {
                fetch('/api/stars', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newIdempotencyKey(), message: value })
                }).catch(() => {});
            } catch (e) { /* ignore */ }

            // Animate the paper folding/morphing into a glowing golden star,
            // then send the star up toward her little planet.
            noteCard.classList.add('is-folding');

            const burstX = stage.clientWidth / 2;
            const burstY = stage.clientHeight / 2;
            const reduced = prefersReducedMotion();

            // The travelling star, launched from the centre of the note.
            const flyStar = document.createElement('div');
            flyStar.className = 'note-fly-star';
            flyStar.innerHTML = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="flyStarGrad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#FFF6E0"/>
      <stop offset="40%" stop-color="#F4D9A6"/>
      <stop offset="75%" stop-color="#D4AF7F"/>
      <stop offset="100%" stop-color="#B8894F"/>
    </radialGradient>
  </defs>
  <path d="M 50 4 L 61 36 L 95 37 L 68 58 L 78 92 L 50 72 L 22 92 L 32 58 L 5 37 L 39 36 Z"
        fill="url(#flyStarGrad)" stroke="#FFF6E0" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
            stage.appendChild(flyStar);

            setTimeout(() => {
                // Morph complete: the note has become a star.
                noteCard.classList.remove('is-folding');
                noteCard.classList.add('is-morphed');
                flyStar.classList.add('is-launching');
                if (!reduced) {
                    particleBurst(stage, burstX, burstY);
                }
            }, reduced ? 40 : 950);

            setTimeout(() => {
                // The star has flown off toward the planet; reveal success state.
                formArea.classList.add('is-hidden');
                successArea.hidden = false;
                successArea.classList.add('is-visible');
                announceStatus('Your star will be safe here.');
                proceedBtn.disabled = false;
                proceedBtn.focus();
                // The visitor's star is now safely orbiting her little planet.
                orbitStar.classList.add('is-visible');
                setTimeout(() => flyStar.remove(), 400);
            }, reduced ? 120 : 2200);
        });

        proceedBtn.addEventListener('click', () => {
            if (proceedBtn.disabled) return;
            if (unlockStage) unlockStage(STAGES.STAGE_10);
            navigateTo(STAGES.STAGE_10);
        });

        return PageContainer(container, 'page--piece-of-you');
    };

    // --- Stage 10: Her Little Planet (Grand Finale) ---
    const renderStage10 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-her-planet';

        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_9));
        }

        const stage = document.createElement('div');
        stage.className = 'her-planet-stage';

        // Little Planet illustration (reused from Page 3, unique gradient ids)
        const planetWrapper = document.createElement('div');
        planetWrapper.className = 'her-planet-illustration';
        planetWrapper.setAttribute('aria-hidden', 'true');

        planetWrapper.innerHTML = `
<svg class="planet-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <!-- Richer swirling pink-violet ocean -->
    <radialGradient id="finOceanGrad" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#DDBFD6"/>
      <stop offset="30%" stop-color="#C9A8C9"/>
      <stop offset="55%" stop-color="#A88B9E"/>
      <stop offset="80%" stop-color="#856A92"/>
      <stop offset="100%" stop-color="#5C4B72"/>
    </radialGradient>
    <!-- Subtle atmospheric gradient bands -->
    <radialGradient id="finAtmosGrad" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="rgba(215, 163, 173, 0)"/>
      <stop offset="90%" stop-color="rgba(215, 163, 173, 0.18)"/>
      <stop offset="95%" stop-color="rgba(155, 140, 184, 0.4)"/>
      <stop offset="100%" stop-color="rgba(155, 140, 184, 0.05)"/>
    </radialGradient>
    <!-- Luminous golden ring gradient -->
    <linearGradient id="finRingGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(184, 137, 79, 0.15)"/>
      <stop offset="25%" stop-color="rgba(215, 163, 173, 0.6)"/>
      <stop offset="42%" stop-color="rgba(244, 217, 166, 0.95)"/>
      <stop offset="50%" stop-color="rgba(255, 246, 224, 1)"/>
      <stop offset="58%" stop-color="rgba(244, 217, 166, 0.95)"/>
      <stop offset="75%" stop-color="rgba(215, 163, 173, 0.6)"/>
      <stop offset="100%" stop-color="rgba(184, 137, 79, 0.15)"/>
    </linearGradient>
    <radialGradient id="finRingGlow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="rgba(212, 175, 127, 0)"/>
      <stop offset="88%" stop-color="rgba(212, 175, 127, 0.35)"/>
      <stop offset="100%" stop-color="rgba(212, 175, 127, 0)"/>
    </radialGradient>
    <!-- Shading / lighting -->
    <radialGradient id="finShadingGrad" cx="30%" cy="28%" r="85%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.32)"/>
      <stop offset="40%" stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="78%" stop-color="rgba(23,21,27,0.12)"/>
      <stop offset="100%" stop-color="rgba(23,21,27,0.42)"/>
    </radialGradient>
    <radialGradient id="finGlowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="rgba(212, 175, 127, 0)"/>
      <stop offset="90%" stop-color="rgba(212, 175, 127, 0.22)"/>
      <stop offset="100%" stop-color="rgba(212, 175, 127, 0)"/>
    </radialGradient>
    <clipPath id="finPlanetClip"><circle cx="120" cy="120" r="66"/></clipPath>
  </defs>

  <!-- Outer luminous halo -->
  <circle cx="120" cy="120" r="112" fill="url(#finGlowGrad)"/>
  <!-- Atmospheric gradient bands -->
  <circle cx="120" cy="120" r="82" fill="url(#finAtmosGrad)"/>

  <!-- Ring system: back halves -->
  <g class="planet-ring-back" opacity="0.85">
    <ellipse cx="120" cy="120" rx="112" ry="30" transform="rotate(-20 120 120)" fill="url(#finRingGlow)"/>
    <ellipse cx="120" cy="120" rx="104" ry="26" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="9" opacity="0.55"/>
    <ellipse cx="120" cy="120" rx="97"  ry="21" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="3" opacity="0.4"/>
    <ellipse cx="120" cy="120" rx="110" ry="29" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="1.5" opacity="0.5"/>
  </g>

  <!-- Planet body -->
  <g class="planet-body-group">
    <circle cx="120" cy="120" r="66" fill="url(#finOceanGrad)"/>
    <!-- swirling ocean currents -->
    <g clip-path="url(#finPlanetClip)" fill="none" stroke-linecap="round">
      <path d="M 60 110 Q 95 96 128 108 Q 160 120 178 106" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
      <path d="M 66 140 Q 100 152 132 140 Q 158 131 174 140" stroke="rgba(255,255,255,0.16)" stroke-width="2.5"/>
      <path d="M 72 84 Q 104 74 136 84 Q 158 91 168 82" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
      <path d="M 82 164 Q 112 172 142 162" stroke="rgba(90,70,110,0.3)" stroke-width="2.5"/>
      <path d="M 100 96 Q 112 92 122 97" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    </g>
    <!-- Distinct muted green continents -->
    <g clip-path="url(#finPlanetClip)">
      <path d="M 74 82 Q 82 70 98 73 Q 112 75 115 86 Q 117 97 108 103 Q 94 108 85 102 Q 75 95 74 82 Z" fill="#6B8E6B"/>
      <path d="M 74 82 Q 82 70 98 73 Q 112 75 115 86 Q 117 97 108 103 Q 94 108 85 102 Q 75 95 74 82 Z" fill="url(#finShadingGrad)" opacity="0.35"/>
      <path d="M 145 100 Q 158 96 166 107 Q 170 118 163 127 Q 152 132 144 124 Q 138 113 145 100 Z" fill="#71956F"/>
      <path d="M 80 132 Q 88 124 100 128 Q 110 134 106 145 Q 97 153 86 147 Q 78 140 80 132 Z" fill="#648A64"/>
      <path d="M 112 138 Q 122 134 130 141 Q 134 150 127 157 Q 116 160 110 152 Q 106 145 112 138 Z" fill="#6B8E6B"/>
      <ellipse cx="140" cy="84" rx="9" ry="6" fill="#71956F"/>
      <ellipse cx="90" cy="118" rx="6" ry="4" fill="#648A64"/>
    </g>
    <!-- Shading and soft light -->
    <circle cx="120" cy="120" r="66" fill="url(#finShadingGrad)"/>
    <ellipse cx="94" cy="94" rx="24" ry="16" fill="rgba(241, 231, 220, 0.14)" transform="rotate(-20 94 94)"/>
    <circle cx="120" cy="120" r="66" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
  </g>

  <!-- Ring system: front halves -->
  <g class="planet-ring-front" opacity="0.9">
    <ellipse cx="120" cy="120" rx="104" ry="26" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="9" opacity="0.7"/>
    <ellipse cx="120" cy="120" rx="97"  ry="21" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="3" opacity="0.5"/>
    <ellipse cx="120" cy="120" rx="110" ry="29" transform="rotate(-20 120 120)" fill="none" stroke="url(#finRingGrad)" stroke-width="1.5" opacity="0.6"/>
  </g>
</svg>`;

        // The user's golden star from Page 9 — the biggest star around the
        // planet, rendered as a detailed unique SVG star (no message text).
        const userStar = document.createElement('div');
        userStar.className = 'her-planet-user-star';
        userStar.setAttribute('aria-hidden', 'true');
        userStar.innerHTML = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="usrStarGrad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#FFFBEF"/>
      <stop offset="35%" stop-color="#F4D9A6"/>
      <stop offset="70%" stop-color="#D4AF7F"/>
      <stop offset="100%" stop-color="#B8894F"/>
    </radialGradient>
    <radialGradient id="usrStarHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255, 246, 224, 0.9)"/>
      <stop offset="55%" stop-color="rgba(244, 217, 166, 0.35)"/>
      <stop offset="100%" stop-color="rgba(244, 217, 166, 0)"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#usrStarHalo)"/>
  <path d="M 50 4 L 61 36 L 95 37 L 68 58 L 78 92 L 50 72 L 22 92 L 32 58 L 5 37 L 39 36 Z"
        fill="url(#usrStarGrad)" stroke="#FFF6E0" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 50 20 L 56.4 40.4 L 78 41.2 L 61 54.4 L 67.2 75.6 L 50 63.2 L 32.8 75.6 L 39 54.4 L 22 41.2 L 43.6 40.4 Z"
        fill="rgba(255, 251, 239, 0.35)"/>
  <circle cx="43" cy="38" r="4.5" fill="rgba(255,255,255,0.6)"/>
</svg>`;
        planetWrapper.appendChild(userStar);

        // Attach the planet illustration to the stage so it actually renders.
        stage.appendChild(planetWrapper);

        // ---- Birthday message (real, selectable HTML text) ----
        const messageCard = document.createElement('div');
        messageCard.className = 'her-planet-message';

        const nameLine = document.createElement('h2');
        nameLine.className = 'her-planet-name storybook-heading';
        nameLine.textContent = 'Rumi \u2764\uFE0F';
        messageCard.appendChild(nameLine);

        const paragraphEls = [];
        [
            "I'm really glad we got to know each other all those years ago, and I'm glad we got to talk again. You've been part of some of my favourite memories, and I'm genuinely happy I got to share those moments with you.",
            "I hope we get to make plenty more memories together, have more random conversations, laugh at stupid stuff, and just enjoy the time we get to spend together. \u{1F62D}\u2764\uFE0F",
            "And hey, I know you might not always see yourself the way other people do, but I hope you remember that there's only one you.",
            "Just like every planet and every star is unique in its own way, you're one of a kind, too. So don't let your negative thoughts take over and make you forget that, okay? \u2764\uFE0F",
            "I hope 16 brings you lots of happiness, good memories, new experiences, and plenty of reasons to smile.",
            "Happy Sweet 16, Rumi. I hope you have an amazing year. \u{1FAC6}\u2728"
        ].forEach((text) => {
            const p = document.createElement('p');
            p.className = 'her-planet-para is-pending';
            p.textContent = text;
            messageCard.appendChild(p);
            paragraphEls.push(p);
        });

        stage.appendChild(messageCard);

        // ---- "Next" button: disabled until the final paragraph has faded in,
        //      then unlocked so the visitor can step into the Closing Note.
        const proceedBtn = document.createElement('button');
        proceedBtn.type = 'button';
        proceedBtn.className = 'btn btn--primary her-planet-proceed';
        proceedBtn.textContent = 'Next ✨';
        proceedBtn.disabled = true;
        stage.appendChild(proceedBtn);

        const gotoClosingNote = () => {
            if (proceedBtn.disabled) return;
            if (unlockStage) unlockStage(STAGES.STAGE_11);
            navigateTo(STAGES.STAGE_11);
        };
        proceedBtn.addEventListener('click', gotoClosingNote);

        // ---- Reveal flow: "Rumi ❤️" first, then the paragraphs fade in one by
        //      one at a brisk reading pace. The "Next" button unlocks once the
        //      final paragraph has appeared, so the message is fully read first.
        let revealStarted = false;
        let revealTimers = [];

        const clearTimers = () => {
            revealTimers.forEach((t) => clearTimeout(t));
            revealTimers = [];
        };

        // Paragraph cadence: longer paragraphs (3+ sentences) wait 3s,
        // shorter ones (1-2 sentences) wait 1.5s — measured from the moment
        // the previous paragraph appears, so reading stays calm and relaxed.
        const paragraphDelay = (el) => {
            const sentences = (el.textContent.match(/[.!?]+[\s)]/g) || []).length;
            return sentences >= 3 ? 3000 : 1500;
        };

        const startGradualReveal = () => {
            revealStarted = true;
            // Header ("Rumi ❤️") appears first with a warm golden/cream glow.
            nameLine.classList.add('is-visible');
            if (window.LittlePlanetHaptics) {
                window.LittlePlanetHaptics.impact('soft');
            }

            // Wait 1s from header appearance, then fade in the first paragraph.
            let elapsed = 1000;
            paragraphEls.forEach((el) => {
                const t = setTimeout(() => {
                    el.classList.remove('is-pending');
                    el.classList.add('is-shown');
                    if (window.LittlePlanetHaptics) {
                        window.LittlePlanetHaptics.impact('soft');
                    }
                }, prefersReducedMotion() ? 0 : elapsed);
                revealTimers.push(t);
                elapsed += paragraphDelay(el);
            });

            // Enable the "Next" button a beat after the final paragraph appears,
            // so the visitor has absorbed the closing line before moving on.
            const unlockDelay = prefersReducedMotion() ? 0 : elapsed + 400;
            const unlockTimer = setTimeout(() => {
                proceedBtn.disabled = false;
                proceedBtn.classList.add('is-enabled');
                proceedBtn.focus();
            }, unlockDelay);
            revealTimers.push(unlockTimer);
        };

        const initialDelay = prefersReducedMotion() ? 0 : 0;
        const t0 = setTimeout(() => {
            if (revealStarted) return;
            if (prefersReducedMotion()) {
                // Reduced motion: reveal everything at once instead of waiting.
                nameLine.classList.add('is-visible');
                paragraphEls.forEach((el) => {
                    el.classList.remove('is-pending');
                    el.classList.add('is-shown');
                });
                proceedBtn.disabled = false;
                proceedBtn.classList.add('is-enabled');
                proceedBtn.focus();
            } else {
                startGradualReveal();
            }
        }, initialDelay);
        revealTimers.push(t0);

        if (prefersReducedMotion()) {
            container.classList.add('is-reduced-motion');
        }

        container.appendChild(stage);
        return PageContainer(container, 'page--her-planet');
    };

    // --- Stage 11: Closing Note ---
    const renderStage11 = () => {
        const container = document.createElement('div');
        container.className = 'stage-content stage-closing-note';

        container.appendChild(makeStarfield());

        if (renderBackButton) {
            container.appendChild(renderBackButton(STAGES.STAGE_10));
        }

        const stage = document.createElement('div');
        stage.className = 'closing-note-stage';

        // Header
        const header = document.createElement('h2');
        header.className = 'closing-note-header storybook-heading';
        header.textContent = 'One last thing…';

        // Content container with paragraphs
        const content = document.createElement('div');
        content.className = 'closing-note-content';

        const paragraphs = [
            "I know there's quite a lot here, and I just wanted to say that I'm sorry if any part of it felt like too much, uncomfortable, or out of place. That was never my intention.",
            "I genuinely just wanted to make something nice for you, and I hope you enjoyed going through it.",
            "Also, I'm sorry it took me longer than I originally planned. Thank you for being patient with me. ❤️"
        ];

        const paragraphEls = [];

        paragraphs.forEach((text, i) => {
            const p = document.createElement('p');
            p.className = 'closing-note-para is-pending';
            p.textContent = text;
            content.appendChild(p);
            paragraphEls.push(p);
        });

        // Final heart symbol
        const heartSymbol = document.createElement('p');
        heartSymbol.className = 'closing-note-heart is-pending';
        heartSymbol.textContent = '❤️';
        content.appendChild(heartSymbol);

        stage.appendChild(header);
        stage.appendChild(content);
        container.appendChild(stage);

        // --- Sequential reveal with Page 10 timing pattern ---
        // Header appears on load with warm golden/cream glow -> wait 2s ->
        // first paragraph -> 5s for long paragraphs / 3s for short from the
        // previous paragraph's appearance -> final heart fades in last.
        let revealStarted = false;
        let revealTimers = [];

        const clearTimers = () => {
            revealTimers.forEach((t) => clearTimeout(t));
            revealTimers = [];
        };

        // Same cadence logic as Page 10
        const paragraphDelay = (el) => {
            const sentences = (el.textContent.match(/[.!?]+[\s)]/g) || []).length;
            return sentences >= 3 ? 3000 : 1500;
        };

        const startGradualReveal = () => {
            revealStarted = true;
            // First, show header with its warm golden/cream glow
            header.classList.add('is-visible');
            if (window.LittlePlanetHaptics) {
                window.LittlePlanetHaptics.impact('soft');
            }

            // Wait 1s from header appearance, then fade in the first paragraph.
            let elapsed = 1000;
            paragraphEls.forEach((el) => {
                const t = setTimeout(() => {
                    el.classList.remove('is-pending');
                    el.classList.add('is-shown');
                    if (window.LittlePlanetHaptics) {
                        window.LittlePlanetHaptics.impact('soft');
                    }
                }, prefersReducedMotion() ? 0 : elapsed);
                revealTimers.push(t);
                elapsed += paragraphDelay(el);
            });

            // Heart symbol fades in last
            const heartDelay = elapsed;
            const heartTimer = setTimeout(() => {
                heartSymbol.classList.remove('is-pending');
                heartSymbol.classList.add('is-shown');
                if (window.LittlePlanetHaptics) {
                    window.LittlePlanetHaptics.notification('success');
                }
            }, prefersReducedMotion() ? 0 : heartDelay);
            revealTimers.push(heartTimer);
        };

        const initialDelay = prefersReducedMotion() ? 0 : 0;
        const t0 = setTimeout(() => {
            if (revealStarted) return;
            if (prefersReducedMotion()) {
                header.classList.add('is-visible');
                paragraphEls.forEach((el) => {
                    el.classList.remove('is-pending');
                    el.classList.add('is-shown');
                });
                heartSymbol.classList.remove('is-pending');
                heartSymbol.classList.add('is-shown');
            } else {
                startGradualReveal();
            }
        }, initialDelay);
        revealTimers.push(t0);

        if (prefersReducedMotion()) {
            container.classList.add('is-reduced-motion');
        }

        return PageContainer(container, 'page--cosmic');
    };

    // --- Register all stages with the router ---
    registerStage(STAGES.STAGE_2, renderStage2);
    registerStage(STAGES.STAGE_3, renderStage3);
    registerStage(STAGES.STAGE_4, renderStage4);
    registerStage(STAGES.STAGE_5, renderStage5);
    registerStage(STAGES.STAGE_6, renderStage6);
    registerStage(STAGES.STAGE_7, renderStage7);
    registerStage(STAGES.STAGE_8, renderStage8);
    registerStage(STAGES.STAGE_9, renderStage9);
    registerStage(STAGES.STAGE_10, renderStage10);
    registerStage(STAGES.STAGE_11, renderStage11);

    // Expose on window for debugging / future use
    window.LittlePlanet.stages = {
        renderStage2,
        renderStage3,
        renderStage4,
        renderStage5,
        renderStage6,
        renderStage7,
        renderStage8,
        renderStage9,
        renderStage10,
        renderStage11
    };
})();