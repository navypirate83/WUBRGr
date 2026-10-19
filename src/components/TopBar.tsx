/* =====================================================================
   TOP BAR
   On the left: the back button and the app's name. On the right: the
   Settings button for someone using the binders (signed in, or using the
   site locally), or the light/dark switch for anyone else. The same on
   every page.
   ===================================================================== */

import { Link, useLocation, useNavigate } from 'react-router';
import { applyTheme } from '../lib/theme';
import { useAccount } from '../hooks/useAccount';
import ThemeSwitch from './ThemeSwitch';
import styles from './TopBar.module.css';

// The id of the empty box in the middle of the top bar, where a page can
// put its own things (with React's "createPortal")
export const TOPBAR_TOOLS_ID = 'topbar-tools';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usingBinders } = useAccount();

  // BACK BUTTON: is there an earlier page in this app to go back to?
  // React Router gives the very first page you opened the key "default";
  // every page you go to after that gets a new key. So "default" means
  // you started here (from a bookmark, a typed address or another site),
  // and the button is greyed out.
  const canGoBack = location.key !== 'default';
  const onSettings = location.pathname.startsWith('/settings');

  return (
    <header className={styles.topbar}>
      {/* The back button and the title, side by side */}
      <div className={styles.titleGroup}>
        {/* Goes back one page, like the browser's own Back button
            (navigate(-1) means "one step back in the history") */}
        <button
          className={styles.backButton}
          type="button"
          aria-label="Go back to the previous page"
          title={canGoBack ? 'Back' : 'There\'s no earlier page to go back to'}
          disabled={!canGoBack}
          onClick={() => navigate(-1)}
        >
          {/* A left-pointing arrow */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>

        {/* The app's name, "WUBRG'r", with the W, U, B, R and G in their
            Magic colors. aria-label gives screen readers the whole name at
            once, instead of letter by letter. */}
        <h1 className={styles.title} aria-label="WUBRG'r">
          <span className={styles.manaW}>W</span>
          <span className={styles.manaU}>U</span>
          <span className={styles.manaB}>B</span>
          <span className={styles.manaR}>R</span>
          <span className={styles.manaG}>G</span>'r
        </h1>
      </div>

      {/* The middle of the top bar: empty on most pages. A page can put
          its own things here (the binder page shows where it's saved),
          by drawing them into this box (see TOPBAR_TOOLS_ID). */}
      <div id={TOPBAR_TOOLS_ID} className={styles.tools} />

      {/* The right end of the bar */}
      <div className={styles.right}>
        {usingBinders ? (
          // The Settings button: a round gear, like the back button. On the
          // Settings page itself, aria-current says "you are here" (and the
          // stylesheet colors it).
          <Link
            to="/settings"
            className={styles.settingsButton}
            aria-label="Settings"
            title="Settings"
            aria-current={onSettings ? 'page' : undefined}
          >
            {/* A gear */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        ) : (
          // Not signed in: the light/dark switch, saved on this device
          <ThemeSwitch onChange={applyTheme} />
        )}
      </div>
    </header>
  );
}
