/* =====================================================================
   THE "NEW BINDER" WINDOW
   A name (the next free "Binder 3" to start, selected so typing replaces
   it), a cover symbol (None to start) and a cover color (black to start).
   Used by My Binders (the "+" binder) and the Search page ("New binder"
   in the "Add to which binder?" menu). The page decides what happens
   when "Create binder" is clicked.
   On My Binders it also has "Upload .JSON": make the binder from a
   binder file downloaded earlier.
   ===================================================================== */

import { useRef, useState, type ChangeEvent } from 'react';
import Modal from '../Modal';
import { NameField, SymbolChoices, CoverChoices } from './BinderChoices';
import {
  DEFAULT_COVER, NAME_LIMIT, binderFromFile, nextBinderName, type BinderCards,
} from '../../lib/binderStorage';
import styles from './BinderWindows.module.css';

// What an uploaded binder file turns into (see binderFromFile)
export type UploadedBinder = ReturnType<typeof binderFromFile> & { cards: BinderCards };

type Props = {
  // "Create binder": the name, the symbol (null for none) and the cover color
  onCreate: (name: string, color: string | null, cover: string) => void;
  // The window closed without making a binder
  onCancel: () => void;
  // Given on My Binders only: adds the "Upload .JSON" button
  onUpload?: (binder: UploadedBinder) => void;
};

export default function NewBinderDialog({ onCreate, onCancel, onUpload }: Props) {
  // What's typed and picked. (The page draws this window fresh each time
  // it opens, so these always start from the beginning.)
  const [name, setName] = useState(nextBinderName);
  const [symbol, setSymbol] = useState('');
  const [cover, setCover] = useState(DEFAULT_COVER);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The binder from an uploaded file, once one has been picked
  const uploaded = useRef<UploadedBinder | null>(null);

  // When the window closes, see which button closed it. "Create binder"
  // hands the name, symbol and cover color to the page. (The name box is
  // "required", so it can't be blank; spaces-only falls back to the
  // default name.)
  function handleClose(returnValue: string) {
    if (returnValue === 'create') {
      onCreate(name.trim().slice(0, NAME_LIMIT) || nextBinderName(), symbol || null, cover);
    } else if (returnValue === 'upload' && uploaded.current && onUpload) {
      onUpload(uploaded.current);
    } else {
      onCancel();
    }
  }

  // A file was picked with "Upload .JSON": read it and check it. If it's
  // a binder file, close the window and hand it to the page; if not, say
  // why and leave the window open.
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const chosen = input.files?.[0];
    input.value = '';     // so picking the same file again still works
    if (!chosen) return;  // the picker was closed without a file
    try {
      uploaded.current = binderFromFile(JSON.parse(await chosen.text()));
    } catch (err) {
      alert(err instanceof SyntaxError ? 'That file isn\'t a readable .JSON file.' : (err as Error).message);
      return;
    }
    input.closest('dialog')?.close('upload');
  }

  return (
    <Modal labelledBy="newBinderTitle" onClose={handleClose} onOpened={() => nameRef.current?.select()}>
      {/* method="dialog": the buttons close the window, each with its value */}
      <form method="dialog">
        <h2 id="newBinderTitle" className={styles.title}>New binder</h2>
        <NameField id="newBinderName" value={name} onChange={setName} inputRef={nameRef} />
        <SymbolChoices
          group="binderColor"
          legend="Choose a color symbol for the cover, or none."
          value={symbol}
          onChange={setSymbol}
        />
        <CoverChoices group="binderCover" value={cover} onChange={setCover} />

        {/* "Create binder" comes first so Enter creates the binder; they
            show in reverse: Upload .JSON (far left), Cancel, Create binder.
            formNoValidate: Cancel works even if the name box is empty. */}
        <div className={styles.buttons}>
          <button value="create" className={`${styles.button} ${styles.primary}`} type="submit">Create binder</button>
          <button value="cancel" className={styles.button} type="submit" formNoValidate>Cancel</button>
          {onUpload && (
            <button
              className={`${styles.button} ${styles.uploadButton}`}
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              Upload .JSON
            </button>
          )}
        </div>
        {/* The file picker, hidden: the Upload .JSON button opens it */}
        {onUpload && <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleFile} />}
      </form>
    </Modal>
  );
}
