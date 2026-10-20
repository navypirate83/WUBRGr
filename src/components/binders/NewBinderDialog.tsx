/* =====================================================================
   THE "NEW BINDER" WINDOW
   A name (the next free "Binder 3" to start, selected so typing replaces
   it), a cover symbol (None to start) and a cover color (black to start).
   Used by My Binders (the "+" binder) and the Search page ("New binder"
   in the "Add to which binder?" menu). The page decides what happens
   when "Create binder" is clicked.
   On My Binders it also has "Upload .CSV": make the binder from a
   binder file downloaded earlier, or a card list exported from ManaBox
   (or a similar app). An older .json binder file works too.
   ===================================================================== */

import { useRef, useState, type ChangeEvent } from 'react';
import Modal from '../Modal';
import { NameField, SymbolChoices, CoverChoices } from './BinderChoices';
import {
  DEFAULT_COVER, NAME_LIMIT, binderFromFile, nextBinderName, type BinderCards,
} from '../../lib/binderStorage';
import { binderFromCsv } from '../../lib/binderCsv';
import styles from './BinderWindows.module.css';

// What an uploaded binder file turns into (see binderFromCsv and binderFromFile)
export type UploadedBinder = ReturnType<typeof binderFromFile> & { cards: BinderCards };

type Props = {
  // "Create binder": the name, the symbol (null for none) and the cover color
  onCreate: (name: string, color: string | null, cover: string) => void;
  // The window closed without making a binder
  onCancel: () => void;
  // Given on My Binders only: adds the "Upload .CSV" button
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
  // The binder from an uploaded file, once one has been picked, and
  // whether a file is being read right now (cards without a Scryfall ID
  // are looked up on Scryfall, which can take a few seconds)
  const uploaded = useRef<UploadedBinder | null>(null);
  const [reading, setReading] = useState(false);

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

  // A file was picked with "Upload .CSV": read it and check it. A .json
  // file (or one that starts with "{") is an older binder file; anything
  // else is read as a .csv card list. If it's a binder, close the window
  // and hand it to the page; if not, say why and leave the window open.
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const chosen = input.files?.[0];
    input.value = '';     // so picking the same file again still works
    if (!chosen) return;  // the picker was closed without a file
    setReading(true);
    try {
      const text = await chosen.text();
      uploaded.current = /\.json$/i.test(chosen.name) || text.trimStart().startsWith('{')
        ? binderFromFile(JSON.parse(text))
        : await binderFromCsv(text, chosen.name);
    } catch (err) {
      alert(err instanceof SyntaxError ? 'That file isn\'t a readable binder file.' : (err as Error).message);
      return;
    } finally {
      setReading(false);
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
            show in reverse: Upload .CSV (far left), Cancel, Create binder.
            formNoValidate: Cancel works even if the name box is empty.
            While a file is being read, the upload button says so. */}
        <div className={styles.buttons}>
          <button value="create" className={`${styles.button} ${styles.primary}`} type="submit">Create binder</button>
          <button value="cancel" className={styles.button} type="submit" formNoValidate>Cancel</button>
          {onUpload && (
            <button
              className={`${styles.button} ${styles.uploadButton}`}
              type="button"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
            >
              {reading ? 'Reading…' : 'Upload .CSV'}
            </button>
          )}
        </div>
        {/* The file picker, hidden: the Upload .CSV button opens it. It
            takes .csv files, and older .json binder files. */}
        {onUpload && (
          <input ref={fileRef} type="file" accept=".csv,text/csv,.json,application/json" hidden onChange={handleFile} />
        )}
      </form>
    </Modal>
  );
}
