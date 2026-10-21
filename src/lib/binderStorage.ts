/* =====================================================================
   BINDER STORAGE
   Each binder's real home is a file in the person's Google Drive (see
   googleDrive.ts). This file keeps a WORKING COPY of each binder in the
   browser, so pages open instantly and keep working even when the
   Google connection has run out. A "needs saving" marker remembers
   which binders have changes that haven't reached Drive yet.
   The cards themselves are kept in the browser's big database
   (IndexedDB: see cardStore.ts); the small things (the list of
   binders, the markers) are kept in localStorage.
   LOCAL USE ONLY: someone can skip signing in ("Skip login, local use
   only" on the welcome page). Then this browser's copy is the ONLY copy,
   until they sign in (which uploads them: see uploadLocalBinders).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import { accountChanged } from './accountEvents';
import { clearCards, countCards, deleteCards, hasCards, readCards, writeCards } from './cardStore';
import { pocketsPerPage } from './pageLayout';

/* ---------------------------------------------------------------------
   SIZES AND LIMITS
   --------------------------------------------------------------------- */

// How many pockets on each page: the page layout's across x down (4 x 4
// = 16 to start), chosen in Settings (see pageLayout.ts). It's a function
// because the layout can change while the site is open.
export { pocketsPerPage } from './pageLayout';

// The pockets per page of the older .json binder files (and the original
// site): always 4 across by 4 down
const OLD_POCKETS_PER_PAGE = 16;

// How many pages a new binder has. There's no most: a binder can have as
// many pages as it needs (an uploaded .csv file adds pages to fit all its
// cards), but never fewer than its cards need.
export const DEFAULT_PAGES = 10;

// The longest a binder's name can be, so it fits on the cover's label
export const NAME_LIMIT = 12;

// The most copies of one card a pocket can say you own (two digits)
export const MAX_COPIES = 99;

// The name written into the older .json binder files (before binders
// were saved as .csv files), so an uploaded one can be recognized
export const FILE_APP_NAME = 'mtg-card-binder';

// The names things are saved under in localStorage (each binder's cards
// are in IndexedDB, found by the binder's id: its Google Drive file id):
//  - binderDirty:<id>  set when that binder has changes not yet in Drive
//  - binderList        the list of binders: [{ id, name, color, cover, pages }, ...]
//  - localOnly         "yes" while using the site without signing in
const DIRTY_KEY_PREFIX = 'binderDirty:';
const BINDER_LIST_KEY = 'binderList';
const LOCAL_MODE_KEY = 'localOnly';

// Before there were several binders, the one binder was saved under this
// name. The Binders page moves those cards into the first binder.
export const OLD_SINGLE_BINDER_KEY = 'binderCards';

/* ---------------------------------------------------------------------
   WHAT A BINDER AND A CARD LOOK LIKE
   --------------------------------------------------------------------- */

// One binder in the list: its id, name, cover symbol ("color": a code
// from MANA_COLORS, or null for none), cover color ("cover") and pages
export type Binder = {
  id: string;
  name: string;
  color: string | null;
  cover: string;
  pages: number;
};

// One card in a pocket: the exact printing ("set" + collector "number"),
// which side ("face": 0 front, 1 back), the picture to show, and maybe a
// language other than the printing's own, how many copies (when more
// than 1), whether it's a foil copy, when it was added (a date and time
// like "2026-10-19T21:46:35.638Z"), and "extra": the binder file's other
// columns, like the set's name, rarity or condition (see binderCsv.ts)
export type BinderCard = {
  name: string;
  set: string;
  number: string;
  face: number;
  image: string;
  lang?: string;
  count?: number;
  foil?: boolean;
  added?: string;
  extra?: Record<string, string>;
};

// A binder's cards, by pocket: { "3-5": card, ... } (page 3, pocket 5)
export type BinderCards = Record<string, BinderCard>;

/* ---------------------------------------------------------------------
   COVER SYMBOLS AND COVER COLORS
   --------------------------------------------------------------------- */

