/* =====================================================================
   SEARCH PAGE: THE MTG CARD FINDER
   Look up any Magic card by name, see its picture and details, and pick
   the exact set, version and language. The search box is at the top;
   everything about the card is in the card area under it (CardPanel).
   A shared link (like /search?set=isd&number=51) opens one exact card.
   The card data comes from Scryfall, through TanStack Query, which
   remembers each answer so nothing is downloaded twice.
   Opened from a binder, the address also says which binder (and maybe
   which pocket) the "+" Add to binder button fills.
   ===================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  cardByNamePath, cardBySetPath, loadCard, loadCardNames, loadSetIcons,
} from '../../lib/scryfall';
import { prepareNames } from '../../lib/nameSearch';
import { plural } from '../../lib/cards';
import { useShortcutKeys } from '../../hooks/useShortcutKeys';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import { useAccount } from '../../hooks/useAccount';
import ShortcutsDialog, { type Shortcut } from '../../components/ShortcutsDialog';
import SearchBox, { MIN_CHARS } from './SearchBox';
import CardPanel from './CardPanel';
import { pocketFromAddress } from './AddToBinder';
import styles from './SearchPage.module.css';

// One card lookup: the Scryfall address that finds it, which side and
// language a shared link asked for, and a number that's new for every
// lookup (so searching for the same card again starts it fresh).
type Lookup = {
  path: string;
  face: number;
  lang: string | null;
  number: number;
};

// The keys listed in this page's Keyboard shortcuts window (press ?)
const searchShortcuts: Shortcut[] = [
  { keys: <kbd>/</kbd>, does: 'Jump to the search box' },
  { keys: <kbd>Esc</kbd>, does: 'Leave the search box, so these keys work' },
  { keys: <><kbd>[</kbd> <kbd>]</kbd></>, does: 'Previous / next version in this set' },
  { keys: <><kbd>{'{'}</kbd> <kbd>{'}'}</kbd></>, does: 'Previous / next set (Shift + [ / ])' },
  { keys: <kbd>F</kbd>, does: 'Flip a two-sided card' },
  { keys: <kbd>A</kbd>, does: 'Add to binder (when signed in or using the site locally)' },
  { keys: <kbd>S</kbd>, does: 'Share: copy a link to this card' },
  { keys: <kbd>B</kbd>, does: 'Back to the binder you came from' },
  { keys: <kbd>?</kbd>, does: 'Show this list' },
];

// A counter for numbering lookups
let lookupCount = 0;

export default function SearchPage() {
  // The address's "?set=...&number=..." part, from a shared link
  const [params] = useSearchParams();

  // The card to look up. A shared link sets the first one: one exact
  // printing, maybe its back side ("face=back") or another language
  // ("lang=ja"). Otherwise there's nothing to look up until a search.
  const [lookup, setLookup] = useState<Lookup | null>(() => {
    const set = params.get('set');
    const number = params.get('number');
    if (!set || !number) return null;
    return {
      path: cardBySetPath(set, number),
      face: params.get('face') === 'back' ? 1 : 0,
      lang: params.get('lang'),
      number: ++lookupCount,
    };
  });

  // Is Foil on? It carries on from card to card. A shared link with
  // "foil=1" starts with it on.
  const [foil, setFoil] = useState(() => params.get('foil') === '1');

  // Is someone using the binders? And was this page opened from a binder
  // ("?binder=<id>", maybe with the pocket to fill)?
  const { usingBinders } = useAccount();
  const fromBinder = params.get('binder');
  const pocket = pocketFromAddress(params);

  // A message from adding to a binder (like "That binder is full."),
  // shown under the search box instead of the usual one until the next
  // card is looked up
  const [addMessage, setAddMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // What's typed in the search box
  const [text, setText] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // The Keyboard shortcuts window, and the hidden message area that
  // screen readers read out
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { announce, announcer } = useAnnouncer();

  /* ----- Downloads (TanStack Query runs these and remembers them) ----- */

  // Every card name, downloaded once and prepared for the fuzzy search.
  // ("select" prepares it; it's only redone if the names change.)
  const names = useQuery({ queryKey: ['card-names'], queryFn: loadCardNames, select: prepareNames });

  // Every set's symbol picture, for the Set picker
  const setIcons = useQuery({ queryKey: ['set-icons'], queryFn: loadSetIcons });

  // The card being looked up, and all its printings. While a new one
  // loads, the old card stays on show ("keepPreviousData"), dimmed with
  // a spinner, instead of the page going blank.
  const cardQuery = useQuery({
    queryKey: ['card', lookup?.path],
    queryFn: () => loadCard(lookup!.path),
    enabled: lookup !== null,
    placeholderData: keepPreviousData,
  });

  // The lookup whose card is on show: the current one once its answer
  // has arrived, the one before while it's still loading, and none
  // after a lookup fails (then the card area goes back to empty).
  // (It's updated right here while drawing, not afterwards, so the new
  // card and its lookup always show together. React allows this: it
  // redraws straight away, before anything appears on screen.)
  const [shownLookup, setShownLookup] = useState<Lookup | null>(null);
  const arrived = cardQuery.isSuccess && !cardQuery.isPlaceholderData;
  if (arrived && shownLookup !== lookup) setShownLookup(lookup);
  const result = cardQuery.isError ? undefined : cardQuery.data;

  // When a card arrives, put its full name in the search box.
  const cardName = arrived ? cardQuery.data?.card.name : undefined;
  useEffect(() => {
    if (cardName) setText(cardName);
  }, [cardName, lookup?.number]);

  // Look up a card by name. "exact" is true when the name came from the
  // suggestion list; otherwise Scryfall guesses the closest match.
  function searchFor(name: string, exact: boolean) {
    setAddMessage(null);
    setLookup({ path: cardByNamePath(name, exact), face: 0, lang: null, number: ++lookupCount });
  }

  /* ----- The message under the search box ----- */

  const { hint, hintIsError } = useMemo(() => {
    if (cardQuery.isFetching) return { hint: 'Loading…', hintIsError: false };
    if (cardQuery.isError) return { hint: cardQuery.error.message || 'Something went wrong.', hintIsError: true };
    if (cardQuery.data) {
      const setCount = new Set(cardQuery.data.prints.map((p) => p.set)).size;
      return {
        hint: `${plural(cardQuery.data.prints.length, 'printing')} across ${plural(setCount, 'set')}.`,
        hintIsError: false,
      };
    }
    if (names.isPending) return { hint: 'Loading card names…', hintIsError: false };
    return { hint: `Type at least ${MIN_CHARS} letters to see suggestions.`, hintIsError: false };
  }, [cardQuery.isFetching, cardQuery.isError, cardQuery.error, cardQuery.data, names.isPending]);

  /* ----- Shortcut keys that work even before a card is shown ----- */

  //  /  jump to the search box, with its text selected
  //  ?  the Keyboard shortcuts window
  useShortcutKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();   // "/" would otherwise start the browser's quick find
      searchRef.current?.focus();
      searchRef.current?.select();
    } else if (event.key === '?') {
      event.preventDefault();
      setShortcutsOpen(true);
    }
  });

  return (
    <div className={styles.page}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>MTG Card Finder – WUBRG'r</title>

      <SearchBox
        value={text}
        onChange={setText}
        names={names.data}
        onChoose={searchFor}
        onLeave={() => announce('Left the search box. The shortcut keys work now: press ? to see them.')}
        hint={addMessage ? addMessage.text : hint}
        hintIsError={addMessage ? addMessage.isError : hintIsError}
        onShowShortcuts={() => setShortcutsOpen(true)}
        inputRef={searchRef}
      />

      {/* The card area. "key" makes React draw a fresh one for each card
          looked up, so it starts on the printing Scryfall found. */}
      <CardPanel
        key={result && shownLookup ? shownLookup.number : 'empty'}
        result={result && shownLookup ? result : undefined}
        startFace={shownLookup?.face ?? 0}
        startLang={shownLookup?.lang ?? null}
        setIcons={setIcons.data}
        foil={foil}
        setFoil={setFoil}
        busy={cardQuery.isFetching}
        announce={announce}
        usingBinders={usingBinders}
        fromBinder={fromBinder}
        pocket={pocket}
        onMessage={(text, isError = false) => setAddMessage({ text, isError })}
      />

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        intro="These work anywhere on the page, except while you're typing in a box."
        shortcuts={searchShortcuts}
      />
      {announcer}
    </div>
  );
}
