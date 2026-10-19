/* =====================================================================
   THE SITE'S SETTINGS
   The choices on the Settings page:
   - theme: dark, light, or "system" (follow the device's own setting)
   - hiddenFormats: the formats NOT to show in the Search page's Format
     Legality box (the codes, like "pauper"). It lists the hidden ones,
     rather than the shown ones, so a new format Scryfall adds later
     shows up without anyone having to tick it.
   To add a new setting:
     1. add it to the Settings type and DEFAULT_SETTINGS below
     2. read it in currentSettings (from this device) and fromFile (from
        Drive), checking it's a sensible value
     3. keep it on this device in applySettings (and put it into effect
        there, if it changes how the page looks)
     4. add its control to the Settings page (pages/settings)
   Where they're saved:
   - always on this device (so the page is right from the first moment)
   - signed in with Google: also in "WUBRGr settings.json" in the
     "MTG Card Binder" folder in Google Drive, so they follow you to other
     computers and phones. A change made while the Google sign-in has run
     out is marked "needs saving" and sent the next time you're signed in.
   - using the site locally: on this device only.
   Pages that use a setting follow changes with hooks/useSettings.ts.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { currentThemeChoice, setThemeChoice, type ThemeChoice } from './theme';
import { storageGet, storageRemove, storageSet } from './storage';
import { isLocalMode } from './binderStorage';
import { isSignedIn, readSettingsFile, writeSettingsFile } from './googleDrive';

// Every setting, and what each one starts as. ("theme" is the choice:
// dark, light, or "system" to follow the device's own setting.)
export type Settings = {
  theme: ThemeChoice;
  hiddenFormats: string[];
};
const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  hiddenFormats: [],
};

// A label written into the settings file, so it's clear what it is, and
// a version number in case its layout changes later
const SETTINGS_APP = 'wubrgr-settings';
const SETTINGS_VERSION = 1;

// Where things are kept on this device: the "needs saving to Drive"
// marker, and the hidden formats (the theme has its own "theme")
const DIRTY_KEY = 'settingsDirty';
const HIDDEN_FORMATS_KEY = 'hiddenFormats';

/* ---------------------------------------------------------------------
   TELLING PAGES ABOUT CHANGES
   --------------------------------------------------------------------- */

// A number that goes up with every change, and the functions to call
let version = 0;
const listeners = new Set<() => void>();
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function settingsVersion(): number {
  return version;
}
function settingsChanged(): void {
  version++;
  for (const listener of listeners) listener();
}

/* ---------------------------------------------------------------------
   ON THIS DEVICE
   --------------------------------------------------------------------- */

// Keep only a list of short codes (anything else counts as "none hidden")
function cleanCodes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length < 40) : [];
}

// The settings as they are now on this device
export function currentSettings(): Settings {
  let hidden: unknown = [];
  try { hidden = JSON.parse(storageGet(HIDDEN_FORMATS_KEY) ?? '[]'); } catch { /* unreadable: none hidden */ }
  return { ...DEFAULT_SETTINGS, theme: currentThemeChoice(), hiddenFormats: cleanCodes(hidden) };
}

// Put settings into effect on this device, remember them here, and tell
// the pages that use them
function applySettings(settings: Settings): void {
  if (settings.theme !== currentThemeChoice()) setThemeChoice(settings.theme);
  storageSet(HIDDEN_FORMATS_KEY, JSON.stringify(settings.hiddenFormats));
  settingsChanged();
}

/* ---------------------------------------------------------------------
   IN GOOGLE DRIVE
   --------------------------------------------------------------------- */

// Pick the settings out of a settings file, keeping only sensible
// values (anything missing or odd keeps its current value)
function fromFile(data: Record<string, unknown>): Settings {
  const settings = currentSettings();
  if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') settings.theme = data.theme;
  if (Array.isArray(data.hiddenFormats)) settings.hiddenFormats = cleanCodes(data.hiddenFormats);
  return settings;
}

// What's written into the settings file
function toFile(settings: Settings): Record<string, unknown> {
  return { app: SETTINGS_APP, version: SETTINGS_VERSION, ...settings, savedAt: new Date().toISOString() };
}

// Saves to Drive happen one at a time, in order ("chain" is the last one
// waiting), each sending the settings as they are when its turn comes.
// So quick changes (like ticking several boxes) can't overlap, and the
// settings file is never made twice.
let chain: Promise<void> = Promise.resolve();
function saveToDrive(): Promise<void> {
  const run = chain.then(async () => {
    await writeSettingsFile(toFile(currentSettings()));
    storageRemove(DIRTY_KEY);
  });
  chain = run.catch(() => { /* the caller hears about the problem */ });
  return run;
}

// Where a change was saved, for the Settings page to say
export type SavedWhere = 'drive' | 'device' | 'not-yet';

// Change some settings: put them into effect straight away, then save
// them to Google Drive (when signed in). Resolves with where they were
// saved; if Drive couldn't be reached, they're kept on this device and
// marked "needs saving" (and the error is passed on).
export async function changeSettings(changes: Partial<Settings>): Promise<SavedWhere> {
  applySettings({ ...currentSettings(), ...changes });
  if (isLocalMode()) return 'device';
  storageSet(DIRTY_KEY, 'yes');
  if (!isSignedIn()) return 'not-yet';
  await saveToDrive();
  return 'drive';
}

// Bring the settings up to date with Google Drive (after signing in, or
// when a page opens while signed in):
// - a change on this device that hasn't reached Drive yet: SEND it
// - otherwise: FETCH the settings from Drive (they may have been changed
//   on another computer) and put them into effect here
// (Not signed in, or used locally: nothing to do.)
export async function syncSettings(): Promise<void> {
  if (isLocalMode() || !isSignedIn()) return;
  if (storageGet(DIRTY_KEY)) {
    await saveToDrive();
    return;
  }
  const data = await readSettingsFile();
  if (data) applySettings(fromFile(data));
}