// Magic's color symbols, for a binder's cover. Each has:
//  - code:   the letters Magic uses (U is blue, because B is black); two
//            letters for a two-color symbol, e.g. "WU" = white and blue
//  - name:   the full name, read out by screen readers and shown on hover
//  - short:  the word shown under the symbol in the symbol choices
//  - group:  'single' (one color, colorless or planeswalker) or 'two'
//  - symbol: its picture from Scryfall (or our own, for planeswalker)
// The two-color ones' short names are the Magic guild names for those
// pairs (Azorius is white-blue, and so on), since "White-Blue" won't fit.
export type ManaColor = { code: string; name: string; short: string; group: 'single' | 'two'; symbol: string };
const SYMBOL_URL = 'https://svgs.scryfall.io/card-symbols/';
export const MANA_COLORS: ManaColor[] = ([
  { code: 'W',  name: 'White',     short: 'White',     group: 'single' },
  { code: 'U',  name: 'Blue',      short: 'Blue',      group: 'single' },
  { code: 'B',  name: 'Black',     short: 'Black',     group: 'single' },
  { code: 'R',  name: 'Red',       short: 'Red',       group: 'single' },
  { code: 'G',  name: 'Green',     short: 'Green',     group: 'single' },
  { code: 'C',  name: 'Colorless', short: 'Colorless', group: 'single' },
  // The planeswalker symbol uses our own copy (in public/icons): Scryfall's
  // is a black shape with no circle, which would vanish on a black cover.
  { code: 'PW', name: 'Planeswalker', short: 'Planeswalker', group: 'single',
    symbol: `${import.meta.env.BASE_URL}icons/planeswalker.svg` },
  // Neighboring colors on Magic's color wheel ("allied" pairs)...
  { code: 'WU', name: 'White and Blue',  short: 'Azorius',  group: 'two' },
  { code: 'UB', name: 'Blue and Black',  short: 'Dimir',    group: 'two' },
  { code: 'BR', name: 'Black and Red',   short: 'Rakdos',   group: 'two' },
  { code: 'RG', name: 'Red and Green',   short: 'Gruul',    group: 'two' },
  { code: 'GW', name: 'Green and White', short: 'Selesnya', group: 'two' },
  // ...and colors across the wheel from each other ("enemy" pairs)
  { code: 'WB', name: 'White and Black', short: 'Orzhov',   group: 'two' },
  { code: 'UR', name: 'Blue and Red',    short: 'Izzet',    group: 'two' },
  { code: 'BG', name: 'Black and Green', short: 'Golgari',  group: 'two' },
  { code: 'RW', name: 'Red and White',   short: 'Boros',    group: 'two' },
  { code: 'GU', name: 'Green and Blue',  short: 'Simic',    group: 'two' },
// Each symbol's picture is Scryfall's, unless the entry names its own.
// ("as" tells TypeScript each entry is a ManaColor that may lack its picture.)
] as (Omit<ManaColor, 'symbol'> & { symbol?: string })[]).map((color) =>
  ({ ...color, symbol: color.symbol ?? `${SYMBOL_URL}${color.code}.svg` }));

// Find a symbol by its code ("U" → the Blue entry), or null if there's
// no such code (including no symbol at all).
export function manaColor(code: string | null | undefined): ManaColor | null {
  return MANA_COLORS.find((c) => c.code === code) ?? null;
}

// The colors a binder's cover can be. The shades are in
// styles/covers.css (the "cover-<code>" classes). "light" marks the pale
// covers, whose name label needs dark text. Black is the default.
// Besides these, a cover can be ANY color picked with the device's own
// color chooser ("Custom"), saved as a code like "#3a7bd5".
export const COVER_COLORS: { code: string; name: string; light?: boolean }[] = [
  { code: 'white',  name: 'White', light: true },
  { code: 'blue',   name: 'Blue' },
  { code: 'black',  name: 'Black' },
  { code: 'red',    name: 'Red' },
  { code: 'green',  name: 'Green' },
  { code: 'gold',   name: 'Gold', light: true },
  { code: 'gray',   name: 'Light gray', light: true },
  { code: 'purple', name: 'Purple' },
  { code: 'orange', name: 'Orange' },
];
export const DEFAULT_COVER = 'black';

// Is this a custom cover color code, like "#3a7bd5"?
export function isCustomCover(code: unknown): code is string {
  return typeof code === 'string' && /^#[0-9a-f]{6}$/i.test(code);
}

// A cover color's code if it's one of the list above (or a custom color,
// made lowercase), otherwise black.
export function cleanCover(code: unknown): string {
  if (isCustomCover(code)) return code.toLowerCase();
  return COVER_COLORS.some((c) => c.code === code) ? (code as string) : DEFAULT_COVER;
}

/* ---------------------------------------------------------------------
   POCKETS AND PAGES
   --------------------------------------------------------------------- */

// Each pocket has a short name like "3-5" (page 3, pocket 5)
export function pocketKey(page: number, slot: number): string {
  return `${page}-${slot}`;
}

// Turn any page count (a number, or text from a Drive label) into a safe
// whole number, 1 or more. Anything unreadable becomes DEFAULT_PAGES.
export function cleanPageCount(pages: unknown): number {
  const number = Math.round(Number(pages));
  if (!Number.isFinite(number) || number < 1) return DEFAULT_PAGES;
  return number;
}

