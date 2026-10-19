/* =====================================================================
   SEARCH BOX AND SUGGESTIONS
   The box at the top where you type a card's name. After a short pause
   in typing, a list of matching names drops down under it. Click one,
   or use the up and down arrow keys and Enter.
   For screen readers it's a "combobox": a text box with a list that
   goes with it (the role and aria- attributes below say so).
   ===================================================================== */

import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { autocomplete } from '../../lib/scryfall';
import { fuzzySearch, matchParts, type NameEntry } from '../../lib/nameSearch';
import styles from './SearchPage.module.css';

// Start suggesting once this many letters are typed
export const MIN_CHARS = 3;

// Wait this long (in milliseconds) after a key press before searching,
// so it doesn't search on every single letter
const TYPING_PAUSE_MS = 120;

type Props = {
  value: string;
  onChange: (text: string) => void;
  // Every card name, ready to search (missing until it has downloaded)
  names: NameEntry[] | undefined;
  // A name was picked: "exact" is true when it came from the list
  onChoose: (name: string, exact: boolean) => void;
  // Escape was pressed with no list open: the box was left
  onLeave: () => void;
  hint: string;
  hintIsError: boolean;
  onShowShortcuts: () => void;
  inputRef: Ref<HTMLInputElement>;
};

export default function SearchBox(props: Props) {
  const { value, onChange, names, onChoose, onLeave, hint, hintIsError, onShowShortcuts, inputRef } = props;

  // The names in the list, and which one the arrow keys highlight (-1 = none)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  // The timer for the search that runs after a short pause in typing
  const typingTimer = useRef<number | undefined>(undefined);

  // Close the list, and cancel any search still waiting to run, so its
  // results don't pop up after a card was already chosen.
  function hideSuggestions() {
    window.clearTimeout(typingTimer.current);
    typingTimer.current = undefined;
    setSuggestions([]);
    setActive(-1);
  }

  // Put the chosen name in the box, close the list, and load that card.
  function choose(name: string, exact: boolean) {
    hideSuggestions();
    onChange(name);
    onChoose(name, exact);
  }

  // Every time the text changes: wait for a short pause in typing, then
  // look up suggestions: our own fuzzy search once the list of names has
  // downloaded, or Scryfall's suggestions until then.
  function handleChange(text: string) {
    onChange(text);
    window.clearTimeout(typingTimer.current);
    if (text.trim().length < MIN_CHARS) { hideSuggestions(); return; }
    const timer = window.setTimeout(async () => {
      const found = names ? fuzzySearch(names, text) : await autocomplete(text);
      // Only show them if this is still the latest search (nobody kept
      // typing, picked a card, or pressed Enter in the meantime).
      if (typingTimer.current !== timer) return;
      setSuggestions(found);
      setActive(-1);
    }, TYPING_PAUSE_MS);
    typingTimer.current = timer;
  }

  // Keyboard controls for the search box: arrows move, Enter picks, Esc
  // closes the list (and, with no list open, leaves the search box, so
  // the shortcut keys work).
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = suggestions.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      setActive((active + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      setActive((active - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active !== -1) choose(suggestions[active], true);
      // No suggestion picked: let Scryfall find the closest card.
      else if (value.trim()) choose(value.trim(), false);
    } else if (event.key === 'Escape') {
      const listWasOpen = count > 0;
      hideSuggestions();
      if (!listWasOpen) {
        event.currentTarget.blur();
        onLeave();
      }
    }
  }

  // When the arrow keys move the highlight, scroll the list so the
  // highlighted name is in view.
  useEffect(() => {
    if (active === -1) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Stop the waiting search if the page goes away.
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  const open = suggestions.length > 0;

  // The "×" button: empty the search box, close the list, and put the
  // keyboard back in the box, ready to type a new name. (The card that's
  // showing stays until another one is looked up.)
  const boxRef = useRef<HTMLInputElement | null>(null);
  function clearSearch() {
    hideSuggestions();
    onChange('');
    boxRef.current?.focus();
  }

  return (
    <div className={styles.search}>
      <label htmlFor="searchInput" className="visually-hidden">Card name</label>
      {/* The box and its "×" button, which sits inside the box's right end */}
      <div className={styles.searchField}>
      <input
        id="searchInput"
        // Two handles on the box: the page's (for the "/" key) and this
        // one's own (for the "×" button)
        ref={(element) => {
          boxRef.current = element;
          if (typeof inputRef === 'function') inputRef(element);
          else if (inputRef) inputRef.current = element;
        }}
        className={styles.searchInput}
        type="text"
        placeholder="Search for a card name…"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="suggestions"
        aria-activedescendant={active !== -1 ? `suggestion-${active}` : undefined}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        // Leaving the box (like clicking elsewhere) closes the list.
        onBlur={hideSuggestions}
      />
      {/* "×": only while there's something in the box to clear */}
      {value && (
        <button className={styles.clearButton} type="button" aria-label="Clear the search" title="Clear"
                onClick={clearSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
               strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      </div>

      {/* The list of matching names. Pressing the mouse on it (a row OR
          its scrollbar) would normally take the keyboard away from the
          search box and close the list; preventDefault() stops that. If
          the press was on a row, that name is picked. */}
      <ul
        id="suggestions"
        ref={listRef}
        className={`${styles.popupList} ${styles.suggestions}`}
        role="listbox"
        hidden={!open}
        onMouseDown={(event) => {
          event.preventDefault();
          const li = (event.target as HTMLElement).closest('li');
          if (li) choose(suggestions[Number(li.dataset.index)], true);
        }}
      >
        {suggestions.map((name, i) => {
          // The part of the name that matches what was typed is highlighted
          const parts = matchParts(name, value);
          return (
            <li
              key={name}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              data-index={i}
              className={i === active ? styles.active : undefined}
            >
              {parts.before}<mark>{parts.match}</mark>{parts.after}
            </li>
          );
        })}
      </ul>

      {/* The line under the box: a status message on the left (read out
          by screen readers when it changes), and the shortcuts tip on
          the right (clicking it opens the Keyboard shortcuts window) */}
      <div className={styles.hintRow}>
        <p className={`${styles.hint} ${hintIsError ? styles.error : ''}`} aria-live="polite">{hint}</p>
        <button className={styles.shortcutsTip} type="button" onClick={onShowShortcuts}>
          <kbd>/</kbd> search · <kbd>?</kbd> shortcuts
        </button>
      </div>
    </div>
  );
}
