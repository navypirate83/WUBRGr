/* =====================================================================
   SET PICKER
   A custom-built drop-down for picking the set. A normal <select> can't
   show pictures, and each row needs its set symbol:
       symbol | CODE | Set Name
   Clicking the button (or pressing the up/down arrow on it) opens the
   list. In the list: the arrow keys, Home and End move, Enter or Space
   picks, Escape closes. Clicking outside closes it too.
   ===================================================================== */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { SetGroup } from '../../lib/cards';
import styles from './SearchPage.module.css';

type Props = {
  sets: SetGroup[];
  current: SetGroup | null;
  onChoose: (set: SetGroup) => void;
};

// What the "Search for a card first" pickers say before a card is shown
export const EMPTY_PICKER_TEXT = 'Search for a card first';

// One row's contents: the set symbol, its code and its name, with "|"
// between them. (No symbol picture yet? An empty space of the same size.)
function SetRow({ set }: { set: SetGroup }) {
  return (
    <>
      {set.icon
        ? <img className={styles.setIcon} src={set.icon} alt="" />
        : <span className={styles.setIcon} />}
      <span className={styles.sep}>|</span>
      <span className={styles.setCode}>{set.code.toUpperCase()}</span>
      <span className={styles.sep}>|</span>
      <span className={styles.setName}>{set.name}</span>
    </>
  );
}

export default function SetPicker({ sets, current, onChoose }: Props) {
  // Is the list open, and which row do the arrow keys highlight?
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Handles on the whole picker, the button and the list
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Open the list with the current set highlighted.
  function openList() {
    setActive(current ? sets.indexOf(current) : 0);
    setOpen(true);
  }

  // Close the list (and put the keyboard back on the button, if asked).
  function closeList(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // Pick the set at a row number, then close the list.
  function choose(index: number) {
    const set = sets[index];
    if (set) onChoose(set);
    closeList(true);
  }

  // When the list opens, give it the keyboard (so its arrow keys work).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Scroll the highlighted row into view as the arrow keys move it.
  useEffect(() => {
    if (open && active !== -1) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  // While the list is open, a click anywhere outside the picker closes it.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  // Keyboard controls inside the list
  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = sets.length - 1;
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); setActive(Math.min(last, active + 1)); break;
      case 'ArrowUp':   event.preventDefault(); setActive(Math.max(0, active - 1)); break;
      case 'Home':      event.preventDefault(); setActive(0); break;
      case 'End':       event.preventDefault(); setActive(last); break;
      case 'Enter':
      case ' ':         event.preventDefault(); choose(active); break;
      case 'Escape':    event.preventDefault(); closeList(true); break;
      case 'Tab':       closeList(false); break;
    }
  }

  return (
    <div ref={pickerRef} className={styles.setPicker}>
      <span className={styles.fieldLabel} id="setLabel">Set</span>

      {/* The button showing the current set. aria-haspopup and
          aria-expanded tell screen readers it opens a list. */}
      <button
        id="setButton"
        ref={buttonRef}
        className={`${styles.picker} ${styles.setButton}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="setLabel setButton"
        disabled={!current}
        onClick={() => (open ? closeList(true) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openList();
          }
        }}
      >
        {current ? <SetRow set={current} /> : <span className={styles.setName}>{EMPTY_PICKER_TEXT}</span>}
      </button>

      {/* The pop-up list of sets. tabIndex -1 lets the code give it the
          keyboard without adding it to the Tab key's stops. */}
      <ul
        ref={listRef}
        className={`${styles.popupList} ${styles.setList}`}
        role="listbox"
        tabIndex={-1}
        aria-labelledby="setLabel"
        aria-activedescendant={open && active !== -1 ? `set-option-${active}` : undefined}
        hidden={!open}
        onKeyDown={handleListKeyDown}
      >
        {sets.map((set, i) => (
          <li
            key={set.code}
            id={`set-option-${i}`}
            role="option"
            aria-selected={set === current}
            className={i === active ? styles.active : undefined}
            onClick={() => choose(i)}
          >
            <SetRow set={set} />
          </li>
        ))}
      </ul>
    </div>
  );
}
