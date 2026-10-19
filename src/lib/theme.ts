/* =====================================================================
   LIGHT / DARK THEME
   The theme showing is a "data-theme" attribute on the <html> tag
   ("light" or "dark"); the stylesheets pick their colors from it.
   The CHOICE is one of three (on the Settings page):
   - "light" or "dark": always that
   - "system": follow the device's own light/dark setting, changing with
     it (like a phone that turns dark at night)
   The choice is saved as "theme", the same name the original site used.
   The little script in index.html applies it before the page first
   draws (anything other than "light" or "dark" follows the device).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageSet } from './storage';

// The two themes a page can show, and the three choices
export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

// The things to tell when the theme changes (like the switch, so it
// slides over, or the Settings page's choice, so it moves)
const listeners = new Set<() => void>();
function themeChanged(): void {
  for (const listener of listeners) listener();
}

// The device's own setting ("prefers-color-scheme" is how browsers say it)
const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

// The theme the page is showing right now
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// The choice saved on this device. Nothing saved (or anything odd)
// means "system", which is what index.html's script does then too.
export function currentThemeChoice(): ThemeChoice {
  const saved = storageGet('theme');
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

// Show a theme on the page (without saving anything)
function show(theme: Theme): void {
  if (theme === currentTheme()) return;
  document.documentElement.setAttribute('data-theme', theme);
}

// Save a choice and show it: "system" shows the device's setting now.
export function setThemeChoice(choice: ThemeChoice): void {
  storageSet('theme', choice);
  show(choice === 'system' ? (deviceDark.matches ? 'dark' : 'light') : choice);
  themeChanged();
}

// Switch the page to light or dark and remember it (the top bar's
// switch, before signing in).
export function applyTheme(theme: Theme): void {
  setThemeChoice(theme);
}

// When the device's own setting changes, follow it, if the choice is
// "system".
deviceDark.addEventListener('change', () => {
  if (currentThemeChoice() !== 'system') return;
  show(deviceDark.matches ? 'dark' : 'light');
  themeChanged();
});

// Start listening for theme changes. Returns a function that stops.
export function onThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
