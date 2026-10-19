/* =====================================================================
   SEARCH YOUR BINDERS
   The search bar at the top of My Binders and above every binder's
   pages. It only looks at the cards in your binders (this browser's
   copies of them), with the same forgiving search as the MTG Card
   Finder: part of a name, any spacing or punctuation, and small typos
   all still find the card.
   As you type, a list drops down: each card found, with the binder and
   page it's in. Picking one (a click, or Enter, or the search button,
   which picks the top one) opens that binder at that page, with the
   card's pocket highlighted.
   On a binder page there's a "Current binder" checkbox: ticked,
   only that binder is searched; otherwise every binder is.
   ===================================================================== */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { cardCount, loadBinder, loadBinderList } from '../../lib/binderStorage';
import { fuzzySearch, matchParts, prepareNames } from '../../lib/nameSearch';
import styles from './BinderSearch.module.css';

// Start searching once this many letters are typed, and wait this long
// (milliseconds) after a key press, so it doesn't search on every letter
const MIN_CHARS = 2;
const TYPING_PAUSE_MS = 120;

// Show at most this many results in the list
const MAX_RESULTS = 50;

// One card found: its name, the binder it's in, the pocket ("3-5"), the
// page number, and how many copies are in that pocket
type Found = { name: string; binderId: string; binderName: string; key: string; page: number; count: number };

// Every card in the binders being searched (all of them, or just one)
function cardsInBinders(onlyBinderId: string | null): Found[] {
  const found: Found[] = [];
  for (const binder of loadBinderList()) {
    if (onlyBinderId && binder.id !== onlyBinderId) continue;
    const cards = loadBinder(binder.id);
    for (const [key, card] of Object.entries(cards)) {
      found.push({ name: card.name, binderId: binder.id, binderName: binder.name, key,
        page: Number(key.split('-')[0]), count: cardCount(card) });
    }
  }
  return found;
}

// Search the binders for what's typed: the fuzzy search ranks the card
// NAMES (best matches first), then each name's pockets are listed in
// binder order, page by page.
function searchBinders(text: string, onlyBinderId: string | null): Found[] {
  const cards = cardsInBinders(onlyBinderId);
  const names = [...new Set(cards.map((c) => c.name))];
  const ranked = fuzzySearch(prepareNames(names), text);
  const results: Found[] = [];
  for (const name of ranked) {
    for (const card of cards) if (card.name === name) results.push(card);
    if (results.length >= MAX_RESULTS) break;
  }
  return results.slice(0, MAX_RESULTS);
}

type Props = {
  // On a binder page: that binder's id (for the "Current binder" box)
  currentBinderId?: string;
};

export default function BinderSearch({ currentBinderId }: Props) {
  const navigate = useNavigate();
  // What's typed, whether to search only this binder, the results, and
  // which result the arrow keys highlight (-1 = none)
  const [text, setText] = useState('');
  const [onlyThis, setOnlyThis] = useState(false);
  const [results, setResults] = useState<Found[] | null>(null);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const searchedFor = useRef('');

  // The binder to limit the search to (if the box is ticked)
  const limitTo = currentBinderId && onlyThis ? currentBinderId : null;

  // Close the list (and stop a search still waiting to run).
  function closeList() {
    window.clearTimeout(typingTimer.current);
    setResults(null);
    setActive(-1);
  }

  // Search now, for this text (nothing for fewer than MIN_CHARS letters).
  function runSearch(value: string, only: string | null) {
    window.clearTimeout(typingTimer.current);
    if (value.trim().length < MIN_CHARS) { closeList(); return; }
    searchedFor.current = value;
    setResults(searchBinders(value, only));
    setActive(-1);
  }

  // Every time the text changes: search after a short pause in typing.
  function handleChange(value: string) {
    setText(value);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => runSearch(value, limitTo), TYPING_PAUSE_MS);
  }

  // Go to a card found: its binder, at its page, with its pocket
  // highlighted ("highlight=3-5" in the address tells the binder page).
  function goTo(found: Found) {
    closeList();
    navigate(`/binders/${encodeURIComponent(found.binderId)}?page=${found.page}&highlight=${found.key}`);
  }

  // The search button, or Enter: go to the highlighted result, or else
  // the top one (searching first, if the list isn't showing yet).
  function goToBest() {
    const list = results && searchedFor.current === text ? results : (text.trim().length >= MIN_CHARS ? searchBinders(text, limitTo) : []);
    const pick = list[active] ?? list[0];
    if (pick) goTo(pick);
    else if (text.trim().length >= MIN_CHARS) { setResults([]); }
  }

  // Keys in the box: arrows move through the list, Enter goes, Escape
  // closes the list (and, with no list open, empties the box).
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results?.length ?? 0;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      setActive((active + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      setActive((active - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goToBest();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (results) closeList();
      else setText('');
    }
  }

  // When the arrow keys move the highlight, scroll it into view.
  useEffect(() => {
    if (active !== -1) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Stop a waiting search if the bar goes away.
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  return (
    <div className={styles.binderSearch} role="search">
      <div className={styles.field}>
        <label htmlFor="binderSearchInput" className="visually-hidden">Search your binders</label>
        {/* The box. For screen readers it's a "combobox": a text box with
            a list that goes with it. */}
        <input
          id="binderSearchInput"
          className={styles.input}
          type="search"
          placeholder={currentBinderId && onlyThis ? 'Search this binder…' : 'Search your binders…'}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results !== null}
          aria-controls="binderSearchResults"
          aria-activedescendant={active !== -1 ? `binder-result-${active}` : undefined}
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          // Leaving the box closes the list (a moment later, so a click on
          // a result still counts)
          onBlur={() => setTimeout(closeList, 150)}
        />
        {/* The search button (a magnifying glass): goes to the best match */}
        <button className={styles.searchButton} type="button" aria-label="Search" title="Search"
                onMouseDown={(event) => event.preventDefault()} onClick={goToBest}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
               strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </button>

        {/* The results. Pressing the mouse on the list would normally take
            the keyboard away from the box and close it; preventDefault()
            stops that. */}
        {results !== null && (
          <ul id="binderSearchResults" ref={listRef} className={styles.results} role="listbox"
              onMouseDown={(event) => event.preventDefault()}>
            {results.length === 0 && (
              <li className={styles.noResults}>No cards in {limitTo ? 'this binder' : 'your binders'} match.</li>
            )}
            {results.map((found, i) => {
              // The part of the name that matches what was typed is highlighted
              const parts = matchParts(found.name, searchedFor.current);
              return (
                <li
                  key={`${found.binderId}-${found.key}`}
                  id={`binder-result-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? styles.active : undefined}
                  onClick={() => goTo(found)}
                >
                  <span className={styles.resultName}>
                    {parts.before}<mark>{parts.match}</mark>{parts.after}
                    {found.count > 1 && <span className={styles.resultCount}> ×{found.count}</span>}
                  </span>
                  <span className={styles.resultWhere}>{found.binderName} · page {found.page}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* "Current binder" (on a binder page): ticked, only this
          binder is searched. Changing it searches again straight away. */}
      {currentBinderId && (
        <label className={styles.onlyThis}>
          <input
            type="checkbox"
            checked={onlyThis}
            onChange={(event) => {
              setOnlyThis(event.target.checked);
              if (results !== null) runSearch(text, event.target.checked ? currentBinderId : null);
            }}
          />
          Current binder
        </label>
      )}
    </div>
  );
}
