/* =====================================================================
   HELP PAGE
   Two columns: a skinny list of help topics on the left, and the wide
   instructions on the right (on a phone, the topics sit on top).
   The address picks what's shown: /help#binder-moving means "show the
   Binder pages instructions and scroll to Moving to another binder".
   Using the address means the browser's Back button steps back through
   the topics, and a link like /help#finder opens straight to one.
   The text itself is in help/helpTopics.tsx.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import ShortcutsDialog, { type Shortcut } from '../components/ShortcutsDialog';
import { useShortcutKeys } from '../hooks/useShortcutKeys';
import { helpTopics } from './help/helpTopics';
import styles from './HelpPage.module.css';

// The keys listed in this page's Keyboard shortcuts window (press ?)
const helpShortcuts: Shortcut[] = [
  { keys: <kbd>Tab</kbd>, does: 'Move to the next link (the topics on the left, then the instructions)' },
  { keys: <><kbd>Shift</kbd> + <kbd>Tab</kbd></>, does: 'Move back to the link before' },
  { keys: <kbd>Enter</kbd>, does: 'Open the topic or link' },
  { keys: <kbd>?</kbd>, does: 'Show this list' },
];

export default function HelpPage() {
  // "hash" is the end of the address after the "#" (like "#binder-moving").
  // "key" is new every time the address changes, even to the same value,
  // so clicking the same link twice still scrolls to it.
  const { hash, key } = useLocation();
  const targetId = decodeURIComponent(hash.slice(1));

  // Which topic to show: the one the address names, or the one holding
  // the section it names. If it names nothing we know, the first topic.
  const topic =
    helpTopics.find((t) => t.id === targetId || t.sections.some((s) => s.id === targetId))
    ?? helpTopics[0];
  // The section the address names, if it names one (not a whole topic)
  const sectionId = topic.sections.find((s) => s.id === targetId)?.id;

  // After drawing: a section was picked, so scroll it into view. A whole
  // topic was picked, so go back to the top, where its title is.
  useEffect(() => {
    if (sectionId) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [key, sectionId]);

  // Is the Keyboard shortcuts window open? The ? key opens it.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useShortcutKeys((event) => {
    if (event.key !== '?') return;
    event.preventDefault();
    setShortcutsOpen(true);
  });

  return (
    <div className={styles.layout}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>Help – WUBRG'r</title>

      {/* THE SKINNY LEFT COLUMN: each page of the site gets a link (bold),
          with links to that page's sections under it. aria-current marks
          the topic being shown and the section picked (for screen readers,
          and the stylesheet highlights them). */}
      <nav className={styles.nav} aria-label="Help topics">
        <h2 className={styles.navTitle}>Help</h2>
        <ul className={styles.topics}>
          {helpTopics.map((t) => (
            <li key={t.id} className={t.id === topic.id ? styles.open : undefined}>
              <Link
                className={styles.topicLink}
                to={{ hash: `#${t.id}` }}
                aria-current={t.id === topic.id ? 'true' : undefined}
              >
                {t.title}
              </Link>
              {/* The section links (only shown under the topic being shown) */}
              <ul className={styles.sections}>
                {t.sections.map((s) => (
                  <li key={s.id}>
                    <Link to={{ hash: `#${s.id}` }} aria-current={s.id === sectionId ? 'true' : undefined}>
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* THE WIDE RIGHT COLUMN: the instructions for the topic being shown */}
      <div className={styles.content}>
        <article id={topic.id} className={styles.article} aria-labelledby={`${topic.id}-title`}>
          <h2 id={`${topic.id}-title`}>{topic.title}</h2>
          <p className={styles.lead}>{topic.lead}</p>
          {/* One section per heading, each with its own id to link to */}
          {topic.sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h3>{s.title}</h3>
              {s.body}
            </section>
          ))}
        </article>
      </div>

      {/* The Keyboard shortcuts window (opens with the ? key) */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={helpShortcuts}
        note={
          <>
            Each page has its own keys: press <kbd>?</kbd> on My Binders, inside a binder
            or on the MTG Card Finder to see them.
          </>
        }
      />
    </div>
  );
}
