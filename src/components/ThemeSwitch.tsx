/* =====================================================================
   THE LIGHT/DARK SWITCH
   A pill-shaped switch with a sun on one end and a moon on the other,
   and a round knob that slides between them. It always shows the theme
   the page is in now (and slides if the theme changes elsewhere).
   Used in the top bar (before signing in) and on the Settings page.
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { currentTheme, onThemeChange, type Theme } from '../lib/theme';
import styles from './ThemeSwitch.module.css';

type Props = {
  // What to do with the new theme when the switch is clicked
  onChange: (theme: Theme) => void;
  // The words screen readers say for the switch ("Dark mode" unless given)
  label?: string;
  id?: string;
};

export default function ThemeSwitch({ onChange, label = 'Dark mode', id }: Props) {
  // The theme showing now. "useSyncExternalStore" redraws the switch
  // whenever the theme changes (see lib/theme.ts).
  const theme = useSyncExternalStore(onThemeChange, currentTheme);

  return (
    // role="switch" + aria-checked tell screen readers it's an on/off
    // control ("on" here means dark mode)
    <button
      id={id}
      className={styles.themeSwitch}
      type="button"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label={label}
      onClick={() => onChange(theme === 'dark' ? 'light' : 'dark')}
    >
      {/* Sun icon (light mode side) */}
      <svg className={`${styles.icon} ${styles.sun}`} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
      </svg>
      {/* Moon icon (dark mode side) */}
      <svg className={`${styles.icon} ${styles.moon}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
      </svg>
      {/* The sliding round knob */}
      <span className={styles.thumb} />
    </button>
  );
}
