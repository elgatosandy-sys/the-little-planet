/**
 * tools/apply_palette.mjs
 *
 * Rewrites hardcoded hex colors in styles/pages.css so every color resolves
 * through the cosmic burgundy-and-cream palette defined in
 * styles/design-tokens.css.
 *
 * All values are CSS custom properties for runtime access
 * and theme adaptability.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'styles/pages.css';
let src = readFileSync(FILE, 'utf8');
const original = src;

// 1:1 palette mapping for decorative / non-text colors (ALL LOWERCASE KEYS).
const palette = {
  // Cosmic deep background
  '#17151b': 'var(--color-charcoal)',
  '#17151b': 'var(--color-charcoal)',
  // Cosmic midground / paper text
  '#482630': 'var(--color-burgundy)',
  // Buttons, borders, accents
  '#d7a3ad': 'var(--color-dusty-pink)',
  // Paper backgrounds
  '#f1e7dc': 'var(--color-warm-cream)',
  // Focus ring, sparkles
  '#d4af7f': 'var(--color-gold)',
  // Soft lavender accent
  '#9b8cb8': 'var(--color-lavender)',
  // Muted pink-violet accent
  '#a88b9e': 'var(--color-pink-violet)',
  // Planet / success green
  '#6b8e6b': 'var(--color-planet-green)',
};

// Text colors that must resolve to the accessible body-text token.
const textColors = new Set(['#2c252b', '#584f57']);
const disabledColors = new Set(['#9a8f98']);

// Replace every remaining hex literal.
const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
let replaced = 0;
src = src.replace(hexRe, (hex) => {
  const lower = hex.toLowerCase();
  if (lower === '#ffffff') return hex; // keep pure white
  if (disabledColors.has(lower)) {
    replaced++;
    return 'var(--color-text-disabled)';
  }
  if (textColors.has(lower)) {
    replaced++;
    return 'var(--color-burgundy)';
  }
  if (palette[lower]) {
    replaced++;
    return palette[lower];
  }
  // Unknown hex — leave untouched so we don't silently break anything.
  return hex;
});

if (src === original) {
  console.log('No changes made.');
} else {
  writeFileSync(FILE, src, 'utf8');
  console.log(`Replaced ${replaced} hex literals in ${FILE}.`);
}