// The fewest pages that can hold this many cards (at least 1)
export function minPagesFor(cardCount: number): number {
  return Math.max(1, Math.ceil(cardCount / pocketsPerPage()));
}

// Move cards from one number of pockets per page to another, keeping
// each card's place in the binder's order: pocket 1, 2, 3… counting page
// by page. E.g. going from 16 to 9 per page, page 1 pocket 12 (the 12th
// pocket) becomes page 2 pocket 3 (9 + 3 = 12th). Going back reverses
// it exactly. Pockets that don't exist in "fromPerPage" are left out.
export function relayoutCards(cards: BinderCards, fromPerPage: number, toPerPage: number): BinderCards {
  if (fromPerPage === toPerPage) return cards;
  const moved: BinderCards = {};
  for (const [key, card] of Object.entries(cards)) {
    const [page, slot] = key.split('-').map(Number);
    if (!(page >= 1 && slot >= 1 && slot <= fromPerPage)) continue;
    const place = (page - 1) * fromPerPage + (slot - 1);   // 0 = the very first pocket
    moved[pocketKey(Math.floor(place / toPerPage) + 1, (place % toPerPage) + 1)] = card;
  }
  return moved;
}

// The page layout changed: move every binder's cards in this browser to
// match. (Their files in Google Drive say which layout they were saved
// with, so they're read correctly whichever layout is in use, and don't
// need saving again for this.)
export function relayoutAllBinders(fromPerPage: number, toPerPage: number): void {
  for (const binder of loadBinderList()) {
    if (!hasBinderCopy(binder.id)) continue;
    saveBinder(relayoutCards(loadBinder(binder.id), fromPerPage, toPerPage), binder.id, { dirty: false });
  }
}

// Find the first empty pocket, page by page, pocket by pocket, in a
// binder with this many pages. Returns { page, slot }, or null if full.
export function firstEmptyPocket(cards: BinderCards, pages: number): { page: number; slot: number } | null {
  const perPage = pocketsPerPage();
  for (let page = 1; page <= pages; page++) {
    for (let slot = 1; slot <= perPage; slot++) {
      if (!cards[pocketKey(page, slot)]) return { page, slot };
    }
  }
  return null;
}

// Fit a binder's cards into a new (smaller) number of pages: any card on
// a page that's going away moves into the first empty pocket on the pages
// that stay. Cards already on those pages don't move. (Only call this
// with at least minPagesFor(...) pages, so there's always room.)
export function fitCardsIntoPages(cards: BinderCards, pages: number): BinderCards {
  const kept: BinderCards = {};
  const homeless: [string, BinderCard][] = [];
  for (const [key, card] of Object.entries(cards)) {
    const page = Number(key.split('-')[0]);
    if (page <= pages) kept[key] = card;
    else homeless.push([key, card]);
  }
  // Move the homeless cards in their old order (page by page, pocket by pocket).
  homeless.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  for (const [, card] of homeless) {
    const spot = firstEmptyPocket(kept, pages);
    if (spot) kept[pocketKey(spot.page, spot.slot)] = card;
  }
  return kept;
}

/* ---------------------------------------------------------------------
   ONE BINDER'S CARDS
   --------------------------------------------------------------------- */

// Read one binder's saved cards (empty if nothing is saved yet).
export function loadBinder(id: string): BinderCards {
  return readCards(id) ?? {};
}

// Does this browser have a copy of this binder's cards yet? (A binder
// made on another computer may not have been brought over yet.)
export function hasBinderCopy(id: string): boolean {
  return hasCards(id);
}

// How many cards a binder has
export function binderCardCount(id: string): number {
  return countCards(id);
}

// Save one binder's cards. Normally this also marks the binder as "needs
// saving to Google Drive" (pass { dirty: false } when the cards just CAME
// from Drive). Returns false if saving on this device isn't working
// (storage blocked or full), so pages can say so.
export function saveBinder(cards: BinderCards, id: string, { dirty = true } = {}): boolean {
  if (!writeCards(id, cards)) return false;
  // The marker holds the time of the change, so a save to Drive that
  // started earlier can tell whether newer changes have happened since.
  if (dirty) storageSet(DIRTY_KEY_PREFIX + id, String(Date.now()));
  return true;
}

// The "needs saving" marker for a binder: a time, or null if it's saved.
export function binderDirtyStamp(id: string): string | null {
  return storageGet(DIRTY_KEY_PREFIX + id);
}

