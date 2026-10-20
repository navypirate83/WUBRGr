/* =====================================================================
   THE MY BINDERS WINDOWS
   - Binder properties: rename a binder, change how many pages it has,
     and change its cover symbol and cover color (opens when a binder is
     dropped on the pencil circle, or with the E key).
   - Delete this binder?: asks first (opens when a binder is dropped on
     the red X circle, or with the Delete key).
   (The New binder window is in components/binders, since the Search page
   uses it too.)
   ===================================================================== */

import { useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { CoverChoices, NameField, SymbolChoices } from '../../components/binders/BinderChoices';
import {
  NAME_LIMIT, POCKETS_PER_PAGE, cardCountText, cleanCover, minPagesFor, type Binder,
} from '../../lib/binderStorage';
import styles from '../../components/binders/BinderWindows.module.css';

/* ---------------------------------------------------------------------
   BINDER PROPERTIES
   --------------------------------------------------------------------- */

// What "Save" hands back to the page
export type BinderChanges = { name: string; color: string | null; cover: string; pages: number };

export function BinderPropertiesDialog({ binder, cardCount, onSave, onCancel }: {
  binder: Binder;
  cardCount: number;
  onSave: (changes: BinderChanges) => void;
  onCancel: () => void;
}) {
  // The window starts filled in with the binder's current details
  const [name, setName] = useState(binder.name.slice(0, NAME_LIMIT));
  const [pagesText, setPagesText] = useState(String(binder.pages));
  const [symbol, setSymbol] = useState(binder.color ?? '');
  const [cover, setCover] = useState(cleanCover(binder.cover));
  const nameRef = useRef<HTMLInputElement>(null);

  // The Pages box can't go below the fewest pages its cards need (there's
  // no most). The browser won't let Save go ahead with a smaller number
  // (the box's "min").
  const min = minPagesFor(cardCount);
  const pages = Number(pagesText);
  const ok = Number.isInteger(pages) && pages >= min;
  // The note beside the box: how many cards that many pages hold, and
  // the fewest allowed, or (in red) why the number isn't allowed
  const range = `at least ${min} page${min === 1 ? '' : 's'}`;
  const note = !Number.isInteger(pages) || pages < 1 ? `Enter a number (${range}).`
    : pages < min ? `Too few: its cards need ${range}.`
      : `Holds ${(pages * POCKETS_PER_PAGE).toLocaleString()} cards · ${range}`;

  // When the window closes with "Save", hand the changes to the page.
  // (A blank name or too few pages can't get here: the boxes are
  // "required" with limits, so the browser stops Save.)
  function handleClose(returnValue: string) {
    const trimmed = name.trim().slice(0, NAME_LIMIT);
    if (returnValue === 'save' && trimmed) {
      onSave({ name: trimmed, color: symbol || null, cover, pages: Math.max(min, Math.round(pages)) });
    } else {
      onCancel();
    }
  }

  return (
    <Modal labelledBy="editBinderTitle" onClose={handleClose} onOpened={() => nameRef.current?.select()}>
      <form method="dialog">
        <h2 id="editBinderTitle" className={styles.title}>Binder properties</h2>
        <NameField id="binderNameInput" value={name} onChange={setName} inputRef={nameRef} />

        {/* How many pages the binder has: a number box (with up/down
            arrows), and the note explaining the limits */}
        <label className={styles.fieldLabel} htmlFor="binderPagesInput">Pages</label>
        <div className={styles.pagesField}>
          <input
            id="binderPagesInput"
            className={styles.pagesInput}
            type="number"
            step={1}
            min={min}
            inputMode="numeric"
            required
            aria-describedby="pagesNote"
            value={pagesText}
            onChange={(event) => setPagesText(event.target.value)}
          />
          <span id="pagesNote" className={`${styles.pagesNote} ${ok ? '' : styles.error}`}>{note}</span>
        </div>

        <SymbolChoices group="editColor" legend="Cover symbol" value={symbol} onChange={setSymbol} />
        <CoverChoices group="editCover" value={cover} onChange={setCover} />

        {/* "Save" comes first so Enter saves (it shows on the right) */}
        <div className={styles.buttons}>
          <button value="save" className={`${styles.button} ${styles.primary}`} type="submit">Save</button>
          <button value="cancel" className={styles.button} type="submit" formNoValidate>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------
   DELETE THIS BINDER?
   --------------------------------------------------------------------- */

export function DeleteBinderDialog({ binder, cardCount, localMode, onDelete, onCancel }: {
  binder: Binder;
  cardCount: number;
  localMode: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal labelledBy="deleteBinderTitle" onClose={(value) => (value === 'yes' ? onDelete() : onCancel())}>
      <form method="dialog">
        <h2 id="deleteBinderTitle" className={styles.title}>Delete this binder?</h2>
        {/* Signed in, it goes to the Drive trash; used locally, it's gone for good */}
        <p className={styles.text}>
          "{binder.name}" and its {cardCountText(cardCount)} will be deleted.{' '}
          {localMode
            ? 'It\'s only saved on this device, so it can\'t be brought back.'
            : 'It goes to your Google Drive trash, where it can be restored for 30 days.'}
        </p>
        {/* "No" comes first so Enter does the safe thing. These show in
            normal order: No on the left, Yes on the right. */}
        <div className={`${styles.buttons} ${styles.normalOrder}`}>
          <button value="no" className={styles.button} type="submit">No</button>
          <button value="yes" className={`${styles.button} ${styles.danger}`} type="submit">Yes, delete</button>
        </div>
      </form>
    </Modal>
  );
}
