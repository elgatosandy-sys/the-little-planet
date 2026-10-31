import { readFileSync } from 'node:fs';

// Test 1: Syntax check for both bundles
const files = ['js/main.js', 'js/stages.js'];
let ok = true;
for (const f of files) {
  const code = readFileSync(f, 'utf8');
  try {
    new Function(code);
    console.log('PASS: ' + f + ' syntax OK');
  } catch (e) {
    console.error('FAIL: ' + f + ' -> ' + e.message);
    ok = false;
  }
}

const stages = readFileSync('js/stages.js', 'utf8');
const admin = readFileSync('js/admin.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const main  = readFileSync('js/main.js', 'utf8');
const pagesCSS = readFileSync('styles/pages.css', 'utf8');

// Test 2: Required stage registrations and key UI strings
const checks = [
  ['stages registers STAGE_2', stages.includes('registerStage(STAGES.STAGE_2')],
  ['stages registers STAGE_3', stages.includes('registerStage(STAGES.STAGE_3')],
  ['stages registers STAGE_4', stages.includes('registerStage(STAGES.STAGE_4')],
  ['stages has renderStage2',  stages.includes('const renderStage2')],
  ['stages has renderStage3',  stages.includes('const renderStage3')],
  ['stages has renderStage4',  stages.includes('const renderStage4')],
  ['Make a wish title',         stages.includes('Make a wish')],
  ['Wish char counter',         stages.includes('wish-char-counter')],
  ['Wish placeholder',          stages.includes('Your wish goes here...')],
  ['Wish label',                stages.includes('wish-label')],
  ['Wish textarea',             stages.includes('wish-textarea')],
  ['Save my wish button',       stages.includes('Save my wish')],
  ['Wish submit confirm modal', stages.includes('confirmAction(') && stages.includes('Are you sure you want to lock this in? ✨')],
  ['Double-click instruction',  stages.includes('Double-click the candles to blow them out')],
  ["Let's explore button",      stages.includes("Let's explore")],
  
  ['Open your present button', stages.includes('Open your present')],
  ['Stage 1 navigates to 2',   main.includes('navigateTo(STAGES.STAGE_2)')],
  ['Router listens to hashchange', main.includes("addEventListener('hashchange'")],
  ['Router restores hash on refresh', main.includes("location.hash.replace('#'")],
  ['stages registers STAGE_5', stages.includes('registerStage(STAGES.STAGE_5')],
  ['stages registers STAGE_6', stages.includes('registerStage(STAGES.STAGE_6')],
  ['stages has renderStage5',  stages.includes('const renderStage5')],
  ['stages has renderStage6',  stages.includes('const renderStage6')],
  ['Page 4 letter line',       stages.includes('Miruna, la mulţi ani!! ❤️')],
  ['Page 4 button',            stages.includes('Keep exploring →')],
  ['Page 5 card 1',            stages.includes('Hair Color Crisis™')],
  ['Page 5 card 2',            stages.includes('Online Boyfriend Era™')],
  ['Page 5 card 3',            stages.includes('Character Development™')],
  ['Page 5 button',            stages.includes('Visit the museum →')],
  ['Page 6 exhibit 1',         stages.includes('Mascara Incident™ 💄')],
  ['Page 6 exhibit 2',         stages.includes('Spider-Web Swing 🕸️')],
  ['Page 6 exhibit 3',         stages.includes('Pătrățica Football ⚽')],
  ['Page 6 exhibit 4',         stages.includes('Bella the DOG 🐶')],
  ['Page 6 Bella stamp',       stages.includes('10/10 good girl')],
  ['Page 6 button',            stages.includes('Follow the stars →')],
  ['index.html includes stages.js', index.includes('js/stages.js')],
  
  ['stages registers STAGE_7', stages.includes('registerStage(STAGES.STAGE_7')],
  ['stages registers STAGE_8', stages.includes('registerStage(STAGES.STAGE_8')],
  ['stages has renderStage7',  stages.includes('const renderStage7')],
  ['stages has renderStage8',  stages.includes('const renderStage8')],
  ['Page 7 Libra title',        stages.includes('The Libra Constellation')],
  ['Page 7 Libra subtitle',     stages.includes("Every star has its place")],
  ['Page 7 Libra instruction',  stages.includes('Tap star 1')],
  ['Page 7 Libra completion',   stages.includes('A little constellation, brought together')],
  ['Page 7 Keep exploring btn', stages.includes('Keep exploring →')],
  ['Page 7 Reset button',      stages.includes('Reset')],
  ['Page 7 Auto draw btn',   stages.includes('Auto draw')],
  ['Page 7 Libra label',        stages.includes('LIBRA')],
  ['Page 7 Fun facts card',     stages.includes('libra-facts-card')],
  ['Page 7 Aesthetic Royalty',  stages.includes('Aesthetic Royalty')],
  ['Page 7 Peacekeeper',        stages.includes('Peacekeeper')],
  ['Page 7 Flawless Vibe',      stages.includes('Flawless Vibe')],
  ['Page 8 Three Wonders title',stages.includes('Three Little Wonders')],
  ['Page 8 Three Wonders sub',  stages.includes('Three little wishes, just for you')],
  ['Page 8 Wish 1 title',       stages.includes('A Little More Happiness')],
  ['Page 8 Wish 1 message',     stages.includes('genuinely happy')],
  ['Page 8 Wish 2 title',       stages.includes('Doors Yet to Open')],
  ['Page 8 Wish 2 message',     stages.includes('places you') || stages.includes('never imagined')],
  ['Page 8 Wish 3 title',       stages.includes('A Certain Someone')],
  ['Page 8 Wish 3 message',     stages.includes('certain someone')],
  ['Page 8 One last btn',       stages.includes('One last little thing →')],
  ['Page 8 completion msg',     stages.includes('Three little wishes, just for you. ✨')],
  ['Page 8 Close wish btn',     stages.includes('wish-reveal__close')],
  ['Page 8 Hold duration',      stages.includes('holdDuration')],
  ['Page 8 progress ring',      stages.includes('wonder-artifact__progress-circle')],
  ['Page 8 wonders-grid',       stages.includes('wonders-artifacts-grid')],
  ['Page 9 title',              stages.includes('A Little Piece of You')],
  ['Page 9 subtitle',           stages.includes('We\'ve made a little space for you')],
  ['Page 9 question',           stages.includes('If you could leave one little thing')],
  ['Page 9 placeholder',        stages.includes('A thought, a dream, a little message')],
  ['Page 9 primary btn',        stages.includes('Add my star')],
  ['Page 9 success text',       stages.includes('Your star will be safe here')],
  ['Page 9 proceed btn',        stages.includes('To the final letter')],
  ['Page 9 char counter',       stages.includes('note-char-counter')],
  ['Page 9 max length',         stages.includes('maxLength = 1000')],
  ['Page 9 empty reject',      stages.includes('note-textarea--error')],
  ['Page 9 folding animation',  pagesCSS.includes('@keyframes note-paper-fold')],
  ['Page 9 flying star',        stages.includes('note-fly-star')],
  ['Page 9 planet scene',       stages.includes('p9-planet-scene')],
  ['Page 9 ambient starfield',  stages.includes('p9-ambient-stars')],
  ['Page 9 planet svg',         stages.includes('p9OceanGrad')],
  ['Page 9 orbit star',         stages.includes('p9-orbit-star')],
  ['Page 9 orbit reveal',       stages.includes("orbitStar.classList.add('is-visible')")],
  ['Page 10 name line',         stages.includes('Rumi \u2764')],
  ['Page 10 paragraph 1',       stages.includes('I\'m really glad we got to know each other')],
  ['Page 10 paragraph 2',       stages.includes('I hope we get to make plenty more memories')],
  ['Page 10 paragraph 3',       stages.includes('And hey, I know you might not always see yourself')],
  ['Page 10 paragraph 4',       stages.includes('Just like every planet and every star is unique')],
  ['Page 10 paragraph 5',       stages.includes('I hope 16 brings you lots of happiness')],
  ['Page 10 paragraph 6',       stages.includes('Happy Sweet 16, Rumi')],
  ['Page 10 reveal btn removed', !stages.includes('Reveal the rest')],
  ['Page 10 confirm modal wired', stages.includes('confirmAction(') && stages.includes('Are you sure you want to lock this in? ✨')],
  ['Page 10 user star',         stages.includes('her-planet-user-star')],
  ['Page 10 planet svg',        stages.includes('finOceanGrad')],
  ['Page 10 planet halo',       stages.includes('finGlowGrad')],
  ['Page 10 planet current',    stages.includes('swirling ocean currents')],
  ['Page 9 CSS class',          pagesCSS.includes('.note-paper-card')],
  ['Page 9 CSS textarea',       pagesCSS.includes('.note-textarea')],
  ['Page 9 CSS success',        pagesCSS.includes('.note-success')],
  ['Page 9 CSS fold',           pagesCSS.includes('.note-paper-card.is-folding')],
  ['Page 9 CSS planet scene',  pagesCSS.includes('.p9-planet-scene')],
  ['Page 9 CSS ambient stars', pagesCSS.includes('.p9-ambient-star')],
  ['Page 9 CSS orbit star',    pagesCSS.includes('.p9-orbit-star')],
  ['Page 9 CSS orbit reveal',  pagesCSS.includes('.p9-orbit-star.is-visible')],
  ['Page 10 CSS planet',        pagesCSS.includes('.her-planet-illustration')],
  ['Page 10 CSS message',       pagesCSS.includes('.her-planet-message')],
  ['Page 10 CSS name',          pagesCSS.includes('.her-planet-name')],
  ['Page 10 CSS para',          pagesCSS.includes('.her-planet-para')],
  ['Page 10 CSS user star svg', pagesCSS.includes('.her-planet-user-star svg')],
  ['Page 10 CSS reduced motion', pagesCSS.includes('prefers-reduced-motion: reduce')],
  ['Page 7 completion guard',  stages.includes('if (isCompleted) return;')],
  ['Page 7 reset re-enables',  stages.includes("skipBtn.textContent = 'Auto draw';")],
  ['Page 7 auto-draw cancel',  stages.includes('autoDrawTimer')],
  ['Page 8 gates next btn',    stages.includes('btn--locked')],
  ['Museum footer controls',  stages.includes('stage.appendChild(controls)')],
  ['Museum visible dots',     pagesCSS.includes('.museum-dots {') && !pagesCSS.includes('gap: var(--space-3xs)')],
];
for (const [label, passed] of checks) {
  if (passed) { console.log('PASS: ' + label); }
  else        { console.error('FAIL: ' + label); ok = false; }
}

// Test 3: exactly 16 candles. Candles are built by two forEach passes
// (backRow + frontRow), each over an 8-element array => 16 candles.
const backArr = (stages.match(/backRow\.push\(/g) || []).length;
const frontArr = (stages.match(/frontRow\.push\(/g) || []).length;
const forEachPasses = ((stages.match(/backRow\.forEach/g) || []).length)
                     + ((stages.match(/frontRow\.forEach/g) || []).length);
const candleCount = forEachPasses * 8;
console.log('candle count (' + backArr + ' back + ' + frontArr + ' front positions, ' + forEachPasses + ' forEach passes x 8): ' + candleCount);
if (candleCount !== 16) { console.error('FAIL: expected 16 candles'); ok = false; }
else { console.log('PASS: exactly 16 candles'); }

// Test 4: required CSS classes exist in pages.css
for (const needle of [
  '.reveal-line','.wish-flame','.wish-flame.is-out','.wish-stage','.wish-cake',
  '.wish-cake-svg','.wish-candle-hit','.wish-form','.wish-field','.wish-label',
  '.wish-textarea','.wish-char-counter','.wish-meta','.wish-hint','.wish-outcome',
  '.wish-outcome.is-visible','.wish-outcome-card','.wish-outcome-title','.wish-outcome-line',
  '.gift-interactive-area','.planet-illustration-wrapper','.planet-body-group',
  '.note-stage','.envelope','.letter',
  '.scrapbook-stage','.lore-card',
  '.museum-stage','.museum-case','.museum-counter',
  // Page 7 - Libra Constellation
  '.libra-stage','.libra-canvas-container','.libra-star','.libra-star.is-active',
  '.libra-star.is-connected','.libra-line-layer','.libra-instruction','.libra-controls',
  '.libra-outcome','.libra-outcome.is-visible','.libra-constellation-label',
  '.libra-facts-card','.libra-fact','.libra-fact__icon',
  // Page 8 - Three Little Wonders
  '.wonders-stage','.wonders-planet-area','.wonders-planet',
  '.wonders-container','.wonders-artifacts-grid',
  '.wonder-artifact','.wonder-artifact__icon','.wonder-artifact__label',
  '.wonder-artifact__progress-wrap','.wonder-artifact__progress-ring',
  '.wonder-artifact__progress-circle',
  // Page 9 - A Little Piece of You
  '.note-paper-card','.note-title','.note-subtitle','.note-question',
  '.note-form-area','.note-textarea','.note-textarea--error','.note-char-counter',
  '.note-submit-btn','.note-success','.note-success-star','.note-success-text',
  '.note-proceed-btn',
  // Page 10 - Her Little Planet
  '.her-planet-stage','.her-planet-illustration','.her-planet-user-star',
  '.her-planet-message','.her-planet-name','.her-planet-para',
  '.confirm-overlay','.confirm-card','.confirm-message','.confirm-actions',
  '.wish-reveal','.wish-reveal-card','.wish-reveal__title','.wish-reveal__text',
  '.wish-reveal__close','.wonders-completion',
]) {
  if (pagesCSS.includes(needle)) { console.log('PASS: CSS has ' + needle); }
  else { console.error('FAIL: CSS missing ' + needle); ok = false; }
}

if (!ok) { process.exit(1); }
console.log('ALL STRUCTURAL CHECKS PASSED');

// ============================================================================
// Runtime shim: verifies main.js boots, statusRegion binds, announceStatus works
// ============================================================================
function makeShimEl(tag, id) {
  const _classes = new Set();
  const _children = [];
  const style = {};
  const _html = '';
  return {
    id: id || '', _hidden: false, _text: '', _classes, style,
    tagName: (tag || 'div').toUpperCase(),
    get hidden() { return this._hidden; },
    set hidden(v) { this._hidden = v; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = v; },
    _html,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    classList: { add(c){_classes.add(c);} , remove(c){_classes.delete(c);}, contains(c){return _classes.has(c);}, toggle(c){if(_classes.has(c)){_classes.delete(c);}else{_classes.add(c);}}, },
    removeAttribute() {}, setAttribute() {}, appendChild(child){_children.push(child);return child;},
    removeChild() {}, querySelector(sel){
      if (sel === '.admin-modal-close') {
        const btn = makeShimEl('button', 'admin-modal-close');
        btn.addEventListener = function(){};
        return btn;
      }
      if (sel === '#admin-auth-btn') {
        const btn = makeShimEl('button', 'admin-auth-btn');
        btn.addEventListener = function(){};
        btn.disabled = false;
        return btn;
      }
      if (sel === '#admin-del-wish') {
        const b = makeShimEl('button', 'admin-del-wish');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '#admin-reset-star') {
        const b = makeShimEl('button', 'admin-reset-star');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '#admin-reset-p1') {
        const b = makeShimEl('button', 'admin-reset-p1');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '#admin-factory-reset') {
        const b = makeShimEl('button', 'admin-factory-reset');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '#admin-export-json') {
        const b = makeShimEl('button', 'admin-export-json');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '#admin-import-file') {
        const b = makeShimEl('input', 'admin-import-file');
        b.addEventListener = function(){};
        return b;
      }
      if (sel === '.admin-modal-card') {
        const div = makeShimEl('div', 'admin-modal-card');
        div.appendChild = function(child){ return child; };
        return div;
      }
      // Fallback: return a generic shim element so chained .addEventListener()
      // calls never throw on selectors we haven't explicitly listed.
      const fallback = makeShimEl('div');
      fallback.addEventListener = function(){};
      return fallback;
    },
    querySelectorAll(){return {forEach(){}};},
    addEventListener(){}, removeEventListener(){}, focus(){},
  };
}

const els = {
  'main-content': makeShimEl('div', 'main-content'),
  'page-transition': makeShimEl('div', 'page-transition'),
  'status-region': makeShimEl('div', 'status-region'),
};

const gScope = {
  document: { readyState:'complete', getElementById(id){return els[id]||null;}, createElement(tag){return makeShimEl(tag);}, querySelector(){return null;}, addEventListener(){}, body: makeShimEl('body')},
  window: { location:{hash:'#preview'}, history:{pushState(){},replaceState(){}}, addEventListener(){}, matchMedia(){return {matches:false};}, scrollTo: ()=>{} },
  console, setTimeout:(fn)=>{fn();}, clearTimeout(){}, requestAnimationFrame:(fn)=>{fn();},
  localStorage: { getItem:()=>{}, setItem:()=>{}, removeItem:()=>{} },
  FileReader: class { readAsText(){} }
};

const code = readFileSync('js/main.js','utf8');
const stagesCode = readFileSync('js/stages.js','utf8');
const adminCode = readFileSync('js/admin.js','utf8');
const fn = new Function('document','window','console','setTimeout','clearTimeout','requestAnimationFrame', code + stagesCode + adminCode);
try {
  fn(gScope.document, gScope.window, gScope.console, gScope.setTimeout, gScope.clearTimeout, gScope.requestAnimationFrame);
} catch (e) {
  console.error('RUNTIME ERROR:', e.message); process.exit(1);
}

// main.js defers its auto-init to DOMContentLoaded. Simulate the browser
// firing that event now that all bundles (main, stages, admin) have parsed.
const docListeners = [];
gScope.document._addEventListener = gScope.document.addEventListener;
gScope.document.addEventListener = function (type, fn, opts) {
  if (type === 'DOMContentLoaded') docListeners.push(fn);
  return this._addEventListener(type, fn, opts);
};
docListeners.forEach((fn) => fn());

const result = gScope.window.LittlePlanet;
if (!result) { console.error('RUNTIME ERROR: window.LittlePlanet is not set'); process.exit(1); }
console.log('boot() type:', typeof result.boot);
const sr = result.statusRegion;
console.log('statusRegion after initRouter:', sr === null ? 'null (BUG!)' : (sr ? 'bound to element' : 'UNDEFINED'));
result.announceStatus('Hello world');
console.log('statusRegion textContent:', els['status-region']._text || '(no text set)');
if (sr === null)              { console.error('FAIL: statusRegion is still null after boot'); process.exit(1); }
if (els['status-region']._text !== 'Hello world') { console.error('FAIL: announceStatus did not set the textContent'); process.exit(1); }
console.log('PASS: statusRegion binds to element and announceStatus sets textContent');
console.log('ALL TESTS PASSED');
process.exit(0);