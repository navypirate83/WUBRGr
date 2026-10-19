/* =====================================================================
   HOME: THE WELCOME PAGE
   A picture of an open binder full of cards, then:
   - signed out: "Sign in with Google" and "Skip login, local use only"
   - signed in (or using the site locally): where the binders are kept,
     and a "Go to your binders" link
   It's laid out in three rows: the picture at the top, the box in the
   middle (centered on the page) and an empty row at the bottom the same
   height as the top one, which is what keeps the box centered.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAccount } from '../../hooks/useAccount';
import { initGoogleSignIn, signInWithGoogle } from '../../lib/googleDrive';
import { binderDirtyStamp, clearAllBinders, loadBinderList, setLocalMode } from '../../lib/binderStorage';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { signedIn, localMode } = useAccount();
  const navigate = useNavigate();
  // Another page can send a message to show here, like "You're signed out."
  const location = useLocation();
  const [message, setMessage] = useState<string>(location.state?.message ?? '');
  const [busy, setBusy] = useState(false);
  const welcomeBack = signedIn || localMode;

  // Signed out: get Google's sign-in ready now, so clicking the button
  // can open Google's window straight away. If it can't load, say why.
  useEffect(() => {
    if (!welcomeBack) initGoogleSignIn().catch((err: Error) => setMessage(err.message));
  }, [welcomeBack]);

  // "Sign in with Google": open Google's sign-in window. Once signed in,
  // show the binders.
  async function signIn() {
    setMessage('');
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate('/binders');
    } catch (err) {
      setMessage((err as Error).message);
      setBusy(false);
    }
  }

  // "Skip login, local use only": use the site without signing in, with
  // the binders saved on this device only. If this browser still has
  // binders from someone's Google account (their sign-in ran out but they
  // never signed out), those belong in Drive, not here: forget them first
  // (asking before losing changes not yet saved to Drive).
  function skipLogin() {
    const leftover = loadBinderList();
    if (leftover.some((b) => binderDirtyStamp(b.id)) &&
        !confirm('This browser has binder changes that haven\'t been saved to Google Drive yet. ' +
                 'Using the app locally will forget them. Continue?')) {
      return;
    }
    clearAllBinders();
    setLocalMode(true);
    navigate('/binders');
  }

  return (
    <section className={styles.signIn} aria-labelledby="signInTitle">
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>WUBRG'r</title>

      {/* The open binder full of cards. alt="" because it's only
          decoration: the heading below says what the page is. */}
      <img className={styles.art} src={`${import.meta.env.BASE_URL}images/open-binder.png`} alt=""
           width="760" height="458" />

      {/* The box: heading, explanation, buttons and messages */}
      <div className={styles.box}>
        <h2 id="signInTitle" className={styles.title}>Your Magic card binders</h2>
        <p className={styles.text}>
          {!welcomeBack
            ? 'Sign in with your Google account. Your binders are saved in your own Google Drive, so you can open them on any computer or phone.'
            : localMode
              ? 'Your binders are saved on this device. Sign in with Google (bottom right) any time to keep them in your Google Drive too.'
              : 'You\'re signed in. Your binders are saved in your own Google Drive, so you can open them on any computer or phone.'}
        </p>

        {welcomeBack ? (
          // Already signed in (or using the site locally): a link to the shelf
          <p className={styles.goToBinders}><Link to="/binders">Go to your binders →</Link></p>
        ) : (
          <>
            {/* "Sign in with Google", styled the way Google asks: white,
                with Google's colored "G" logo */}
            <button className={styles.googleButton} type="button" disabled={busy} onClick={signIn}>
              {/* Google's "G" logo, drawn in its four colors */}
              <svg className={styles.googleLogo} viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Sign in with Google
            </button>

            {/* Use the site without signing in: a button that looks like a link */}
            <p className={styles.skipLogin}>
              <button className={styles.skipLoginButton} type="button" onClick={skipLogin}>
                Skip login, local use only
              </button>
            </p>

            {/* Messages about signing in (for example if it was cancelled) */}
            <p className={styles.message} role="status">{message}</p>
          </>
        )}
      </div>
    </section>
  );
}
