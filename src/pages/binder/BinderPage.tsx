/* =====================================================================
   ONE BINDER: ITS PAGES OF POCKETS
   Opening a binder shows its pages like a real binder lying open: two
   pages side by side on a computer or tablet, one page at a time on a
   phone. Each page has 16 pockets (see Pocket.tsx).
   - Previous / Next (or a swipe on a phone) turn the page, with a 3D
     page-turn animation (lib/pageTurn.ts).
   - Cards can be dragged to another pocket (swapping with any card
     there), onto the red X to remove them, or onto the blue circle to
     move them to another binder. Holding a card at the binder's left or
     right edge turns the page.
   - The "− 3 +" bar changes how many copies you own.
   - Everything works with the keyboard too (see USING THE KEYBOARD).
   - Card pictures dragged in from Scryfall or EDHREC fill empty pockets.
   - Every change is saved in this browser straight away, then to Google
     Drive a moment later (the top bar says where it's saved).
   ===================================================================== */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragMoveEvent,
} from '@dnd-kit/core';
import { useAccount } from '../../hooks/useAccount';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import { useShortcutKeys } from '../../hooks/useShortcutKeys';
import Modal from '../../components/Modal';
import ShortcutsDialog, { type Shortcut } from '../../components/ShortcutsDialog';
import { TOPBAR_TOOLS_ID } from '../../components/TopBar';
import Pocket from './Pocket';
import BinderSearch from '../../components/binders/BinderSearch';
import MoveCardDialog from './MoveCardDialog';
import {
  MAX_COPIES, POCKETS_PER_PAGE,
  binderDirtyStamp, binderPages, cardCount, findBinder, isLocalMode, loadBinder, pocketKey, saveBinder,
  withCount, type BinderCards,
} from '../../lib/binderStorage';
import { DriveError, initGoogleSignIn, isSignedIn, signInWithGoogle, syncBinder } from '../../lib/googleDrive';
import { RequestError } from '../../lib/http';
import { TURN_MS, animateTurn } from '../../lib/pageTurn';
import { binderCardFrom, isOutsideDrag, lookupFromDrop } from '../../lib/cardDrop';
import { loadOneCard } from '../../lib/scryfall';
import { hapticTap } from '../../lib/haptics';
import windows from '../../components/binders/BinderWindows.module.css';
import styles from './BinderPage.module.css';

/* ---------------------------------------------------------------------
   SETTINGS
   --------------------------------------------------------------------- */

// Pages are only drawn (and their card pictures downloaded) for the
// pages showing, plus this many pages either side (a 150-page binder has
// 2,400 cards: downloading every picture at once would be well over
// 100 MB, and drawing every pocket would make the page slow)
const PICTURE_PAGES_AHEAD = 2;

// A sideways finger slide this long (pixels) counts as a swipe
const SWIPE_DISTANCE = 50;

// How close to the binder's left or right edge (pixels) a dragged card
// must be held to turn the page, and how long it must stay there (and
// before each further turn)
const EDGE_ZONE = 18;
const EDGE_WAIT_MS = 550;

// How close (pixels from a drop circle's center) counts as "over" it
// (a bit more than the circles' 32px radius, so they're easy to hit)
const CIRCLE_REACH = 44;

// Saving to Drive: wait this long after a change (so quick changes go
// together in one save), and this long before trying a failed save again
const DRIVE_SAVE_DELAY_MS = 1200;
const DRIVE_RETRY_MS = 30000;

// The keys listed in this page's Keyboard shortcuts window (press ?)
const binderShortcuts: Shortcut[] = [
  { keys: <><kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd></>, does: 'Move from pocket to pocket (past the left or right edge turns the page)' },
  { keys: <><kbd>PgUp</kbd> <kbd>PgDn</kbd></>, does: 'Turn the page back / forward' },
  { keys: <kbd>Enter</kbd>, does: 'Open the card in the MTG Card Finder (or add a card to an empty pocket)' },
  { keys: <kbd>Space</kbd>, does: 'Pick up the card. Then the arrows choose a pocket, Space drops it, Esc cancels' },
  { keys: <><kbd>+</kbd> <kbd>−</kbd></>, does: 'One more / one fewer copy' },
  { keys: <kbd>Delete</kbd>, does: 'Remove the card (it asks first)' },
  { keys: <kbd>M</kbd>, does: 'Move the card to another binder' },
  { keys: <kbd>?</kbd>, does: 'Show this list' },
];

/* ---------------------------------------------------------------------
   SMALL HELPERS
   --------------------------------------------------------------------- */

