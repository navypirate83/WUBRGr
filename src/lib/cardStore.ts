/* =====================================================================
   WHERE EACH BINDER'S CARDS ARE KEPT IN THIS BROWSER
   The browser's working copy of every binder's cards (see
   binderStorage.ts for what it's for) is kept in IndexedDB: the
   browser's big built-in database. It can hold hundreds of megabytes,
   where localStorage (the small store used for everything else) only
   holds about 5 million characters for the whole site, roughly 15,000
   cards in pockets across all binders.
   IndexedDB answers in the background, a moment later, but the rest of
   the app wants answers straight away. So:
     - when the app starts, openCardStore() reads every binder's cards
       into memory (main.tsx waits for it before drawing the page)
     - reading cards then comes straight from memory
     - saving cards updates memory straight away, and writes to IndexedDB
       in the background
   Other open tabs of the site are told about each change (through a
   "BroadcastChannel", a way for tabs of the same site to talk), so they
   don't later save an older copy over a newer one.
   MOVING OLD COPIES: earlier versions kept each binder's cards in
   localStorage, as "binderCards:<id>". The first time this runs, those
   are copied into IndexedDB, and only then removed from localStorage.
   If the browser won't allow IndexedDB (some private windows), this
   quietly keeps using localStorage, the same as before.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import type { BinderCards } from './binderStorage';

// The old localStorage names: "binderCards:" plus the binder's id
export const CARDS_KEY_PREFIX = 'binderCards:';

// The database's name, its version (raised only if its layout changes),
// and the "object store" (like a table) inside it: one entry per binder,
// found by the binder's id, holding its cards
const DB_NAME = 'wubrgr';
const DB_VERSION = 1;
const STORE = 'binderCards';

// Every binder's cards, by binder id: the copy in memory
const cardsInMemory = new Map<string, BinderCards>();

// The open database, or null when using localStorage instead
let db: IDBDatabase | null = null;

// Did the last write to IndexedDB fail (e.g. the device is out of
// space)? Then the next save says so, so the page can warn.
let lastWriteFailed = false;

// The channel the site's open tabs use to tell each other about changes
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('wubrgr-binder-cards') : null;

// A message between tabs: one binder's new cards, one binder forgotten,
// or every binder forgotten (signing out)
type TabMessage = { type: 'set'; id: string; cards: BinderCards } | { type: 'delete'; id: string } | { type: 'clear' };

// Another tab changed something: change the copy in memory to match.
// (It has already saved it to IndexedDB itself.)
channel?.addEventListener('message', (event: MessageEvent<TabMessage>) => {
  const message = event.data;
  if (message.type === 'set') cardsInMemory.set(message.id, message.cards);
  else if (message.type === 'delete') cardsInMemory.delete(message.id);
  else if (message.type === 'clear') cardsInMemory.clear();
});

/* ---------------------------------------------------------------------
   OPENING THE DATABASE (once, when the app starts)
   --------------------------------------------------------------------- */

// IndexedDB's requests report back with events. This turns one into a
// promise ("await" waits for its answer, or throws its error).
function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// The same for a whole transaction (a group of changes): resolves once
// every change in it is safely written.
function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// Open the database (making its store the first time), read every
// binder's cards into memory, and move any old localStorage copies in.
// If any of that fails, carry on with localStorage instead.
export async function openCardStore(): Promise<void> {
  try {
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    // First time (or a newer version): make the store
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE);
    };
    const database = await done(opening);

    // Read every binder's cards (all the ids, then all the values, in
    // the same order)
    const reading = database.transaction(STORE, 'readonly').objectStore(STORE);
    const [ids, values] = await Promise.all([done(reading.getAllKeys()), done(reading.getAll())]);
    ids.forEach((id, index) => cardsInMemory.set(String(id), values[index] as BinderCards));

    // Move the old localStorage copies in. One found there is newer than
    // any copy already in IndexedDB (only an older version of the site
    // writes there now), so it wins.
    const oldKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CARDS_KEY_PREFIX)) oldKeys.push(key);
      }
    } catch { /* localStorage blocked: nothing to move */ }
    if (oldKeys.length) {
      const moving = database.transaction(STORE, 'readwrite');
      for (const key of oldKeys) {
        let cards: BinderCards;
        try { cards = JSON.parse(storageGet(key) ?? 'null') ?? {}; } catch { continue; }
        const id = key.slice(CARDS_KEY_PREFIX.length);
        moving.objectStore(STORE).put(cards, id);
        cardsInMemory.set(id, cards);
      }
      // Only once they're safely in IndexedDB, free up localStorage
      await finished(moving);
      for (const key of oldKeys) storageRemove(key);
    }

    db = database;
    // Ask the browser to keep this site's data even when the device is
    // short of space (browsers may say no; the data is still kept as usual)
    navigator.storage?.persist?.().catch(() => { /* fine */ });
  } catch {
    // No IndexedDB: everything stays in localStorage, as before
    db = null;
    cardsInMemory.clear();
  }
}

/* ---------------------------------------------------------------------
   READING AND SAVING (used by binderStorage.ts)
   --------------------------------------------------------------------- */

// One binder's cards, or null if this browser has no copy of it. It's a
// copy ("structuredClone"), so changing it can't change the saved cards
// by accident; only writeCards does that.
export function readCards(id: string): BinderCards | null {
  if (!db) {
    try { return JSON.parse(storageGet(CARDS_KEY_PREFIX + id) ?? 'null'); } catch { return null; }
  }
  const cards = cardsInMemory.get(id);
  return cards ? structuredClone(cards) : null;
}

// How many cards a binder has (without copying them)
export function countCards(id: string): number {
  if (!db) return Object.keys(readCards(id) ?? {}).length;
  return Object.keys(cardsInMemory.get(id) ?? {}).length;
}

// Does this browser have a copy of this binder's cards (even an empty one)?
export function hasCards(id: string): boolean {
  return db ? cardsInMemory.has(id) : storageGet(CARDS_KEY_PREFIX + id) !== null;
}

// Save one binder's cards: in memory straight away, then in IndexedDB,
// and tell the other tabs. Returns false if saving isn't working (storage
// blocked, or the last write to IndexedDB failed), so the page can say so.
export function writeCards(id: string, cards: BinderCards): boolean {
  if (!db) return storageSet(CARDS_KEY_PREFIX + id, JSON.stringify(cards));
  const copy = structuredClone(cards);
  cardsInMemory.set(id, copy);
  try {
    const writing = db.transaction(STORE, 'readwrite');
    writing.objectStore(STORE).put(copy, id);
    finished(writing).then(() => { lastWriteFailed = false; }, () => { lastWriteFailed = true; });
  } catch {
    lastWriteFailed = true;
  }
  channel?.postMessage({ type: 'set', id, cards: copy } satisfies TabMessage);
  return !lastWriteFailed;
}

// Forget one binder's cards (after it's deleted, or uploaded to Drive).
export function deleteCards(id: string): void {
  storageRemove(CARDS_KEY_PREFIX + id);   // an old copy, if one is left
  if (!db) return;
  cardsInMemory.delete(id);
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch { /* nothing to delete */ }
  channel?.postMessage({ type: 'delete', id } satisfies TabMessage);
}

// Forget every binder's cards (signing out, so the next person on this
// computer doesn't see them).
export function clearCards(ids: string[]): void {
  for (const id of ids) storageRemove(CARDS_KEY_PREFIX + id);
  if (!db) return;
  cardsInMemory.clear();
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).clear(); } catch { /* nothing to clear */ }
  channel?.postMessage({ type: 'clear' } satisfies TabMessage);
}
