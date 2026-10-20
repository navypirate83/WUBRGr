/* =====================================================================
   ADD TO BINDER (the round "+" beside the card on the Search page)
   - Opened from a binder's pocket (the address has "?binder=<id>", and
     maybe "&binderPage=3&binderSlot=5")? "+" puts the card straight into
     that binder (that pocket, or its first empty one).
   - Opened on its own? "+" opens the "Add to which binder?" menu: one
     row per binder (a dot in its cover color, its name and card count;
     full binders can't be picked), then "New binder", which makes a new
     binder with the card in it.
   Only shown to someone using the binders (signed in, or locally).
   Afterwards it opens the binder, at the page with the new card.
   ===================================================================== */

import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { useNavigate } from 'react-router';
import NewBinderDialog from '../../components/binders/NewBinderDialog';
import {
  DEFAULT_PAGES, POCKETS_PER_PAGE,
  binderPages, firstEmptyPocket, hasBinderCopy, isLocalMode, loadBinder, loadBinderList,
  pocketKey, saveBinder, saveBinderList, type BinderCard,
} from '../../lib/binderStorage';
import { DriveError, createBinderFile, syncBinder } from '../../lib/googleDrive';
import { coverLook } from '../../lib/covers';
import styles from './SearchPage.module.css';

// What the card area can ask this button to do (the A key)
export type AddToBinderHandle = { activate: () => void };

type Props = {
  // The card being shown, as a binder saves it (made when it's added)
  cardEntry: () => BinderCard;
  // The binder this page was opened from, and the pocket to fill (from
  // the address), if any
  fromBinder: string | null;
  pocket: { page: number; slot: number } | null;
  // Show a message under the search box (red if it's a problem)
  onMessage: (text: string, isError?: boolean) => void;
  ref?: Ref<AddToBinderHandle>;
};

// Read the pocket to fill from the address ("binderPage=3&binderSlot=5").
// It must be a real pocket; otherwise there's none.
export function pocketFromAddress(params: URLSearchParams): { page: number; slot: number } | null {
  const page = parseInt(params.get('binderPage') ?? '', 10);
  const slot = parseInt(params.get('binderSlot') ?? '', 10);
  const valid = page >= 1 && slot >= 1 && slot <= POCKETS_PER_PAGE;
  return valid ? { page, slot } : null;
}

