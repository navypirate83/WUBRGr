/* =====================================================================
   KEYBOARD SHORTCUTS WINDOW
   A pop-up window listing a page's keys. Every page that has keyboard
   shortcuts uses this: it passes in its own list of keys, an optional
   line above the list and note under it, and whether the window is open
   (the page opens it with the ? key, or a button).
   ===================================================================== */

import type { ReactNode } from 'react';
import Modal from './Modal';
import styles from './ShortcutsDialog.module.css';

// One line of the list: the key(s) to press, and what they do
export type Shortcut = {
  keys: ReactNode;
  does: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  intro?: ReactNode;
  note?: ReactNode;
};

export default function ShortcutsDialog({ open, onClose, shortcuts, intro, note }: Props) {
  // Drawn only while open (Modal opens the window as soon as it's drawn,
  // and calls onClose when Close, Escape or a click outside shuts it)
  if (!open) return null;
  return (
    <Modal labelledBy="shortcutsTitle" onClose={onClose}>
      {/* method="dialog" means the Close button just closes the window */}
      <form method="dialog">
        <h2 id="shortcutsTitle" className={styles.title}>Keyboard shortcuts</h2>

        {/* The line above the list (if the page gave one) */}
        {intro && <p className={styles.intro}>{intro}</p>}

        {/* A list of keys (<dt>) and what each one does (<dd>) */}
        <dl className={styles.list}>
          {shortcuts.map((shortcut) => (
            <div key={shortcut.does} className={styles.row}>
              <dt>{shortcut.keys}</dt>
              <dd>{shortcut.does}</dd>
            </div>
          ))}
        </dl>

        {/* The note under the list (if the page gave one) */}
        {note && <p className={styles.note}>{note}</p>}

        {/* The Close button, on the right */}
        <div className={styles.buttons}>
          <button className={styles.primaryButton} type="submit" value="close">Close</button>
        </div>
      </form>
    </Modal>
  );
}
