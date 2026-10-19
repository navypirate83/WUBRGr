/* =====================================================================
   FOOTER: LINKS TO EVERY PAGE
   In the middle: "Home" (the welcome page), "Binders" (your shelf of
   binders), the binder's name (on a binder page, and on the Search page
   when it was opened from a binder), "Search" (the MTG Card Finder) and
   "Help".
   At the far right: "Sign out", or "Sign in with Google" when using the
   site locally ("Sign in" on a phone).
   "Binders", the binder's name and the sign in/out link only show to
   someone using the binders (signed in, or using the site locally).
   ===================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAccount } from '../hooks/useAccount';
import { initGoogleSignIn, signInWithGoogle, signOutAndForget, uploadLocalBinders } from '../lib/googleDrive';
import { binderName } from '../lib/binderStorage';
import styles from './Footer.module.css';

// Which Help topic goes with the page you're on, so "Help" opens to the
// instructions for that page (the ids are in pages/help/helpTopics.tsx).
function helpTopicFor(pathname: string): string {
  if (pathname.startsWith('/search')) return 'finder';
  if (pathname.startsWith('/binders/')) return 'binder';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'my-binders';
}

export default function Footer() {
  const { usingBinders, localMode } = useAccount();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // On a binder page (/binders/<id>), its name is the page you're on, and
  // the Search link carries the binder along ("?binder=<id>"), so "+"
  // over there adds to it. The Search page opened from a binder has
  // "?binder=<id>" in its address: then a link goes back to that binder.
  const onBinder = /^\/binders\/([^/]+)/.exec(pathname);
  const thisBinder = onBinder ? decodeURIComponent(onBinder[1]) : null;
  const fromBinder = thisBinder ?? (pathname.startsWith('/search') ? params.get('binder') : null);
  const searchTo = thisBinder ? `/search?binder=${encodeURIComponent(thisBinder)}` : '/search';

  // While signing in or out: the words the link shows instead
  const [busyText, setBusyText] = useState<string | null>(null);

  // Using the site locally: get Google's sign-in ready now, so clicking
  // "Sign in with Google" can open Google's window straight away
  // (browsers only allow pop-ups right after a click).
  useEffect(() => {
    if (localMode) initGoogleSignIn().catch(() => { /* the click explains */ });
  }, [localMode]);

  // Clicking the link at the bottom right:
  //  - "Sign in with Google" (local use): sign in, upload this device's
  //    binders to Google Drive, then show the whole collection.
  //  - "Sign out": save any unsaved changes, sign out, forget the binders
  //    in this browser, then go to the welcome page.
  async function handleAccountClick() {
    if (localMode) {
      setBusyText('Signing in…');
      try {
        await signInWithGoogle();
        setBusyText('Uploading your binders…');
        await uploadLocalBinders();
        setBusyText(null);
        navigate('/binders');
      } catch (err) {
        setBusyText(null);
        alert((err as Error).message);
      }
      return;
    }
    setBusyText('Signing out…');
    const signedOut = await signOutAndForget();
    setBusyText(null);
    if (signedOut) navigate('/', { state: { message: 'You\'re signed out.' } });
  }

  /* ----- Keeping the links centered ----- */
  // Normally the links are exactly centered, with the sign in/out link at
  // the far right. That needs room on BOTH sides of the links for it.
  // When the window is too narrow, the footer becomes one centered row
  // with that link at the end ("compact"), so it always fits on one line.
  const footerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const footer = footerRef.current!;
    // Try the normal layout, and switch to the compact one if it doesn't fit.
    function fit() {
      footer.classList.remove(styles.compact);
      const style = getComputedStyle(footer);
      const room = footer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 0;
      const accountWidth = accountRef.current?.getBoundingClientRect().width ?? 0;
      const needed = linksRef.current!.scrollWidth + 2 * (accountWidth + gap);
      const tooNarrow = needed > room + 0.5;
      footer.classList.toggle(styles.compact, tooNarrow);
      setCompact(tooNarrow);
    }
    fit();
    // Fit again whenever the footer changes size (the window resizing).
    const observer = new ResizeObserver(fit);
    observer.observe(footer);
    return () => observer.disconnect();
  });

  // The Help link's address: on the Help page itself, just /help
  const helpTo = pathname.startsWith('/help') ? '/help' : `/help#${helpTopicFor(pathname)}`;

  return (
    <footer ref={footerRef} className={`${styles.footer} ${compact ? styles.compact : ''}`}>
      <nav aria-label="All pages">
        <ul ref={linksRef} className={styles.links}>
          {/* NavLink is a link that knows when its page is the one being
              shown: then it adds aria-current="page", which tells screen
              readers (and the stylesheet) "you are here". "end" means the
              link only counts for its exact address. */}
          <li><NavLink to="/" end>Home</NavLink></li>
          {usingBinders && <li><NavLink to="/binders" end>Binders</NavLink></li>}
          {usingBinders && fromBinder && (
            <li><NavLink to={`/binders/${encodeURIComponent(fromBinder)}`}>{binderName(fromBinder)}</NavLink></li>
          )}
          {/* (On the Search page itself, it's the current page) */}
          <li><NavLink to={searchTo}>Search</NavLink></li>
          {/* Help shows on every page, even before signing in */}
          <li><NavLink to={helpTo}>Help</NavLink></li>
        </ul>
      </nav>

      {/* "Sign out", or "Sign in with Google" (with a shorter "Sign in"
          that phones show, so the footer fits on one line) */}
      {usingBinders && (
        <button
          ref={accountRef}
          className={styles.account}
          type="button"
          disabled={busyText !== null}
          aria-label={localMode && !busyText ? 'Sign in with Google' : undefined}
          onClick={handleAccountClick}
        >
          {busyText ?? (localMode
            ? <><span className={styles.labelLong}>Sign in with Google</span><span className={styles.labelShort}>Sign in</span></>
            : 'Sign out')}
        </button>
      )}
    </footer>
  );
}