// Is the screen phone-sized? (Keep 640px the same as the stylesheet.)
// "useSyncExternalStore" redraws the page when the answer changes (like
// a phone turned sideways).
const PHONE_QUERY = '(max-width: 640px)';
function isPhone(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}
function onPhoneChange(callback: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

// "page 3, pocket 5" for a pocket key like "3-5"
function placeName(key: string): string {
  const [page, slot] = key.split('-');
  return `page ${page}, pocket ${slot}`;
}

// The page number of a pocket key ("3-5" → 3), and its pocket number (→ 5)
const pageOf = (key: string) => Number(key.split('-')[0]);
const slotOf = (key: string) => Number(key.split('-')[1]);

// The numbers from "first" to "last"
function range(first: number, last: number): number[] {
  const list: number[] = [];
  for (let n = first; n <= last; n++) list.push(n);
  return list;
}

// Each binder gets a fresh page (so moving from one binder to another
// starts again from scratch): "key" makes React draw a new one.
export default function BinderPageForAddress() {
  const { binderId = '' } = useParams();
  return <BinderPage key={binderId} binderId={binderId} />;
}

function BinderPage({ binderId }: { binderId: string }) {
  const { usingBinders } = useAccount();
  const [params] = useSearchParams();
  const binder = findBinder(binderId);
  const { announce, announcer } = useAnnouncer();

  /* ----- The cards, and saving them ----- */

  // This binder's cards (this browser's working copy). "cardsRef" always
  // holds the newest copy, for code that runs later (timers, Drive).
  const [cards, setCardsState] = useState<BinderCards>(() => loadBinder(binderId));
  const cardsRef = useRef(cards);

  // How many pages: the binder's own number, but never fewer than the
  // highest page that has a card on it, so no card is ever out of sight.
  const [totalPages] = useState(() => {
    const highestUsed = Math.max(0, ...Object.keys(cards).map(pageOf));
    return Math.max(binderPages(binderId), highestUsed);
  });

  // Keep a new set of cards: save it in this browser and show it.
  // Returns false (and changes nothing) if the browser blocked saving.
  function commit(next: BinderCards): boolean {
    if (!saveBinder(next, binderId)) return false;
    cardsRef.current = next;
    setCardsState(next);
    return true;
  }

  /* ----- Pages showing ----- */

  // One page at a time on a phone, two on bigger screens
  const phone = useSyncExternalStore(onPhoneChange, isPhone);
  const perView = phone ? 1 : 2;

  // The page shown first (on the left when two show). It starts on the
  // page named in the address, if any ("?page=3", e.g. after adding a
  // card on the MTG Card Finder). With two pages showing, the left page
  // is always odd (1–2, 3–4…), like a real binder opened flat.
  const [currentPageState, setCurrentPage] = useState(() => {
    const start = parseInt(params.get('page') ?? '', 10);
    return start >= 1 && start <= totalPages ? start : 1;
  });
  const currentPage = perView === 2 && currentPageState % 2 === 0 ? currentPageState - 1 : currentPageState;
  // Remember that step back, so switching to a phone later stays on the
  // left-hand page (the same as the original site)
  useEffect(() => {
    if (currentPage !== currentPageState) setCurrentPage(currentPage);
  }, [currentPage, currentPageState]);
  const currentRef = useRef(currentPage);
  currentRef.current = currentPage;
  const lastShown = Math.min(currentPage + perView - 1, totalPages);

  // While a page turns, the pages underneath it are shown instead
  const [turnShown, setTurnShown] = useState<number[] | null>(null);
  const shown = turnShown ?? range(currentPage, lastShown);
  const turning = useRef(false);

  // The pages whose pictures have started downloading: the ones showing,
  // and PICTURE_PAGES_AHEAD either side (each page only once)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(() => new Set());
  const shownKey = shown.join(',');
  useEffect(() => {
    const first = Math.max(1, Math.min(...shown) - PICTURE_PAGES_AHEAD);
    const last = Math.min(totalPages, Math.max(...shown) + PICTURE_PAGES_AHEAD);
    setLoadedPages((loaded) => {
      if (range(first, last).every((n) => loaded.has(n))) return loaded;
      return new Set([...loaded, ...range(first, last)]);
    });
  }, [shownKey, totalPages]);

  /* ----- Elements on the page ----- */

  const binderRef = useRef<HTMLElement>(null);
  const moveCircleRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  // Every pocket's link, by its key ("3-5"), so the keyboard can move onto it
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const registerLink = useCallback((key: string, element: HTMLAnchorElement | null) => {
    if (element) links.current.set(key, element);
    else links.current.delete(key);
  }, []);
  // A page's element, by its number
  const pageElement = (n: number) =>
    binderRef.current?.querySelector<HTMLElement>(`[data-page-number="${n}"]`) ?? null;

  /* =====================================================================
     SAVING TO GOOGLE DRIVE
     The binder's real home is its file in Google Drive. This page works on
     the browser's copy and keeps Drive up to date:
     - When the page opens, it fetches the binder from Drive (in case it
       was changed on another computer), or sends this browser's changes.
     - After each change, it saves to Drive a moment later.
     - If the Google sign-in has run out, changes are kept in this browser
       and a "Connect Drive" button appears to sign in again and save.
     ===================================================================== */

  // The save status in the top bar: 'saved', 'saving', 'error', or
  // 'signed-out' (which shows the Connect Drive button)
  const [status, setStatus] = useState<{ state: string; text: string }>({ state: '', text: '' });
  const driveSaveTimer = useRef<number | undefined>(undefined);
  // A note to show once a change is saved (like "✓ Moved to Blue, page 1"),
  // instead of the usual "✓ Saved to Drive"
  const savedNote = useRef<string | null>(null);
  // The drag in progress (for code that runs later), if any
  const dragRef = useRef<{ from: string; target: string | null; circle: 'move' | 'trash' | null } | null>(null);

  // Bring this binder up to date with Google Drive now.
  async function syncWithDrive() {
    window.clearTimeout(driveSaveTimer.current);
    if (isLocalMode()) {
      // Used locally: every change is already saved on this device.
      setStatus({ state: 'saved', text: savedNote.current ?? '✓ Saved on this device' });
      savedNote.current = null;
      return;
    }
    if (!isSignedIn()) {
      setStatus({ state: 'signed-out', text: binderDirtyStamp(binderId) ? 'Not saved to Drive yet' : '' });
      return;
    }
    setStatus({ state: 'saving', text: 'Saving…' });
    const before = JSON.stringify(cardsRef.current);
    try {
      const fresh = await syncBinder(binderId);
      // Drive had a different version (changed elsewhere): show that one.
      // (Not while a card is being dragged, so it doesn't vanish mid-drag.)
      if (!dragRef.current && JSON.stringify(fresh) !== before) {
        cardsRef.current = fresh;
        setCardsState(fresh);
      }
      setStatus({ state: 'saved', text: savedNote.current ?? '✓ Saved to Drive' });
      savedNote.current = null;
    } catch (err) {
      if (err instanceof DriveError && err.signedOut) {
        setStatus({ state: 'signed-out', text: 'Not saved to Drive yet' });
        return;
      }
      // No internet, or a Drive problem: the changes are safe in this
      // browser, so say so, and try again in a while.
      setStatus({ state: 'error', text: err instanceof RequestError && err.offline
        ? 'Offline: changes are kept on this device'
        : 'Couldn\'t save to Google Drive yet: will try again' });
      driveSaveTimer.current = window.setTimeout(() => syncRef.current(), DRIVE_RETRY_MS);
    }
  }
  // The newest syncWithDrive, for timers set earlier
  const syncRef = useRef(syncWithDrive);
  syncRef.current = syncWithDrive;

  // After a change: save to Drive in a moment (restarting the wait if
  // more changes come in quickly).
  function scheduleDriveSave() {
    window.clearTimeout(driveSaveTimer.current);
    if (isLocalMode()) { syncWithDrive(); return; }
    if (!isSignedIn()) { setStatus({ state: 'signed-out', text: 'Not saved to Drive yet' }); return; }
    setStatus({ state: 'saving', text: 'Saving…' });
    driveSaveTimer.current = window.setTimeout(() => syncRef.current(), DRIVE_SAVE_DELAY_MS);
  }

  // When the page opens: get Google's sign-in ready (for Connect Drive)
  // and bring the binder up to date. When the internet comes back, save
  // straight away if there are changes waiting.
  useEffect(() => {
    initGoogleSignIn().catch(() => { /* the Connect button explains if needed */ });
    syncRef.current();
    const onOnline = () => {
      if (!isLocalMode() && binderDirtyStamp(binderId)) syncRef.current();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearTimeout(driveSaveTimer.current);
    };
  }, [binderId]);

  // "Connect Drive": sign in to Google again, then save.
  async function connectDrive() {
    try {
      await signInWithGoogle();
      syncWithDrive();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  /* =====================================================================
     TURNING PAGES
     ===================================================================== */

  // Move forward (+1) or back (-1): two pages at a time on bigger
  // screens. "afterTurn" (optional) runs once the new pages are showing
  // (the keyboard uses it to land on a pocket of the new page).
  // Returns false if there's no page that way (or a turn is under way).
  function turnPage(direction: number, afterTurn?: () => void): boolean {
    if (turning.current) return false;
    const count = isPhone() ? 1 : 2;
    const from = currentRef.current;
    const target = from + count * direction;
    if (target < 1 || target > totalPages) return false;

    // Once the page has turned: show the new page(s). ("flushSync" makes
    // React draw the change right now, so afterTurn finds the new pages.)
    const finish = () => {
      flushSync(() => {
        setTurnShown(null);
        setCurrentPage(target);
      });
      currentRef.current = target;
      turning.current = false;
      afterTurn?.();
    };

    // No animation for "reduce motion" (a system setting), or if
    // something's missing.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const binderEl = binderRef.current;
    if (reduceMotion || !binderEl || !pageElement(from) || !binderEl.animate) {
      finish();
      return true;
    }
    turning.current = true;
    const showUnder = (under: number[]) => () => flushSync(() => setTurnShown(under));
    const common = { binder: binderEl, classes: turnClasses };

    let turn: Promise<void>;
    if (count === 2 && direction === 1) {
      // TWO PAGES, FORWARD: the right page swings over the spine to the
      // left, like turning a book page. Its back is the new left page.
      turn = animateTurn({ ...common, cover: pageElement(from + 1) ?? pageElement(from)!,
        front: pageElement(from + 1), back: pageElement(target), hinge: 'left', from: 0, to: -180,
        landing: pageElement(from), showUnder: showUnder([from, target + 1]) });
    } else if (count === 2) {
      // TWO PAGES, BACKWARD: the left page swings over the spine to the
      // right. Its back is the new right page.
      turn = animateTurn({ ...common, cover: pageElement(from)!, front: pageElement(from),
        back: pageElement(target + 1), hinge: 'right', from: 0, to: 180,
        landing: pageElement(from + 1), showUnder: showUnder([target, from + 1]) });
    } else if (direction === 1) {
      // ONE PAGE (phone), FORWARD: the page swings away to the left and
      // fades out, revealing the next page underneath.
      turn = animateTurn({ ...common, cover: pageElement(from)!, front: pageElement(from), back: null,
        hinge: 'left', from: 0, to: -180, landing: null, fade: 'out', showUnder: showUnder([target]) });
    } else {
      // ONE PAGE (phone), BACKWARD: the previous page swings back in from
      // the left and lands on top of the current one.
      turn = animateTurn({ ...common, cover: pageElement(from)!, front: pageElement(target), back: null,
        hinge: 'left', from: -180, to: 0, landing: null, fade: 'in', showUnder: showUnder([from]) });
    }
    turn.then(finish);
    return true;
  }

  // The class names the page-turn animation uses (from this page's stylesheet)
  const turnClasses = {
    flipper: styles.flipper, face: styles.flipFace, front: styles.flipFront, back: styles.flipBack,
    shade: styles.flipShade, blank: styles.blankPage, shadow: styles.turnShadow,
  };

  // Swiping on a phone: left = next page (like a book), right = previous.
  // It only counts if it went far enough sideways, and more sideways than
  // up or down, so ordinary scrolling doesn't turn the page.
  const touchStart = useRef({ x: 0, y: 0 });

  /* =====================================================================
     CHANGING CARDS
     ===================================================================== */

  // Move the card in one pocket to another (swapping with any card
  // there), and save. Returns false if the browser blocked saving.
  function moveCard(fromKey: string, toKey: string): boolean {
    const next = { ...cardsRef.current };
    const moving = next[fromKey];
    const swapped = next[toKey];
    next[toKey] = moving;
    if (swapped) next[fromKey] = swapped;
    else delete next[fromKey];
    if (!commit(next)) {
      alert('Your browser blocked saving, so the card could not be moved.');
      return false;
    }
    scheduleDriveSave();
    return true;
  }

  // Take a card out of its pocket (all its copies), and save.
  function removeCard(key: string) {
    const next = { ...cardsRef.current };
    if (!next[key]) return;
    delete next[key];
    if (!commit(next)) { alert('Your browser blocked saving, so the card could not be removed.'); return; }
    scheduleDriveSave();
  }

  // One more (+1) or one fewer (-1) copy. One fewer on the last copy asks
  // first ("Remove card?") instead. Returns the new number (0 when the
  // Remove window was opened).
  function changeCopies(key: string, step: number): number {
    const card = cardsRef.current[key];
    if (!card) return 0;
    const count = cardCount(card);
    if (step < 0 && count === 1) { setRemovingKey(key); return 0; }
    const now = step > 0 ? Math.min(count + 1, MAX_COPIES) : count - 1;
    if (!commit({ ...cardsRef.current, [key]: withCount(card, now) })) {
      alert('Your browser blocked saving, so the number could not be changed.');
      return count;
    }
    scheduleDriveSave();
    return now;
  }
  // A version that never changes between redraws, for the pockets'
  // "−" / "+" buttons (so the pockets don't all redraw every time)
  const changeCopiesRef = useRef(changeCopies);
  changeCopiesRef.current = changeCopies;
  const onCopies = useCallback((key: string, step: number) => changeCopiesRef.current(key, step), []);

  // The windows: "Remove card?" and "Move card to…" (each with the
  // pocket it's about), and Keyboard shortcuts
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // The copies are safely in the other binder: take them out of this one
  // (the whole card if all went, otherwise just lower its count), close
  // the window, and save this binder too.
  function takeMovedCardOut(key: string, note: string, amount: number) {
    const next = { ...cardsRef.current };
    const left = cardCount(next[key]) - amount;
    if (left > 0) next[key] = withCount(next[key], left);
    else delete next[key];
    commit(next);
    setMovingKey(null);
    savedNote.current = note;   // shown in the top bar once saved
    scheduleDriveSave();
    returnFocus();
  }

  /* =====================================================================
     DRAGGING CARDS BETWEEN POCKETS (with dnd-kit)
     With a mouse: press on a card and move it (a plain click still opens
     it). On a phone: press and HOLD until it lifts, then slide. Drop on a
     pocket (swapping with any card there), on the red X (remove) or the
     blue circle (move to another binder). Hold it at the left or right
     edge of the binder to turn the page. Escape puts it back.
     ===================================================================== */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 10 } }),
  );
  // The card being dragged (its pocket), the pocket it would drop into,
  // the circle it's over, and the edge it's held at (-1 left, 1 right)
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [overCircle, setOverCircle] = useState<'move' | 'trash' | null>(null);
  const [edge, setEdgeState] = useState(0);
  const edgeRef = useRef(0);
  const edgeTimer = useRef<number | undefined>(undefined);
  // Where the pointer was when the drag started, and when the last drag
  // ended (the click right after a drag is ignored)
  const dragStart = useRef({ x: 0, y: 0 });
  const lastDragEnd = useRef(0);

  // Is the point within reach of a drop circle's center (and showing)?
  function isOverCircle(circle: HTMLElement | null, x: number, y: number): boolean {
    const box = circle?.getBoundingClientRect();
    if (!box || box.width === 0) return false;
    return Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2)) <= CIRCLE_REACH;
  }

  // The real (showing) pocket under a point, if any (not the copies on a
  // turning page, and not the floating card itself)
  function pocketAt(x: number, y: number): string | null {
    for (const element of document.elementsFromPoint(x, y)) {
      const pocket = (element as HTMLElement).closest<HTMLElement>('[data-key]');
      if (pocket && binderRef.current?.contains(pocket) && !pocket.closest(`.${styles.flipper}`)) {
        return pocket.dataset.key!;
      }
    }
    return null;
  }

  // Start or stop the "turn the page" countdown when the card reaches or
  // leaves an edge. While it's held there, the page keeps turning.
  function setEdge(next: number) {
    if (next === edgeRef.current) return;
    edgeRef.current = next;
    setEdgeState(next);
    window.clearTimeout(edgeTimer.current);
    if (next !== 0) edgeTimer.current = window.setTimeout(turnFromEdge, EDGE_WAIT_MS);
  }
  function turnFromEdge() {
    if (!dragRef.current || edgeRef.current === 0) return;
    turnRef.current(edgeRef.current);   // does nothing at the first or last page
    edgeTimer.current = window.setTimeout(turnFromEdge, TURN_MS + EDGE_WAIT_MS);
  }
  const turnRef = useRef(turnPage);
  turnRef.current = turnPage;

  // The pointer moved during a drag: light up the circle or pocket under
  // it, and check whether it's at an edge of the binder.
  function trackDrag(x: number, y: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const circle = isOverCircle(trashRef.current, x, y) ? 'trash'
      : isOverCircle(moveCircleRef.current, x, y) ? 'move' : null;
    const target = circle ? null : pocketAt(x, y);
    drag.circle = circle;
    drag.target = target;
    setOverCircle(circle);
    setDragTarget(target && target !== drag.from ? target : null);
    const box = binderRef.current!.getBoundingClientRect();
    const nearHeight = y > box.top - 40 && y < box.bottom + 40;
    setEdge(nearHeight && x < box.left + EDGE_ZONE ? -1 : nearHeight && x > box.right - EDGE_ZONE ? 1 : 0);
  }

  function handleDragStart({ active, activatorEvent }: DragStartEvent) {
    const from = String(active.id);
    if (carrying) setCarrying(null);   // only one card moves at a time
    // Where the pointer started (a mouse press, or a finger)
    const touch = typeof TouchEvent !== 'undefined' && activatorEvent instanceof TouchEvent
      ? activatorEvent.touches[0] : null;
    const mouse = activatorEvent as MouseEvent;
    dragStart.current = touch ? { x: touch.clientX, y: touch.clientY } : { x: mouse.clientX, y: mouse.clientY };
    if (touch) hapticTap();   // a small buzz or tick: the card has lifted (lib/haptics.ts)
    dragRef.current = { from, target: null, circle: null };
    setDragFrom(from);
    document.body.classList.add(styles.dragging);   // the "grabbing hand" everywhere
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    trackDrag(dragStart.current.x + delta.x, dragStart.current.y + delta.y);
  }

  // Let go: remove it (red X), open "Move card to…" (blue circle), move it
  // to another pocket, or (anywhere else) it goes back where it was.
  function handleDragEnd() {
    const drag = dragRef.current;
    endDrag();
    if (!drag) return;
    if (drag.circle === 'trash') removeCard(drag.from);
    else if (drag.circle === 'move') setMovingKey(drag.from);
    else if (drag.target && drag.target !== drag.from) moveCard(drag.from, drag.target);
  }

  // Clean up after a drag: highlights, timers and the edge glow.
  function endDrag() {
    dragRef.current = null;
    setDragFrom(null);
    setDragTarget(null);
    setOverCircle(null);
    setEdge(0);
    window.clearTimeout(edgeTimer.current);
    document.body.classList.remove(styles.dragging);
    lastDragEnd.current = Date.now();
  }

  /* =====================================================================
     USING THE KEYBOARD
     Tab gets into the binder (it lands on one pocket: only that one is a
     Tab stop), then:
       Arrow keys      pocket to pocket (past the left or right edge turns
                       the page)
       Page Up / Down  turn the page
       Enter           open the card (or, on an empty pocket, add one)
       Space           pick up the card: arrows choose where, Space or
                       Enter drops it (swapping), Escape puts it back
       + / −           one more / one fewer copy
       Delete          remove the card (it asks first)
       M               move the card to another binder
       ?               (anywhere) the Keyboard shortcuts window
     ===================================================================== */

  // The pocket the keyboard is on. If its page isn't showing (the page
  // was turned with the mouse or a swipe), the same spot on the page
  // that's showing is used instead.
  const [activeKeyState, setActiveKey] = useState(pocketKey(1, 1));
  const activeKey = shown.includes(pageOf(activeKeyState)) ? activeKeyState : pocketKey(shown[0], slotOf(activeKeyState));
  const activeRef = useRef(activeKey);
  activeRef.current = activeKey;
  // The card being carried with the keyboard (its starting pocket), and
  // whether the keyboard is in the binder (so the key guide shows)
  const [carrying, setCarrying] = useState<string | null>(null);
  const [keyboardHere, setKeyboardHere] = useState(false);
  // True after M, Delete or − (last copy) opened a window from the keyboard
  const keyboardOpenedWindow = useRef(false);

  /* ----- A card found with the search bar ----- */

  // The search bar opens a binder with "highlight=3-5" in the address:
  // turn to that pocket's page, put the keyboard's pocket there, and
  // highlight it (until the next click or key press in the binder).
  // "location.key" is new each time, so finding the same card again
  // highlights it again.
  const location = useLocation();
  const highlightParam = params.get('highlight');
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightParam || !/^\d+-\d+$/.test(highlightParam)) return;
    const page = pageOf(highlightParam);
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setActiveKey(highlightParam);
    setHighlightKey(highlightParam);
  }, [highlightParam, location.key, totalPages]);

  // Put the keyboard back on its pocket after a window it opened closes.
  function returnFocus() {
    if (!keyboardOpenedWindow.current) return;
    keyboardOpenedWindow.current = false;
    requestAnimationFrame(() => links.current.get(activeRef.current)?.focus());
  }

  // The first and last page showing right now
  const pagesInView = () => ({ first: currentRef.current, last: Math.min(currentRef.current + (isPhone() ? 0 : 1), totalPages) });

  // The pocket at a column and row of what's showing. Columns count across
  // both pages (0-7 with two pages, 0-3 on a phone); rows go 0-3.
  function pocketInView(column: number | 'last', row: number): string {
    const { first, last } = pagesInView();
    const columns = (last - first + 1) * 4;
    const col = column === 'last' || column >= columns ? columns - 1 : column;
    return pocketKey(first + Math.floor(col / 4), row * 4 + (col % 4) + 1);
  }

  // Where a pocket is in what's showing: { column, row }
  function placeInView(key: string) {
    return { column: (pageOf(key) - currentRef.current) * 4 + (slotOf(key) - 1) % 4, row: Math.floor((slotOf(key) - 1) / 4) };
  }

  // Go to a pocket. While carrying a card, screen readers hear what's there.
  function goTo(key: string) {
    setActiveKey(key);
    activeRef.current = key;
    links.current.get(key)?.focus();
    if (!carryingRef.current) return;
    const from = carryingRef.current;
    const there = cardsRef.current[key];
    announce(key === from ? `Back at ${placeName(key)}, where it started.`
      : there ? `${placeName(key)}: swap with ${there.name}.`
        : `${placeName(key)}: empty.`);
  }
  const carryingRef = useRef(carrying);
  carryingRef.current = carrying;

  // An arrow key: one pocket left / right (dx) or up / down (dy). Past the
  // edge of what's showing, the page turns (if there is one) and the
  // keyboard lands on the near edge of the new page, in the same row.
  function arrowMove(dx: number, dy: number) {
    const { column, row } = placeInView(activeKey);
    const { first, last } = pagesInView();
    const columns = (last - first + 1) * 4;
    const newRow = Math.max(0, Math.min(3, row + dy));
    const newColumn = column + dx;
    if (newColumn < 0 && turnPage(-1, () => goTo(pocketInView('last', newRow)))) return;
    if (newColumn >= columns && turnPage(1, () => goTo(pocketInView(0, newRow)))) return;
    // No page that way (or still on this page): stay inside what's showing.
    goTo(pocketInView(Math.max(0, Math.min(columns - 1, newColumn)), newRow));
  }

  // Page Up / Page Down: turn the page, landing on the same spot.
  function pageMove(direction: number) {
    const { column, row } = placeInView(activeKey);
    if (!turnPage(direction, () => goTo(pocketInView(column, row)))) {
      announce(direction > 0 ? 'This is the last page.' : 'This is the first page.');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const pocket = target.closest<HTMLElement>('[data-key]');
    if (!pocket || target.closest(`.${styles.copiesBar}`) || dragFrom) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const key = pocket.dataset.key!;
    const card = cardsRef.current[key];

    // Arrow keys and Page Up / Down (not while a page is mid-turn)
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();               // don't scroll the page
      if (!turning.current) arrowMove(...moves[event.key]);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      if (!turning.current) pageMove(event.key === 'PageDown' ? 1 : -1);
      return;
    }

    // While carrying a card: drop it here, cancel, or (Tab) give up.
    if (carrying) {
      const name = cardsRef.current[carrying].name;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();             // Enter mustn't open the card here
        if (turning.current) return;
        setCarrying(null);
        if (key === carrying) { announce(`${name} stays at ${placeName(key)}.`); return; }
        const swapped = cardsRef.current[key];
        if (moveCard(carrying, key)) {
          announce(`Moved ${name} to ${placeName(key)}.` + (swapped ? ` ${swapped.name} moved to ${placeName(carrying)}.` : ''));
        }
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        setCarrying(null);
        announce(`Cancelled. ${name} stays at ${placeName(carrying)}.`);
      }
      return;
    }

    // The rest only do something on a card. (Enter is left alone, so it
    // opens the pocket's link like a click.)
    if (!card) return;
    if (event.key === ' ') {
      event.preventDefault();               // don't scroll the page
      setCarrying(key);
      announce(`Picked up ${card.name} from ${placeName(key)}. ` +
        'Use the arrow keys to choose a pocket, then Space to drop it, or Escape to cancel.');
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      const now = changeCopies(key, 1);
      announce(`${now} ${now === 1 ? 'copy' : 'copies'} of ${card.name}.`);
    } else if (event.key === '-' || event.key === '_' || event.key === '−') {
      event.preventDefault();
      if (cardCount(card) === 1) keyboardOpenedWindow.current = true;   // asks first
      const now = changeCopies(key, -1);
      if (now > 0) announce(`${now} ${now === 1 ? 'copy' : 'copies'} of ${card.name}.`);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      keyboardOpenedWindow.current = true;
      setRemovingKey(key);
    } else if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      keyboardOpenedWindow.current = true;
      setMovingKey(key);
    }
  }

  // Keep track of whether the keyboard is on a pocket. ":focus-visible"
  // means it got there by keyboard (not a mouse click).
  function checkKeyboardHere() {
    const focused = document.activeElement as HTMLElement | null;
    setKeyboardHere(Boolean(focused?.closest('[data-key]') && binderRef.current?.contains(focused) &&
      focused.matches(':focus-visible')));
  }

  // The ? key, anywhere: the Keyboard shortcuts window (a carried card
  // is put back first)
  useShortcutKeys((event) => {
    if (event.key !== '?') return;
    event.preventDefault();
    setCarrying(null);
    setShortcutsOpen(true);
  });

  // The key guide at the top: which keys do what right now
  const hint = carrying && cards[carrying]
    ? `Carrying ${cards[carrying].name}: ←↑↓→ choose a pocket · Space or Enter drop · Esc cancel`
    : cards[activeKey]
      ? '←↑↓→ move · Space pick up · Enter open · M move to binder · Del remove · + / − copies · PgUp / PgDn turn page · ? all keys'
      : '←↑↓→ move · Enter add a card · PgUp / PgDn turn page · ? all keys';

  /* =====================================================================
     DROPPING CARD PICTURES FROM OTHER WEBSITES (see lib/cardDrop.ts)
     ===================================================================== */

  // The empty pocket a picture is being dragged over, and the pocket
  // waiting for Scryfall to say which card was dropped on it
  const [outsideTarget, setOutsideTarget] = useState<string | null>(null);
  const [dropLoading, setDropLoading] = useState<string | null>(null);

  // The empty pocket under an outside drag, or null
  function emptyPocketFrom(target: EventTarget | null): string | null {
    const pocket = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-key]');
    if (!pocket || !binderRef.current?.contains(pocket)) return null;
    return cardsRef.current[pocket.dataset.key!] ? null : pocket.dataset.key!;
  }

  // Dropped on an empty pocket: look the card up and put it there.
  async function handleOutsideDrop(dataTransfer: DataTransfer, key: string) {
    const lookup = lookupFromDrop(dataTransfer);
    if (!lookup) {
      setStatus({ state: 'error', text: 'That isn\'t a card picture from Scryfall or EDHREC' });
      return;
    }
    setDropLoading(key);
    setStatus({ state: 'saving', text: 'Finding the card…' });
    try {
      const card = binderCardFrom(await loadOneCard(lookup.path), lookup.face);
      // Something else may have filled the pocket while we waited.
      if (cardsRef.current[key]) throw new Error('That pocket was filled in the meantime.');
      if (!commit({ ...cardsRef.current, [key]: card })) {
        throw new Error('Your browser blocked saving, so the card could not be added.');
      }
      savedNote.current = `✓ Added ${card.name}`;   // shown once it's saved
      scheduleDriveSave();
      announce(`Added ${card.name} to ${placeName(key)}.`);
    } catch (err) {
      setStatus({ state: 'error', text: (err as Error).message });
    } finally {
      setDropLoading(null);
    }
  }

  // Anywhere else on the page, a dropped picture or link would make the
  // browser leave the binder to show it. Stop that, so a near-miss
  // doesn't lose your place.
  useEffect(() => {
    function stop(event: DragEvent) {
      if (isOutsideDrag(event.dataTransfer) && !binderRef.current?.contains(event.target as Node)) event.preventDefault();
    }
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  /* =====================================================================
     DRAWING THE PAGE
     ===================================================================== */

  // The top bar's middle box (drawn by the top bar), where the save
  // status goes. It's found once the page has been drawn.
  const [toolsBox, setToolsBox] = useState<HTMLElement | null>(null);
  useEffect(() => setToolsBox(document.getElementById(TOPBAR_TOOLS_ID)), []);

  // Not using the binders: go to the welcome page. A binder that isn't
  // in the list (deleted, or from someone else's account): go to the shelf.
  if (!usingBinders) return <Navigate to="/" replace />;
  if (!binder) return <Navigate to="/binders" replace />;

  const draggedCard = dragFrom ? cards[dragFrom] : undefined;
  const removing = removingKey ? cards[removingKey] : undefined;
  const moving = movingKey ? cards[movingKey] : undefined;

  return (
    <div className={styles.page}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>{`${binder.name} – WUBRG'r`}</title>

      {/* In the middle of the top bar: the binder's name, then its save
          status. (On narrow windows, the top bar moves both to a second
          row, under "WUBRG'r".) The save
          status is "✓ Saved to Drive", "Saving…" and so on, read out by
          screen readers as it changes, with "Connect Drive" when the
          Google sign-in has run out. */}
      {toolsBox && createPortal(
        <>
          <h2 className={styles.binderName}>{binder.name}</h2>
          <span className={styles.statusGroup}>
            <span className={styles.syncStatus} data-state={status.state} aria-live="polite">{status.text}</span>
            {status.state === 'signed-out' && (
              <button className={styles.toolLink} type="button" onClick={connectDrive}>
                {/* Cloud icon */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" />
                </svg>
                Connect Drive
              </button>
            )}
          </span>
        </>,
        toolsBox,
      )}

      {/* Search the cards in every binder (or, with its box ticked, just
          this one), as wide as the binder */}
      <div className={styles.searchRow}>
        <BinderSearch currentBinderId={binderId} />
      </div>

      <DndContext
        sensors={sensors}
        autoScroll={false}
        // Don't put the keyboard back on the card after a drop (a window
        // may have just opened)
        accessibility={{ restoreFocus: false }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={endDrag}
      >
        {/* THE OPEN BINDER: the black cover with the page(s) lying on it */}
        <section
          ref={binderRef}
          className={`${styles.binder} ${edge === -1 ? styles.edgeLeft : ''} ${edge === 1 ? styles.edgeRight : ''}`}
          aria-label="Card binder"
          onKeyDown={handleKeyDown}
          // When the keyboard arrives on a pocket (by Tab, arrows or a
          // click), it becomes the keyboard's pocket
          onFocus={(event) => {
            const pocket = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
            if (pocket && !(event.target as HTMLElement).closest(`.${styles.copiesBar}`)) setActiveKey(pocket.dataset.key!);
            checkKeyboardHere();
          }}
          onBlur={() => setTimeout(checkKeyboardHere, 0)}
          // Ignore the click browsers send right after a drag, so
          // dropping a card doesn't also open it in the card search
          onClickCapture={(event) => {
            if (dragFrom || Date.now() - lastDragEnd.current < 400) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          // A long press on a phone normally opens a menu (Save image,
          // Open link…); block it on cards, since a long press picks it up
          onContextMenu={(event) => {
            if ((event.target as HTMLElement).closest(`.${styles.pocketCard}`)) event.preventDefault();
          }}
          // Starting a mouse or finger drag while carrying a card with the
          // keyboard puts the keyboard's card back first. Any click (or
          // key press) in the binder also ends a search highlight.
          onPointerDownCapture={() => { setCarrying(null); setHighlightKey(null); }}
          onKeyDownCapture={() => setHighlightKey(null)}
          // Swiping on a phone (see touchStart above)
          onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
          onTouchEnd={(event) => {
            if (!isPhone() || dragRef.current) return;
            const moveX = event.changedTouches[0].clientX - touchStart.current.x;
            const moveY = event.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(moveX) < SWIPE_DISTANCE || Math.abs(moveX) < Math.abs(moveY)) return;
            turnPage(moveX < 0 ? 1 : -1);   // moved left (negative) = forward
          }}
          // A card picture dragged in from another website, over an empty
          // pocket: outline it, and say "copy" so the browser allows the drop
          onDragOver={(event) => {
            if (!isOutsideDrag(event.dataTransfer)) return;
            const key = emptyPocketFrom(event.target);
            if (!key) { setOutsideTarget(null); event.dataTransfer.dropEffect = 'none'; return; }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setOutsideTarget(key);
          }}
          onDragLeave={(event) => {
            if (!binderRef.current?.contains(event.relatedTarget as Node)) setOutsideTarget(null);
          }}
          onDrop={(event) => {
            if (!isOutsideDrag(event.dataTransfer)) return;
            event.preventDefault();
            setOutsideTarget(null);
            const key = emptyPocketFrom(event.target);
            if (key) handleOutsideDrop(event.dataTransfer, key);
          }}
        >
          {/* The drop circles, shown only while a card is being dragged:
              blue "move to another binder" (1/3 down) and red "remove"
              (1/3 up from the bottom). aria-hidden: they only work with
              dragging, so screen readers skip them. */}
          <div ref={moveCircleRef} className={`${styles.moveCircle} ${overCircle === 'move' ? styles.active : ''}`} aria-hidden="true">
            {/* A folder with an arrow going into it */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 13h7M13 10l3 3-3 3" />
            </svg>
          </div>
          <div ref={trashRef} className={`${styles.trashCircle} ${overCircle === 'trash' ? styles.active : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </div>

          {/* The pages near the ones showing (PICTURE_PAGES_AHEAD either
              side), each with its 16 pockets. Only the one or two showing
              are visible; the others are ready for a page turn. Pages
              further away aren't drawn at all, so a binder with hundreds of
              pages opens as fast as a small one. */}
          {range(
            Math.max(1, Math.min(...shown) - PICTURE_PAGES_AHEAD),
            Math.min(totalPages, Math.max(...shown) + PICTURE_PAGES_AHEAD),
          ).map((n) => (
            <div key={n} className={styles.binderPage} data-page-number={n} aria-label={`Page ${n}`} hidden={!shown.includes(n)}>
              {range(1, POCKETS_PER_PAGE).map((slot) => {
                const key = pocketKey(n, slot);
                return (
                  <Pocket
                    key={slot}
                    binderId={binderId}
                    page={n}
                    slot={slot}
                    card={cards[key]}
                    tabStop={key === activeKey}
                    loaded={loadedPages.has(n)}
                    faded={carrying === key}
                    highlighted={highlightKey === key}
                    outlined={dragTarget === key || outsideTarget === key ||
                      (carrying !== null && activeKey === key && carrying !== key)}
                    loading={dropLoading === key}
                    registerLink={registerLink}
                    onCopies={onCopies}
                  />
                );
              })}
            </div>
          ))}
        </section>

        {/* The floating copy of the card that follows the pointer, tilted
            a little. It fades over a drop circle, so the circle shows. */}
        <DragOverlay dropAnimation={null}>
          {draggedCard && (
            <div className={`${styles.ghost} ${overCircle ? styles.overCircle : ''}`}>
              <img src={draggedCard.image} alt="" />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Previous / Next page, with the page number between them. Each has
          a long and a short label: phones show the short one. */}
      <nav className={styles.pageNav} aria-label="Binder pages">
        <button className={styles.pageLink} type="button" aria-label="Previous page"
                disabled={currentPage <= 1} onClick={() => turnPage(-1)}>
          ← <span className={styles.labelLong}>Previous page</span><span className={styles.labelShort}>Previous</span>
        </button>
        {/* "Page 3 of 10" on a phone, "Pages 3–4 of 10" on bigger screens */}
        <span className={styles.pageStatus} aria-live="polite">
          {currentPage === lastShown ? `Page ${currentPage} of ${totalPages}` : `Pages ${currentPage}–${lastShown} of ${totalPages}`}
        </span>
        <button className={styles.pageLink} type="button" aria-label="Next page"
                disabled={lastShown >= totalPages} onClick={() => turnPage(1)}>
          <span className={styles.labelLong}>Next page</span><span className={styles.labelShort}>Next</span> →
        </button>
      </nav>

      {/* The key guide (aria-hidden: screen readers hear the same help
          from the announcements instead) */}
      <div className={styles.keyboardHint} aria-hidden="true" hidden={!(carrying || keyboardHere)}>{hint}</div>

      {/* "Remove card?": "No" comes first so Enter does the safe thing */}
      {removing && (
        <Modal
          labelledBy="removeCardTitle"
          onClose={(value) => {
            if (value === 'yes') removeCard(removingKey!);
            setRemovingKey(null);
            returnFocus();
          }}
        >
          <form method="dialog">
            <h2 id="removeCardTitle" className={windows.title}>Remove card?</h2>
            <p className={styles.dialogText}>Remove "{removing.name}" from this binder?</p>
            <div className={`${windows.buttons} ${windows.normalOrder}`}>
              <button value="no" className={windows.button} type="submit">No</button>
              <button value="yes" className={`${windows.button} ${windows.danger}`} type="submit">Yes, remove</button>
            </div>
          </form>
        </Modal>
      )}

      {moving && (
        <MoveCardDialog
          binderId={binderId}
          card={moving}
          onMoved={(note, amount) => takeMovedCardOut(movingKey!, note, amount)}
          onCancel={() => { setMovingKey(null); returnFocus(); }}
        />
      )}

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        intro={<>Press <kbd>Tab</kbd> to get into the binder, then:</>}
        shortcuts={binderShortcuts}
      />
      {announcer}
    </div>
  );
}
