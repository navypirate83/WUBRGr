/* =====================================================================
   BINDER STORAGE
   Each binder's real home is a file in the person's Google Drive (see
   googleDrive.ts). This file keeps a WORKING COPY of each binder in the
   browser's localStorage, so pages open instantly and keep working even
   when the Google connection has run out. A "needs saving" marker
   remembers which binders have changes that haven't reached Drive yet.
   LOCAL USE ONLY: someone can skip signing in ("Skip login, local use
   only" on the welcome page). Then this browser's copy is the ONLY copy,
   until they sign in (which uploads them: see uploadLocalBinders).
   Everything is saved under the same names as the original site, so
   binders made there show up here, and the other way round.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import { accountChanged } from './accountEvents';

/* ---------------------------------------------------------------------
   SIZES AND LIMITS
   --------------------------------------------------------------------- */

// How many pockets on each page (4 x 4)
export const POCKETS_PER_PAGE = 16;

// How many pages a binder has: DEFAULT_PAGES for a new one, MAX_PAGES at
// most (150 pages = 2,400 cards; much bigger binders would be slow to
// open). A binder can't have fewer pages than its cards need.
export const DEFAULT_PAGES = 10;
export const MAX_PAGES = 150;

// The longest a binder's name can be, so it fits on the cover's label
export const NAME_LIMIT = 12;

// The most copies of one card a pocket can say you own (two digits)
export const MAX_COPIES = 99;

// The name written into binder files, so we can recognize our own files
export const FILE_APP_NAME = 'mtg-card-binder';

// The names things are saved under in localStorage:
//  - binderCards:<id>  one binder's cards (<id> is its Google Drive file id)
//  - binderDirty:<id>  set when that binder has changes not yet in Drive
//  - binderList        the list of binders: [{ id, name, color, cover, pages }, ...]
//  - localOnly         "yes" while using the site without signing in
export const CARDS_KEY_PREFIX = 'binderCards:';
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
// than 1), and whether it's a foil copy
export type BinderCard = {
  name: string;
  set: string;
  number: string;
  face: number;
  image: string;
  lang?: string;
  count?: number;
  foil?: boolean;
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
// whole number from 1 to MAX_PAGES. Anything unreadable becomes DEFAULT_PAGES.
export function cleanPageCount(pages: unknown): number {
  const number = Math.round(Number(pages));
  if (!Number.isFinite(number) || number < 1) return DEFAULT_PAGES;
  return Math.min(number, MAX_PAGES);
}

// The fewest pages that can hold this many cards (16 per page, at least 1)
export function minPagesFor(cardCount: number): number {
  return Math.max(1, Math.ceil(cardCount / POCKETS_PER_PAGE));
}

// Find the first empty pocket, page by page, pocket by pocket, in a
// binder with this many pages. Returns { page, slot }, or null if full.
export function firstEmptyPocket(cards: BinderCards, pages: number): { page: number; slot: number } | null {
  for (let page = 1; page <= pages; page++) {
    for (let slot = 1; slot <= POCKETS_PER_PAGE; slot++) {
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
  try {
    return JSON.parse(storageGet(CARDS_KEY_PREFIX + id) ?? 'null') ?? {};
  } catch {
    return {};
  }
}

// How many cards a binder has
export function binderCardCount(id: string): number {
  return Object.keys(loadBinder(id)).length;
}

// Save one binder's cards. Normally this also marks the binder as "needs
// saving to Google Drive" (pass { dirty: false } when the cards just CAME
// from Drive). Returns false if storage is blocked, so pages can say so.
export function saveBinder(cards: BinderCards, id: string, { dirty = true } = {}): boolean {
  if (!storageSet(CARDS_KEY_PREFIX + id, JSON.stringify(cards))) return false;
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

// The whole binder as it's written to a Google Drive file (or a .JSON
// download): a label saying what it is, its name, cover symbol, cover
// color, number of pages, when it was saved, and its cards.
export function binderFileData(id: string) {
  const found = findBinder(id);
  return {
    app: FILE_APP_NAME,
    version: 1,
    name: binderName(id),
    color: found && manaColor(found.color) ? found.color : null,
    cover: cleanCover(found?.cover),
    pages: binderPages(id),
    savedAt: new Date().toISOString(),
    cards: loadBinder(id),
  };
}

// Forget one binder kept in this browser (after it's deleted or uploaded).
export function forgetBinder(id: string): void {
  storageRemove(CARDS_KEY_PREFIX + id);
  storageRemove(DIRTY_KEY_PREFIX + id);
  saveBinderList(loadBinderList().filter((b) => b.id !== id));
}

// Forget every binder saved in this browser (used when signing out, so
// the next person on this computer doesn't see them).
export function clearAllBinders(): void {
  for (const binder of loadBinderList()) {
    storageRemove(CARDS_KEY_PREFIX + binder.id);
    storageRemove(DIRTY_KEY_PREFIX + binder.id);
  }
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
    (c.foil === undefined || typeof c.foil === 'boolean');
}

// Keep only the valid cards in pockets that can exist (like "3-5", on any
// page up to the 150-page limit). "skipped" counts what was thrown away.
export function cleanCards(incoming: unknown): { cards: BinderCards; skipped: number } {
  const cards: BinderCards = {};
  let skipped = 0;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return { cards, skipped };
  for (const [key, card] of Object.entries(incoming)) {
    const match = /^(\d+)-(\d+)$/.exec(key);
    const page = match ? Number(match[1]) : 0;
    const slot = match ? Number(match[2]) : 0;
    const pocketExists = page >= 1 && page <= MAX_PAGES && slot >= 1 && slot <= POCKETS_PER_PAGE;
    if (pocketExists && isValidCard(card)) cards[pocketKey(page, slot)] = card;
    else skipped++;
  }
  return { cards, skipped };
}

// Check a binder file's data (from "Upload .JSON") and pull out what the
// new binder needs. Throws an error with a message to show if it isn't a
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
  // highest page a card is on (never more than MAX_PAGES).
  const highestPage = Math.max(0, ...Object.keys(cards).map((key) => Number(key.split('-')[0])));
  const pages = Math.min(MAX_PAGES, Math.max(cleanPageCount(file.pages), minPagesFor(count), highestPage));
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

// "1 card", "5 cards"
export function cardCountText(count: number): string {
  return `${count} card${count === 1 ? '' : 's'}`;
}