// Clear the "needs saving" marker, but only if no newer change has been
// made since the save to Drive began (that's what "stamp" checks).
export function markBinderSaved(id: string, stamp: string): void {
  if (binderDirtyStamp(id) === stamp) storageRemove(DIRTY_KEY_PREFIX + id);
}

/* ---------------------------------------------------------------------
   THE LIST OF BINDERS
   --------------------------------------------------------------------- */

// The list of binders, as last seen
export function loadBinderList(): Binder[] {
  try { return JSON.parse(storageGet(BINDER_LIST_KEY) ?? 'null') ?? []; } catch { return []; }
}
export function saveBinderList(list: Binder[]): void {
  storageSet(BINDER_LIST_KEY, JSON.stringify(list));
  accountChanged();
}

// One binder from the list (or undefined if it isn't listed)
export function findBinder(id: string): Binder | undefined {
  return loadBinderList().find((b) => b.id === id);
}

// A binder's name (or "Binder" if it isn't listed)
export function binderName(id: string): string {
  return findBinder(id)?.name ?? 'Binder';
}

// A binder's number of pages (DEFAULT_PAGES if it doesn't say)
export function binderPages(id: string): number {
  const found = findBinder(id);
  return found ? cleanPageCount(found.pages) : DEFAULT_PAGES;
}

// The next free default name for a new binder: the lowest "Binder N"
// not already used.
export function nextBinderName(): string {
  const used = new Set(loadBinderList().map((b) => b.name));
  let number = 1;
  while (used.has(`Binder ${number}`)) number++;
  return `Binder ${number}`;
}

