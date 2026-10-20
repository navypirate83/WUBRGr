/* =====================================================================
   MY BINDERS: YOUR SHELF OF BINDERS
   Who's signed in (or "Saved on this device only"), then the shelf (see
   Shelf.tsx), and a message line under it.
   This file does the work behind the shelf: loading the binders from
   Google Drive, and making, uploading, editing, moving, deleting and
   downloading them. Each change shows on the shelf straight away, then
   is saved to Drive (when signed in).
   Only for someone signed in, or using the site locally: anyone else is
   sent to the welcome page to sign in.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAccount } from '../../hooks/useAccount';
import { useAnnouncer } from '../../hooks/useAnnouncer';
import { useShortcutKeys } from '../../hooks/useShortcutKeys';
import ShortcutsDialog, { type Shortcut } from '../../components/ShortcutsDialog';
import NewBinderDialog, { type UploadedBinder } from '../../components/binders/NewBinderDialog';
import BinderSearch from '../../components/binders/BinderSearch';
import Shelf, { type ShelfHandle } from './Shelf';
import { BinderPropertiesDialog, DeleteBinderDialog, type BinderChanges } from './BinderWindows';
import {
  DEFAULT_COVER, DEFAULT_PAGES, OLD_SINGLE_BINDER_KEY,
  binderCardCount, binderDetails, binderPages, cardCountText, cleanCards, cleanCover, cleanPageCount,
  fitCardsIntoPages, forgetBinder, loadBinder, loadBinderList, manaColor, minPagesFor, saveBinder, saveBinderList,
  type Binder,
} from '../../lib/binderStorage';
import { binderToCsv } from '../../lib/binderCsv';
import {
  DriveError, createBinderFile, getDriveUser, listBinderFiles, nameFromFileName, syncBinder,
  trashBinderFile, updateBinderDetails,
} from '../../lib/googleDrive';
import { storageGet, storageRemove } from '../../lib/storage';
import styles from './BindersPage.module.css';

// The keys listed in this page's Keyboard shortcuts window (press ?)
const shelfShortcuts: Shortcut[] = [
  { keys: <><kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd></>, does: 'Move from binder to binder (the + New binder is last)' },
  { keys: <><kbd>Home</kbd> <kbd>End</kbd></>, does: 'The first binder / the +' },
  { keys: <kbd>Enter</kbd>, does: 'Open the binder (on the +, make a new one)' },
  { keys: <kbd>Space</kbd>, does: 'Pick up the binder. Then the arrows choose its spot, Space drops it, Esc cancels' },
  { keys: <kbd>E</kbd>, does: 'Binder properties (rename, pages, cover)' },
  { keys: <kbd>Delete</kbd>, does: 'Delete the binder (it asks first)' },
  { keys: <kbd>D</kbd>, does: 'Download the binder as a .CSV file' },
  { keys: <kbd>N</kbd>, does: 'Make a new binder' },
  { keys: <kbd>?</kbd>, does: 'Show this list' },
];

export default function BindersPage() {
  const { signedIn, localMode } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();

  // The binders on the shelf, in order (this browser's list to start,
  // then the list from Google Drive once it has loaded)
  const [binders, setBinders] = useState<Binder[]>(loadBinderList);
  // A number that goes up to redraw the card counts after cards change
  const [, setCardsChanged] = useState(0);
  // The line above the shelf, and the message under it (red if an error).
  // Another page can send a message, like "✓ Added Lightning Bolt…".
  const [account, setAccount] = useState(localMode ? 'Saved on this device only' : '');
  const [message, setMessage] = useState<{ text: string; error?: boolean }>({ text: location.state?.message ?? '' });
  // While a new binder is being made: the "+" is greyed out
  const [adding, setAdding] = useState(false);
  // Which window is open: New binder, Binder properties or Delete (with
  // the binder's id), or Keyboard shortcuts
  const [newOpen, setNewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { announce, announcer } = useAnnouncer();
  const shelfRef = useRef<ShelfHandle>(null);
  // Set once loading from Drive has started, so it only runs once (React
  // runs start-up code twice while working locally, to check for mistakes)
  const loadStarted = useRef(false);
  // Was the shelf showing? (Then losing the sign-in means it ran out.)
  const wasShowing = useRef(false);

  // The card count of every binder, from this browser's copy
  const counts = Object.fromEntries(binders.map((b) => [b.id, binderCardCount(b.id)]));

  // Show the shelf with a new list of binders, and keep the list in this
  // browser too.
  function showBinders(list: Binder[]) {
    saveBinderList(list);
    setBinders(list);
  }

  // Something went wrong talking to Google Drive. If the sign-in ran out,
  // go back to the welcome page to sign in again; otherwise say what
  // happened under the shelf.
  function problem(err: unknown, what: string) {
    if (err instanceof DriveError && err.signedOut) {
      navigate('/', { state: { message: err.message } });
      return;
    }
    setMessage({ text: `${what} ${(err as Error).message}`, error: true });
  }

  /* ----- Loading the binders from Google Drive ----- */

  // Signed in: the binders this browser knows about show straight away,
  // then the shelf is refreshed from Google Drive.
  useEffect(() => {
    if (!signedIn || loadStarted.current) return;
    loadStarted.current = true;
    const incoming = location.state?.message;
    if (!incoming) setMessage({ text: 'Loading your binders…' });
    (async () => {
      try {
        // Who's signed in (shown above the shelf)
        const user = await getDriveUser();
        setAccount(`Signed in as ${user.displayName || user.emailAddress}`);

        // The binder files in their Drive (oldest first), with each one's
        // cover symbol, cover color, pages and shelf position (labels on
        // the file; an unknown symbol counts as none, no cover color
        // means black, and no page count means 10)
        const files = await listBinderFiles();
        let list = files.map((file) => {
          const labels = file.appProperties ?? {};
          return {
            id: file.id,
            name: nameFromFileName(file.name),
            color: manaColor(labels.color) ? labels.color : null,
            cover: cleanCover(labels.cover),
            pages: cleanPageCount(labels.pages),
            order: labels.order !== undefined ? Number(labels.order) : Infinity,
          };
        });
        // Put them in the order they were arranged. Binders without a
        // saved position go after the others, oldest first.
        list.sort((a, b) => a.order - b.order);
        let ordered: Binder[] = list.map(({ id, name, color, cover, pages }) => ({ id, name, color, cover, pages }));

        // First time signing in? If this browser still has cards from
        // before binders were saved in Drive, move them into a first binder.
        if (ordered.length === 0) ordered = await moveOldCardsIntoFirstBinder();

        // Bring each binder up to date between this browser and Drive
        // (all at once), which also gives each binder's card count.
        saveBinderList(ordered);
        await Promise.all(ordered.map((b) => syncBinder(b.id)));
        setBinders(ordered);
        setCardsChanged((n) => n + 1);
        if (!incoming) setMessage({ text: '' });
      } catch (err) {
        problem(err, 'Couldn\'t load your binders from Google Drive.');
      }
    })();
  }, [signedIn]);

  // If cards from the old single binder are still in this browser, put
  // them into a new "Binder 1" and forget the old copy.
  async function moveOldCardsIntoFirstBinder(): Promise<Binder[]> {
    let oldCards: unknown = {};
    try { oldCards = JSON.parse(storageGet(OLD_SINGLE_BINDER_KEY) ?? '{}'); } catch { /* unreadable */ }
    const { cards } = cleanCards(oldCards);
    if (Object.keys(cards).length === 0) return [];
    const name = 'Binder 1';
    const file = await createBinderFile(name, cards);
    saveBinder(cards, file.id, { dirty: false });
    storageRemove(OLD_SINGLE_BINDER_KEY);
    return [{ id: file.id, name, color: null, cover: DEFAULT_COVER, pages: DEFAULT_PAGES }];
  }

  /* ----- Making a binder (the New binder window, or Upload file) ----- */

  // Make a new binder at the end of the shelf, in Google Drive (or on
  // this device, when used locally), with these cards (often none).
  async function addBinder(details: Omit<Binder, 'id'>, cards = {}, doneMessage = '') {
    setAdding(true);
    setMessage({ text: cards && Object.keys(cards).length ? `Adding ${details.name}…` : 'Making a new binder…' });
    try {
      const list = loadBinderList();
      const file = await createBinderFile(details.name, cards, details.color, list.length, details.cover, details.pages);
      saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
      showBinders([...list, { id: file.id, ...details }]);
      setMessage({ text: doneMessage });
    } catch (err) {
      problem(err, 'Couldn\'t make a new binder.');
    }
    setAdding(false);
  }

  // A binder file was uploaded: add it, and say how many cards it has
  // (and how many unreadable entries were skipped, if any).
  function addUploadedBinder({ name, color, cover, pages, cards, skipped }: UploadedBinder) {
    const count = Object.keys(cards).length;
    addBinder({ name, color, cover, pages }, cards,
      `✓ Added ${name} with ${cardCountText(count)}` +
      (skipped > 0 ? ` (${skipped} unreadable entr${skipped === 1 ? 'y' : 'ies'} skipped).` : '.'));
  }

  /* ----- Moving a binder to another spot ----- */

  // The binders in between shift along by one to make room. Then every
  // binder's position (0, 1, 2, ...) is saved as a label on its Drive
  // file, so the order is the same on every computer.
  async function moveBinder(id: string, targetId: string) {
    const list = loadBinderList();
    const from = list.findIndex((b) => b.id === id);
    const to = list.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) return;
    const [moving] = list.splice(from, 1);   // take it out...
    list.splice(to, 0, moving);              // ...and put it in its new spot
    showBinders(list);
    if (localMode) return;
    setMessage({ text: 'Saving the new order…' });
    try {
      await Promise.all(list.map((b, index) => updateBinderDetails(b.id, { order: index })));
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t save the new order to Google Drive.');
    }
  }

  /* ----- Binder properties: saving the changes ----- */

  async function saveChanges(id: string, { name, color, cover, pages }: BinderChanges) {
    const oldPages = binderPages(id);
    // Show the change straight away...
    const list = loadBinderList();
    const binder = list.find((b) => b.id === id);
    if (!binder) return;
    Object.assign(binder, { name, color, cover, pages });
    showBinders(list);

    // ...then save it (to Drive, renaming the file and setting its labels).
    setMessage({ text: localMode ? '' : 'Saving…' });
    try {
      // Fewer pages than before? Make sure no card is left on a page
      // that's going away: get the binder's latest cards, and move any on
      // those pages into empty pockets on the pages that stay.
      if (pages < oldPages) {
        const cards = await syncBinder(id);
        // (If cards were added on another computer meanwhile, it may need
        // more pages than the window allowed: never go below that.)
        const needed = minPagesFor(Object.keys(cards).length);
        if (pages < needed) {
          pages = needed;
          binder.pages = pages;
          showBinders([...list]);
        }
        const fitted = fitCardsIntoPages(cards, pages);
        if (JSON.stringify(fitted) !== JSON.stringify(cards)) {
          saveBinder(fitted, id);    // keep the moved cards (marked "needs saving")...
          await syncBinder(id);      // ...and save them to Drive
        }
      }
      await updateBinderDetails(id, { name, color, cover, pages });
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t save the changes to Google Drive.');
    }
  }

  /* ----- Deleting a binder ----- */

  // Move its file to the Drive trash (nothing to do there when used
  // locally), then take it off the shelf and out of this browser.
  async function deleteBinder(id: string) {
    setMessage({ text: 'Deleting…' });
    try {
      await trashBinderFile(id);
      forgetBinder(id);
      setBinders(loadBinderList());
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t delete the binder.');
    }
  }

  /* ----- Downloading a binder as a .CSV file ----- */

  // Save one binder as a .csv file: its cards (one per line, with the
  // page and pocket each is in) and its name, cover symbol, cover color
  // and pages, the same as its Drive file (see lib/binderCsv.ts). When
  // signed in, get its latest cards from Drive first (it may have been
  // changed on another computer); if that isn't possible, use this
  // browser's copy.
  async function downloadBinder(id: string) {
    if (!localMode) {
      try { await syncBinder(id); } catch { /* use this browser's copy */ }
    }
    const details = binderDetails(id);
    const file = new Blob([binderToCsv(details, loadBinder(id))], { type: 'text/csv' });
    // The browser saves files from a link, so make an invisible link to
    // the file's contents, "click" it, then clean up.
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    // e.g. "Binder 1 2026-10-16.csv" (characters not allowed in file names removed)
    link.download = `${details.name.replace(/[\\/:*?"<>|]/g, '')} ${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);   // free the memory the file was using
  }

  /* ----- The ? key: the Keyboard shortcuts window ----- */

  useShortcutKeys((event) => {
    if (event.key !== '?') return;
    event.preventDefault();
    setShortcutsOpen(true);
  });

  // Not signed in and not using the site locally: go to the welcome page
  // to sign in. (If the shelf was showing, the sign-in has just run out.)
  if (!signedIn && !localMode) {
    const expired = wasShowing.current ? { message: 'Your Google sign-in has expired. Please sign in again.' } : undefined;
    return <Navigate to="/" replace state={expired} />;
  }
  wasShowing.current = true;

  const editing = editingId ? binders.find((b) => b.id === editingId) : undefined;
  const deleting = deletingId ? binders.find((b) => b.id === deletingId) : undefined;

  return (
    <section className={styles.shelfArea} aria-labelledby="shelfTitle">
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>My Binders – WUBRG'r</title>

      {/* Search every card in every binder */}
      <div className={styles.searchRow}>
        <BinderSearch />
      </div>

      <div className={styles.accountLine}>{account}</div>
      <h2 id="shelfTitle" className="visually-hidden">My binders</h2>

      <Shelf
        ref={shelfRef}
        binders={binders}
        counts={counts}
        addDisabled={adding}
        onMove={moveBinder}
        onEdit={setEditingId}
        onDelete={setDeletingId}
        onDownload={downloadBinder}
        onNew={() => setNewOpen(true)}
        announce={announce}
      />

      {/* Messages about loading or making binders */}
      <p className={`${styles.shelfMessage} ${message.error ? styles.error : ''}`} role="status">{message.text}</p>

      {/* The windows (each drawn only while it's open) */}
      {newOpen && (
        <NewBinderDialog
          onCreate={(name, color, cover) => {
            setNewOpen(false);
            shelfRef.current?.returnFocus();
            addBinder({ name, color, cover, pages: DEFAULT_PAGES });
          }}
          onUpload={(binder) => {
            setNewOpen(false);
            shelfRef.current?.returnFocus();
            addUploadedBinder(binder);
          }}
          onCancel={() => { setNewOpen(false); shelfRef.current?.returnFocus(); }}
        />
      )}
      {editing && (
        <BinderPropertiesDialog
          binder={editing}
          cardCount={counts[editing.id] ?? 0}
          onSave={(changes) => {
            setEditingId(null);
            shelfRef.current?.returnFocus();
            saveChanges(editing.id, changes);
          }}
          onCancel={() => { setEditingId(null); shelfRef.current?.returnFocus(); }}
        />
      )}
      {deleting && (
        <DeleteBinderDialog
          binder={deleting}
          cardCount={counts[deleting.id] ?? 0}
          localMode={localMode}
          onDelete={() => {
            setDeletingId(null);
            shelfRef.current?.returnFocus();
            deleteBinder(deleting.id);
          }}
          onCancel={() => { setDeletingId(null); shelfRef.current?.returnFocus(); }}
        />
      )}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        intro={<>Press <kbd>Tab</kbd> to get onto your shelf of binders, then:</>}
        shortcuts={shelfShortcuts}
      />
      {announcer}
    </section>
  );
}
