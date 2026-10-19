/* =====================================================================
   THE SITE'S SETTINGS, FOR A PAGE
   A hook that gives a page the current settings (see lib/settings.ts),
   and draws the page again whenever they change (on the Settings page,
   or when they arrive from Google Drive).
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { currentSettings, onSettingsChange, settingsVersion } from '../lib/settings';

export function useSettings() {
  // "useSyncExternalStore" listens with onSettingsChange, and redraws
  // when settingsVersion() comes back different
  useSyncExternalStore(onSettingsChange, settingsVersion);
  return currentSettings();
}
