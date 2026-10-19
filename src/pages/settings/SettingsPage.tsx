/* =====================================================================
   SETTINGS
   The site's settings, in sections (boxes with a heading). Each setting
   is one row: its name and a short explanation on the left, its control
   on the right (see SettingRow), or, for a bigger control, underneath
   (see SettingBlock). The sections so far:
   - Appearance: the theme (Dark, System or Light)
   - Search: which formats show in the Format Legality box
   TO ADD A SETTING: add it in lib/settings.ts first (see the steps at
   the top of that file), then add a SettingRow for it below, in the
   section it belongs to (or in a new SettingsSection).
   Only for someone using the binders (signed in, or using the site
   locally): anyone else goes to the welcome page.
   ===================================================================== */

import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAccount } from '../../hooks/useAccount';
import { useSettings } from '../../hooks/useSettings';
import type { ThemeChoice } from '../../lib/theme';
import { changeSettings, type Settings } from '../../lib/settings';
import { FORMAT_NAMES } from '../../lib/cards';
import styles from './SettingsPage.module.css';

/* ---------------------------------------------------------------------
   THE PIECES OF THE PAGE (reused by every section and setting)
   --------------------------------------------------------------------- */

// A section: a box with a heading, holding its settings' rows
function SettingsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// One setting: its name (a label for the control, so clicking the name
// works too) and explanation on the left, its control on the right
function SettingRow({ controlId, name, description, children }: {
  controlId: string;
  name: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        {/* (Its id lets a group of controls, like the theme's three
            choices, use it as their name too) */}
        <label id={`${controlId}-name`} className={styles.rowName} htmlFor={controlId}>{name}</label>
        <p className={styles.rowDescription}>{description}</p>
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

// A setting with a bigger control (like a list of checkboxes): its name
// and explanation on top, the control underneath, across the whole width.
// The name is a heading for the group (screen readers announce it).
function SettingBlock({ id, name, description, children }: {
  id: string;
  name: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.row} role="group" aria-labelledby={`${id}-name`}>
      <div className={styles.blockBody}>
        <p id={`${id}-name`} className={styles.rowName}>{name}</p>
        <p className={styles.rowDescription}>{description}</p>
        {children}
      </div>
    </div>
  );
}

// The theme choice: Dark, System (follow the device) or Light, side by
// side as one rounded bar, the chosen one filled in. They're radio
// buttons (only one can be picked), drawn as buttons: the arrow keys move
// between them, as with any radio group.
const THEME_CHOICES: { value: ThemeChoice; name: string; icon: ReactNode }[] = [
  {
    value: 'dark', name: 'Dark',
    // A moon
    icon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" fill="currentColor" stroke="none" />,
  },
  {
    value: 'system', name: 'System',
    // A computer screen on a stand
    icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  },
  {
    value: 'light', name: 'Light',
    // A sun
    icon: <><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  },
];
function ThemeChoicePicker({ value, onChange }: { value: ThemeChoice; onChange: (choice: ThemeChoice) => void }) {
  return (
    <div className={styles.segments} role="radiogroup" aria-labelledby="themeSetting-name">
      {THEME_CHOICES.map((choice) => (
        <label key={choice.value} className={styles.segment}>
          <input
            type="radio"
            name="themeChoice"
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {choice.icon}
          </svg>
          {choice.name}
        </label>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------
   THE PAGE
   --------------------------------------------------------------------- */

export default function SettingsPage() {
  const { usingBinders, signedIn, localMode } = useAccount();
  // The settings as they are now (redrawn when one changes)
  const settings = useSettings();

  // Show (tick) or hide (untick) one format in the Format Legality box.
  function toggleFormat(code: string, show: boolean) {
    const hidden = settings.hiddenFormats.filter((c) => c !== code);
    change({ hiddenFormats: show ? hidden : [...hidden, code] });
  }

  // The line under the heading: where the settings are saved, then (after
  // a change) whether it worked
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const savedWhere = localMode ? 'Your settings are saved on this device.'
    : 'Your settings are saved in your Google Drive, so they follow you to other computers and phones.';

  // Change a setting (or several), then say where it was saved.
  async function change(changes: Partial<Settings>) {
    setStatus({ text: 'Saving…' });
    try {
      const where = await changeSettings(changes);
      setStatus({
        text: where === 'drive' ? '✓ Saved to Google Drive'
          : where === 'device' ? '✓ Saved on this device'
            : 'Saved on this device. It will be saved to Google Drive the next time you sign in.',
      });
    } catch (err) {
      setStatus({ text: `Saved on this device, but not to Google Drive yet. ${(err as Error).message}`, error: true });
    }
  }

  // Not using the binders: there's nothing to save settings to yet
  if (!usingBinders) return <Navigate to="/" replace />;

  return (
    <div className={styles.page}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>Settings – WUBRG'r</title>

      <h2 className={styles.pageTitle}>Settings</h2>
      <p className={styles.savedWhere}>{signedIn || localMode ? savedWhere : 'Sign in again (bottom right) to save your settings to Google Drive.'}</p>
      {/* Whether the last change was saved (read out by screen readers) */}
      <p className={`${styles.status} ${status?.error ? styles.error : ''}`} role="status">{status?.text}</p>

      {/* APPEARANCE: how the site looks */}
      <SettingsSection id="appearance" title="Appearance">
        <SettingRow controlId="themeSetting" name="Theme"
                    description="Dark or light colors, or System to match your device's own setting.">
          <ThemeChoicePicker value={settings.theme} onChange={(theme) => change({ theme })} />
        </SettingRow>
      </SettingsSection>

      {/* SEARCH: the MTG Card Finder */}
      <SettingsSection id="search" title="Search">
        <SettingBlock id="formatSetting" name="Format legality display"
                      description="Pick which formats show in a card's Format Legality box. Unticked ones are left out.">
          {/* One checkbox per format, in a grid. Ticked = shown. */}
          <div className={styles.checkGrid}>
            {FORMAT_NAMES.map(([code, name]) => (
              <label key={code} className={styles.check}>
                <input
                  type="checkbox"
                  checked={!settings.hiddenFormats.includes(code)}
                  onChange={(event) => toggleFormat(code, event.target.checked)}
                />
                {name}
              </label>
            ))}
          </div>
          {/* Tick or untick every format at once */}
          <div className={styles.checkButtons}>
            <button type="button" className={styles.smallButton} onClick={() => change({ hiddenFormats: [] })}>
              Show all
            </button>
            <button type="button" className={styles.smallButton}
                    onClick={() => change({ hiddenFormats: FORMAT_NAMES.map(([code]) => code) })}>
              Hide all
            </button>
          </div>
        </SettingBlock>
      </SettingsSection>

      {/* More sections go here as the site grows */}
    </div>
  );
}