export default function AddToBinder({ cardEntry, fromBinder, pocket, onMessage, ref }: Props) {
  const navigate = useNavigate();
  // Is the menu open, is the New binder window open, and is something
  // being saved (so nothing can be clicked twice)?
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clicking "+": add straight to the binder it came from, or open (or
  // close) the menu.
  function activate() {
    if (busy) return;
    if (fromBinder) addCardToBinder(fromBinder, pocket);
    else setMenuOpen((open) => !open);
  }
  useImperativeHandle(ref, () => ({ activate }));

  // Close the menu ("returnFocus" puts the keyboard back on the "+").
  function closeMenu(returnFocus: boolean) {
    setMenuOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  // When the menu opens, put the keyboard on the first binder that can be
  // picked. While it's open, a click anywhere outside it (and outside the
  // "+") closes it.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  // In the menu: Escape closes it; the up and down arrows move between
  // the binders (skipping full ones), wrapping around at the ends.
  function handleMenuKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = [...menuRef.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (rows.length === 0) return;
    const here = rows.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    rows[(here + step + rows.length) % rows.length].focus();
  }

  // A Drive problem: signed out says to sign in again; anything else says what went wrong.
  function driveProblem(err: unknown, what: string) {
    onMessage(err instanceof DriveError && err.signedOut
      ? 'Sign in again on the Home page (at the bottom of the page), then try again.'
      : `${what} ${(err as Error).message}`, true);
  }

  // Go to the binder the card went into, opened to the page with the new
  // card. (The binder page then saves the change to Google Drive.)
  function goToBinder(id: string, page: number) {
    navigate(`/binders/${encodeURIComponent(id)}?page=${page}`);
  }

  // Save the card being shown into a binder: into "target" (a pocket),
  // or the binder's first empty pocket.
  async function addCardToBinder(id: string, target: { page: number; slot: number } | null) {
    setBusy(true);
    // A binder picked from the menu may have been changed on another
    // computer (or never opened in this browser), so get its latest cards
    // from Google Drive first: otherwise the card could land in a pocket
    // that's already taken. (Used locally, this device has the only copy.)
    if (!fromBinder && !isLocalMode()) {
      onMessage('Getting your binder from Google Drive…');
      try {
        await syncBinder(id);
      } catch (err) {
        // Only go ahead if this browser already has a copy to add to.
        if (!hasBinderCopy(id)) {
          driveProblem(err, 'Couldn\'t get your binder from Google Drive.');
          setBusy(false);
          closeMenu(true);
          return;
        }
      }
    }

    const cards = loadBinder(id);
    const spot = target ?? firstEmptyPocket(cards, binderPages(id));
    if (!spot) {
      onMessage('That binder is full. Click a card in the binder to replace it.', true);
      setBusy(false);
      closeMenu(true);
      return;
    }
    const entry = cardEntry();
    cards[pocketKey(spot.page, spot.slot)] = entry;
    // Saved here, marked "needs saving to Drive" (My Binders saves it there).
    if (!saveBinder(cards, id)) {
      onMessage('Your browser blocked saving, so the card could not be added.', true);
      setBusy(false);
      closeMenu(true);
      return;
    }
    goToBinder(id, spot.page);
  }

  // "Create binder" in the New binder window: make the new binder with the
  // card in its first pocket, at the end of the shelf, then go to it.
  async function addCardToNewBinder(name: string, color: string | null, cover: string) {
    setNewOpen(false);
    setBusy(true);
    onMessage('Making the new binder…');
    try {
      const entry = cardEntry();
      const cards = { [pocketKey(1, 1)]: entry };
      const list = loadBinderList();
      const file = await createBinderFile(name, cards, color, list.length, cover);
      saveBinderList([...list, { id: file.id, name, color, cover, pages: DEFAULT_PAGES }]);
      saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
      goToBinder(file.id, 1);
    } catch (err) {
      driveProblem(err, 'Couldn\'t make the new binder in Google Drive.');
      setBusy(false);
    }
  }

  const binders = menuOpen ? loadBinderList() : [];

  return (
    <>
      {/* The round "+" button. When it opens the menu, aria-haspopup and
          aria-expanded tell screen readers so. */}
      <button
        ref={buttonRef}
        className={styles.binderButton}
        type="button"
        aria-label="Add to binder"
        title={fromBinder ? 'Add to binder' : 'Add to a binder…'}
        aria-haspopup={fromBinder ? undefined : 'true'}
        aria-expanded={fromBinder ? undefined : menuOpen}
        aria-controls={fromBinder ? undefined : 'binderMenu'}
        disabled={busy}
        onClick={activate}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* "Add to which binder?" */}
      {menuOpen && (
        <div id="binderMenu" ref={menuRef} className={styles.binderMenu} onKeyDown={handleMenuKeys}>
          <p className={styles.binderMenuTitle} id="binderMenuTitle">Add to which binder?</p>
          <div className={styles.binderMenuList} role="group" aria-labelledby="binderMenuTitle">
            {binders.map((binder) => {
              const count = Object.keys(loadBinder(binder.id)).length;
              const full = count >= binderPages(binder.id) * POCKETS_PER_PAGE;
              const look = coverLook(binder.cover);
              return (
                <button
                  key={binder.id}
                  type="button"
                  className={styles.binderMenuItem}
                  disabled={full || busy}
                  onClick={() => addCardToBinder(binder.id, null)}
                >
                  {/* A little dot in the binder's cover color */}
                  <span className={`${styles.binderMenuDot} ${look.className}`} style={look.style} />
                  <span className={styles.binderMenuName}>{binder.name}</span>
                  <span className={styles.binderMenuCount}>{full ? 'Full' : `${count} ${count === 1 ? 'card' : 'cards'}`}</span>
                </button>
              );
            })}
            {/* The "New binder" row: a "+" in its dot */}
            <button
              type="button"
              className={`${styles.binderMenuItem} ${styles.binderMenuNew}`}
              disabled={busy}
              onClick={() => { setMenuOpen(false); setNewOpen(true); }}
            >
              <span className={`${styles.binderMenuDot} ${styles.binderMenuPlus}`} />
              <span className={styles.binderMenuName}>New binder</span>
            </button>
          </div>
        </div>
      )}

      {newOpen && (
        <NewBinderDialog
          onCreate={addCardToNewBinder}
          onCancel={() => { setNewOpen(false); buttonRef.current?.focus(); }}
        />
      )}
    </>
  );
}