// The name for a binder that might clash with one already on the shelf
// (an uploaded file): its own name if no binder has it yet. Otherwise
// "Name (1)", or "(2)" if that's taken too, and so on. (A name that
// already ends in "(3)" counts up from its plain name.) Names keep to the
// 12-character limit, shortening the plain name to make room for the number.
export function freeBinderName(name: string): string {
  const taken = new Set(loadBinderList().map((b) => b.name.toLowerCase()));
  name = name.slice(0, NAME_LIMIT);
  if (!taken.has(name.toLowerCase())) return name;
  const plain = name.replace(/\s*\(\d+\)$/, '');
  for (let number = 1; ; number++) {
    const ending = ` (${number})`;
    const candidate = plain.slice(0, NAME_LIMIT - ending.length).trimEnd() + ending;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// One binder's own details (name, cover symbol, cover color and pages),
// tidied up: an unknown symbol is none, an unknown cover color is black.
// Its cards and these go into its .csv file (see binderCsv.ts).
export function binderDetails(id: string): Omit<Binder, 'id'> {
  const found = findBinder(id);
  return {
    name: binderName(id),
    color: found && manaColor(found.color) ? found.color : null,
    cover: cleanCover(found?.cover),
    pages: binderPages(id),
  };
}

// Forget one binder kept in this browser (after it's deleted or uploaded).
export function forgetBinder(id: string): void {
  deleteCards(id);
  storageRemove(DIRTY_KEY_PREFIX + id);
  saveBinderList(loadBinderList().filter((b) => b.id !== id));
}

// Forget every binder saved in this browser (used when signing out, so
// the next person on this computer doesn't see them).
export function clearAllBinders(): void {
  const ids = loadBinderList().map((binder) => binder.id);
  clearCards(ids);
  for (const id of ids) storageRemove(DIRTY_KEY_PREFIX + id);
  storageRemove(BINDER_LIST_KEY);
  // Earlier versions of the site also remembered the binder opened last.
  storageRemove('lastBinderId');
  accountChanged();
}

/* ---------------------------------------------------------------------
   LOCAL USE ONLY (no Google sign-in)
   --------------------------------------------------------------------- */

// Is the site being used without signing in?
export function isLocalMode(): boolean {
  return storageGet(LOCAL_MODE_KEY) === 'yes';
}

// Turn "local use only" on (after "Skip login") or off (after signing in).
export function setLocalMode(on: boolean): void {
  if (on) storageSet(LOCAL_MODE_KEY, 'yes');
  else storageRemove(LOCAL_MODE_KEY);
  accountChanged();
}

// A new id for a binder kept on this device only. It starts with "local-"
// and adds the time and a few random letters, so no two are the same.
export function newLocalBinderId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------------------------------------------------------------------
   CHECKING CARDS AND BINDER FILES FROM OUTSIDE
   --------------------------------------------------------------------- */

// Check one card that came from outside (an uploaded file, or a Drive
// file that might have been edited). Only cards with everything a pocket
// needs are accepted, with the picture from a secure "https://" address.
function isValidCard(card: unknown): card is BinderCard {
  const c = card as BinderCard;
  return c !== null && typeof c === 'object' &&
    typeof c.name === 'string' &&
    typeof c.set === 'string' &&
    typeof c.number === 'string' &&
    typeof c.image === 'string' && c.image.startsWith('https://') &&
    (c.face === 0 || c.face === 1) &&
    (c.lang === undefined || typeof c.lang === 'string') &&
    (c.count === undefined || (Number.isInteger(c.count) && c.count >= 1)) &&
    (c.foil === undefined || typeof c.foil === 'boolean') &&
    (c.added === undefined || typeof c.added === 'string') &&
    (c.extra === undefined || (typeof c.extra === 'object' && c.extra !== null &&
      Object.values(c.extra).every((value) => typeof value === 'string')));
}

// The cards from an older .json binder (an uploaded file, an old Google
// Drive file, or the original site's single binder). Those were always
// 4 across by 4 down, so only pockets 1 to 16 exist in them; the valid
// cards are kept, and moved to the page layout in use now (see
// relayoutCards). "skipped" counts what was thrown away.
export function cleanCards(incoming: unknown): { cards: BinderCards; skipped: number } {
  const cards: BinderCards = {};
  let skipped = 0;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return { cards, skipped };
  for (const [key, card] of Object.entries(incoming)) {
    const match = /^(\d+)-(\d+)$/.exec(key);
    const page = match ? Number(match[1]) : 0;
    const slot = match ? Number(match[2]) : 0;
    const pocketExists = page >= 1 && slot >= 1 && slot <= OLD_POCKETS_PER_PAGE;
    if (pocketExists && isValidCard(card)) cards[pocketKey(page, slot)] = card;
    else skipped++;
  }
  return { cards: relayoutCards(cards, OLD_POCKETS_PER_PAGE, pocketsPerPage()), skipped };
}

// Check an older .json binder file's data (uploaded with "Upload file")
// and pull out what the new binder needs. Throws an error with a message to show if it isn't a
// binder file.
export function binderFromFile(data: unknown): Omit<Binder, 'id'> & { cards: BinderCards; skipped: number } {
  const file = data as { app?: unknown; cards?: unknown; pages?: unknown; name?: unknown; color?: unknown; cover?: unknown };
  if (!file || typeof file !== 'object' || Array.isArray(file) ||
      !file.cards || typeof file.cards !== 'object' || Array.isArray(file.cards) ||
      (file.app !== undefined && file.app !== FILE_APP_NAME)) {
    throw new Error('That file isn\'t a WUBRG\'r binder file.');
  }
  const { cards, skipped } = cleanCards(file.cards);
  const count = Object.keys(cards).length;
  // Enough pages for the file's page count, for its cards, and for the
  // highest page a card is on.
  const highestPage = Math.max(0, ...Object.keys(cards).map((key) => Number(key.split('-')[0])));
  const pages = Math.max(cleanPageCount(file.pages), minPagesFor(count), highestPage);
  const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : nextBinderName();
  return {
    name: freeBinderName(name),
    color: typeof file.color === 'string' && manaColor(file.color) ? file.color : null,   // unknown: none
    cover: cleanCover(file.cover),                                                       // unknown: black
    pages,
    cards,
    skipped,
  };
}

/* ---------------------------------------------------------------------
   COPIES OF A CARD
   --------------------------------------------------------------------- */

// How many copies of a card you own. Cards saved before the counter
// existed have no "count", which means 1.
export function cardCount(card: BinderCard | undefined): number {
  return card && Number.isInteger(card.count) && card.count! >= 1
    ? Math.min(card.count!, MAX_COPIES)
    : 1;
}

// A copy of a card with a new number of copies. A count of 1 is left out
// of the card (it's the normal amount), which keeps saved files tidy.
export function withCount(card: BinderCard, count: number): BinderCard {
  const copy = { ...card };
  if (count > 1) copy.count = Math.min(count, MAX_COPIES);
  else delete copy.count;
  return copy;
}

// Are two cards the same printing: same set, collector number, side,
// language and foil-or-not? Used when moving copies into a binder that
// already has that card (a foil copy isn't added to a non-foil one).
export function samePrinting(a: BinderCard, b: BinderCard): boolean {
  return a.set === b.set && a.number === b.number && a.face === b.face &&
    (a.lang || 'en') === (b.lang || 'en') && Boolean(a.foil) === Boolean(b.foil);
}

// "1 card", "5 cards", "2,400 cards" (big numbers get commas, written
// the way this device's language does)
export function cardCountText(count: number): string {
  return `${count.toLocaleString()} card${count === 1 ? '' : 's'}`;
}
