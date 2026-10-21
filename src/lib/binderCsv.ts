/* =====================================================================
   BINDER FILES AS .CSV (spreadsheet) FILES
   Each binder is saved as a .csv file: a plain-text table, one card
   (one pocket) per line, with commas between the columns. Spreadsheet
   programs like Excel and Google Sheets open it, and card collection
   apps can read it.
   The columns are a ManaBox collection export's, in the same order, so
   ManaBox (and other apps that read its files) can import a binder.
   Four of ManaBox's columns are left out: ManaBox ID, Misprint, Altered
   and Signed (an uploaded file's values for those are ignored). After
   ManaBox's last column ("Added", the date the card was added) come
   WUBRG'r's own columns:
     - Page, Pocket: where the card sits in the binder
     - Side: which side of a two-sided card faces out (front or back)
     - Binder, Cover symbol, Cover color, Pages: the binder's own name,
       cover and number of pages, repeated on every line so sorting the
       rows in a spreadsheet can't lose them
     - Page layout: the pockets across x down the Page and Pocket numbers
       were counted in (like "4x4"). A file read with a different layout
       in use has its cards moved to match, in the same order. A file
       without it counts as 4x4 (the only layout before there was a choice).
   Columns WUBRG'r doesn't use itself (like Condition or Purchase price)
   are kept with each card, so a ManaBox file can go in and come back
   out without losing anything.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { CARD_BACK } from './cards';
import { loadPrintings } from './scryfall';
import {
  DEFAULT_PAGES, MAX_COPIES, cleanCover, cleanPageCount,
  freeBinderName, manaColor, minPagesFor, nextBinderName, pocketKey,
  type Binder, type BinderCard, type BinderCards,
} from './binderStorage';
import { DEFAULT_LAYOUT, layoutFromText, layoutToText, pageLayout, pocketsPerPage } from './pageLayout';

/* ---------------------------------------------------------------------
   THE COLUMNS
   --------------------------------------------------------------------- */

// Every column, in order: ManaBox's columns first, then WUBRG'r's own
export const CSV_COLUMNS = [
  'Name', 'Set code', 'Set name', 'Collector number', 'Foil', 'Rarity', 'Quantity',
  'Scryfall ID', 'Purchase price', 'Condition', 'Language', 'Proxy',
  'Purchase price currency', 'Added',
  'Page', 'Pocket', 'Side', 'Binder', 'Cover symbol', 'Cover color', 'Pages', 'Page layout',
];

// The ManaBox columns WUBRG'r doesn't use itself. Their values are kept
// with each card (in its "extra" part), and written back out as they
// came in. A card without them gets ManaBox's usual values: not a
// proxy, and in near-mint condition.
const KEPT_COLUMNS: Record<string, string> = {
  'Set name': '',
  'Rarity': '',
  'Purchase price': '',
  'Condition': 'near_mint',
  'Proxy': 'false',
  'Purchase price currency': 'USD',
};

// Other names some apps (Moxfield, Archidekt and others) use for the same
// columns, so their files can be uploaded too. They're compared in
// lowercase with spaces and underscores taken out ("Set Code" = "setcode").
const OTHER_NAMES: Record<string, string[]> = {
  'Quantity': ['count', 'qty', 'amount'],
  'Set code': ['edition', 'set', 'editioncode', 'setcode'],
  'Collector number': ['cardnumber', 'number', 'collectornumber', 'cn'],
  'Scryfall ID': ['scryfallid'],
  'Added': ['dateadded'],
  'Set name': ['editionname'],
  'Foil': ['finish', 'printing'],
};

// Full language names (some apps write "Japanese" instead of "ja"),
// turned into the short codes Scryfall uses
const LANGUAGE_CODES: Record<string, string> = {
  english: 'en', japanese: 'ja', german: 'de', french: 'fr', italian: 'it', spanish: 'es',
  portuguese: 'pt', russian: 'ru', korean: 'ko', 'chinese simplified': 'zhs',
  'chinese traditional': 'zht', phyrexian: 'ph',
};

/* ---------------------------------------------------------------------
   WRITING A BINDER AS A .CSV FILE
   --------------------------------------------------------------------- */

// One value made safe for a .csv file: a value with a comma, a quote mark
// or a line break in it goes inside quote marks (and any quote mark
// inside is doubled), which is how .csv files tell those apart from the
// commas between columns. E.g. Urborg, Tomb of Yawgmoth → "Urborg, Tomb of Yawgmoth"
function csvValue(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// The card's Scryfall ID and side, read from its picture's address. The
// pictures are saved like cards.scryfall.io/normal/front/a/b/<ID>.jpg,
// so the ID is the long code at the end.
function scryfallIdFrom(image: string): string {
  return /\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\./i.exec(image)?.[1] ?? '';
}

// The whole binder as the text of a .csv file: the line of column names,
// then one line per pocket that holds a card, page by page, pocket by
// pocket. A binder with no cards is just the line of column names.
export function binderToCsv(binder: Omit<Binder, 'id'>, cards: BinderCards): string {
  // The pockets in order: "2-10" comes after "2-9" ("numeric" sorting)
  const keys = Object.keys(cards).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const lines = [CSV_COLUMNS.join(',')];
  const layout = layoutToText(pageLayout());   // the layout the pockets are counted in
  for (const key of keys) {
    const card = cards[key];
    const [page, pocket] = key.split('-');
    const extra = card.extra ?? {};
    const values: Record<string, string> = {
      'Name': card.name,
      'Set code': card.set.toUpperCase(),
      'Collector number': card.number,
      // ManaBox's three finishes: "normal", "foil", or "etched" (a kind
      // of foil, remembered from an uploaded file)
      'Foil': card.foil ? (extra.Foil === 'etched' ? 'etched' : 'foil') : 'normal',
      'Quantity': String(card.count ?? 1),
      'Scryfall ID': scryfallIdFrom(card.image),
      'Language': card.lang ?? 'en',
      'Added': card.added ?? '',
      'Page': page,
      'Pocket': pocket,
      'Side': card.face === 1 ? 'back' : 'front',
      'Binder': binder.name,
      'Cover symbol': binder.color ?? '',
      'Cover color': binder.cover,
      'Pages': String(binder.pages),
      'Page layout': layout,
    };
    // The columns kept from an uploaded file (or their usual values)
    for (const [column, usual] of Object.entries(KEPT_COLUMNS)) values[column] = extra[column] ?? usual;
    lines.push(CSV_COLUMNS.map((column) => csvValue(values[column] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

/* ---------------------------------------------------------------------
   READING A .CSV FILE
   --------------------------------------------------------------------- */

// Split the text of a .csv file into rows, and each row into its values.
// It goes one character at a time, so it can tell a comma or line break
// INSIDE quote marks (part of a value) from one between values.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  // Skip the invisible "byte order mark" some programs put at the start
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }   // "" is one quote mark
      else if (char === '"') quoted = false;                            // the closing quote mark
      else value += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value); value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;                   // a Windows line break
      row.push(value); value = '';
      rows.push(row); row = [];
    } else {
      value += char;
    }
  }
  // The last row, if the file doesn't end with a line break
  if (value || row.length) { row.push(value); rows.push(row); }
  // Leave out blank lines
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// A column name made easy to compare: lowercase, no spaces or underscores
const plain = (name: string) => name.toLowerCase().replace(/[\s_]/g, '');

// One card read from a line of the file, before it has a pocket: the
// card, the pocket the line asks for (if any), and whether its picture
// still needs looking up on Scryfall (the line had no Scryfall ID)
type CsvCard = { card: BinderCard; page: number; pocket: number; needsLookup: boolean };

// Read every card line of a .csv file, plus the binder's own details
// (from the first line that has them). Lines without a card name and a
// set code + collector number (or a Scryfall ID) can't be read, and are
// counted as "skipped".
function readCsv(text: string): {
  cards: CsvCard[];
  skipped: number;
  binder: { name?: string; color?: string | null; cover?: string; pages?: number };
} {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { cards: [], skipped: 0, binder: {} };

  // Which position each known column is at in this file (-1 if missing),
  // under its own name or one of its other names
  const position: Record<string, number> = {};
  const headerNames = header.map(plain);
  for (const column of [...CSV_COLUMNS, ...Object.keys(OTHER_NAMES)]) {
    const names = [plain(column), ...(OTHER_NAMES[column] ?? [])];
    position[column] = headerNames.findIndex((h) => names.includes(h));
  }
  // A file needs a name column and something that says which printing
  if (position['Name'] < 0 || (position['Set code'] < 0 && position['Scryfall ID'] < 0)) {
    throw new Error('That .csv file doesn\'t look like a list of cards (it needs a Name column, and a Set code or Scryfall ID column).');
  }

  const cards: CsvCard[] = [];
  let skipped = 0;
  const binder: { name?: string; color?: string | null; cover?: string; pages?: number } = {};
  // The pockets per page now, and in the file (its Page layout column,
  // from the first line that has one; 4x4 if it doesn't say)
  const nowPerPage = pocketsPerPage();
  const firstLayout = lines.map((line) => (position['Page layout'] >= 0 ? line[position['Page layout']] ?? '' : ''))
    .map(layoutFromText).find((layout) => layout !== null);
  const filePerPage = pocketsPerPage(firstLayout ?? DEFAULT_LAYOUT);
  for (const line of lines) {
    // This line's value in a column ('' if it's missing)
    const get = (column: string) => (position[column] >= 0 ? (line[position[column]] ?? '').trim() : '');

    // The binder's own details, from the first line that has them. Its
    // pages were counted in the file's layout: change that to the number
    // of pages that holds as many pockets with the layout now.
    if (binder.name === undefined && get('Binder')) binder.name = get('Binder');
    if (binder.color === undefined && get('Cover color')) {
      binder.color = manaColor(get('Cover symbol')) ? get('Cover symbol') : null;
      binder.cover = cleanCover(get('Cover color'));
    }
    if (binder.pages === undefined && get('Pages')) {
      binder.pages = Math.max(1, Math.ceil(cleanPageCount(get('Pages')) * filePerPage / nowPerPage));
    }

    const name = get('Name');
    const set = get('Set code').toLowerCase();
    const number = get('Collector number');
    const scryfallId = get('Scryfall ID').toLowerCase();
    const validId = /^[0-9a-f-]{36}$/.test(scryfallId);
    if (!name || (!validId && !(set && number))) { skipped++; continue; }

    // The language: a code like "ja", or a full name like "Japanese"
    let lang = get('Language').toLowerCase();
    lang = LANGUAGE_CODES[lang] ?? lang;
    // How many copies: 1 if it doesn't say, never more than 99
    const quantity = Math.min(MAX_COPIES, Math.max(1, Math.round(Number(get('Quantity'))) || 1));
    const finish = get('Foil').toLowerCase();
    const face = get('Side').toLowerCase() === 'back' ? 1 : 0;

    // The columns WUBRG'r doesn't use itself, kept with the card (only
    // the ones that have something other than their usual value in them,
    // so cards don't fill up with "false" and "near_mint")
    const extra: Record<string, string> = {};
    for (const [column, usual] of Object.entries(KEPT_COLUMNS)) {
      if (get(column) && get(column) !== usual) extra[column] = get(column);
    }
    if (finish === 'etched') extra.Foil = 'etched';

    const card: BinderCard = {
      name,
      set,
      number,
      face,
      // The picture comes straight from the Scryfall ID; without one, the
      // back of a Magic card shows until it's looked up (see binderFromCsv)
      image: validId
        ? `https://cards.scryfall.io/normal/${face ? 'back' : 'front'}/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
        : CARD_BACK,
    };
    if (lang && lang !== 'en') card.lang = lang;
    if (quantity > 1) card.count = quantity;
    if (['foil', 'etched', 'true', 'yes', '1'].includes(finish)) card.foil = true;
    if (get('Added')) card.added = get('Added');
    if (Object.keys(extra).length) card.extra = extra;

    // Its pocket, counted in the file's layout, moved to the layout now
    // (keeping its place in the order: see relayoutCards in
    // binderStorage.ts). No pocket, or one that can't exist: 0, so it
    // goes in the first empty pocket instead.
    let page = Math.round(Number(get('Page'))) || 0;
    let pocket = Math.round(Number(get('Pocket'))) || 0;
    if (page >= 1 && pocket >= 1 && pocket <= filePerPage) {
      const place = (page - 1) * filePerPage + (pocket - 1);
      page = Math.floor(place / nowPerPage) + 1;
      pocket = (place % nowPerPage) + 1;
    } else {
      page = 0;
      pocket = 0;
    }
    cards.push({ card, page, pocket, needsLookup: !validId });
  }
  return { cards, skipped, binder };
}

// Put the cards read from a file into pockets. Cards whose line names a
// pocket that exists (and is still free) go there; the rest fill the
// first empty pockets, in the order they're listed. "pages" is how many
// pages the binder should have at least; pages are added until every
// card fits, so no card is ever left out.
function placeCards(read: CsvCard[], pages: number): { cards: BinderCards; pages: number } {
  const perPage = pocketsPerPage();
  const cards: BinderCards = {};
  const leftOver: BinderCard[] = [];
  for (const { card, page, pocket } of read) {
    const key = pocketKey(page, pocket);
    if (page >= 1 && pocket >= 1 && pocket <= perPage && !cards[key]) cards[key] = card;
    else leftOver.push(card);
  }
  // Enough pages for the file's page count, every card, and the highest
  // page a card asked for
  const highestPage = Math.max(0, ...Object.keys(cards).map((key) => Number(key.split('-')[0])));
  pages = Math.max(pages, minPagesFor(read.length), highestPage);
  // The other cards go into the empty pockets in order. "page" and
  // "pocket" remember where the last one went, so the search for the
  // next empty pocket carries on from there (instead of starting again
  // at page 1 each time, which would be slow for thousands of cards).
  let page = 1;
  let pocket = 0;
  for (const card of leftOver) {
    do {
      pocket++;
      if (pocket > perPage) { page++; pocket = 1; }
    } while (cards[pocketKey(page, pocket)]);
    cards[pocketKey(page, pocket)] = card;
    pages = Math.max(pages, page);   // past the last page: that adds a page
  }
  return { cards, pages };
}

// A binder's cards from its own .csv file in Google Drive. Every card
// keeps the pocket it was saved in. (Used each time a binder is brought
// up to date from Drive, so it doesn't look anything up on Scryfall.)
export function cardsFromCsv(text: string): BinderCards {
  return placeCards(readCsv(text).cards, 1).cards;
}

// The binder in an uploaded .csv file: a WUBRG'r download, or a card list
// exported from ManaBox (or a similar app). Cards without a Scryfall ID
// are looked up on Scryfall by set code and collector number, to get
// their pictures (cards Scryfall doesn't know are skipped). The binder's
// name comes from its Binder column, or else the file's name.
// Throws an error with a message to show if it isn't a card list.
export async function binderFromCsv(text: string, fileName: string): Promise<
  Omit<Binder, 'id'> & { cards: BinderCards; skipped: number }
> {
  const read = readCsv(text);
  let skipped = read.skipped;

  // Look up the cards that have no picture yet (Scryfall takes up to 75
  // at a time). A card it finds gets its picture and its proper name.
  const missing = read.cards.filter((c) => c.needsLookup);
  if (missing.length) {
    const found = await loadPrintings(missing.map((c) => ({ set: c.card.set, number: c.card.number })));
    for (const entry of missing) {
      const print = found.get(`${entry.card.set}/${entry.card.number}`.toLowerCase());
      if (!print) continue;
      const uris = print.image_uris ?? print.card_faces?.[entry.card.face]?.image_uris ?? print.card_faces?.[0]?.image_uris;
      entry.card.image = uris?.normal ?? uris?.large ?? CARD_BACK;
      entry.card.name = print.name;
      entry.card.extra = { 'Set name': print.set_name, ...(print.rarity ? { Rarity: print.rarity } : {}), ...entry.card.extra };
      entry.needsLookup = false;
    }
    skipped += read.cards.filter((c) => c.needsLookup).length;
  }

  const known = read.cards.filter((c) => !c.needsLookup);
  if (known.length === 0) throw new Error('No cards could be read from that .csv file.');
  // (A file that doesn't say how many pages gets the usual 10, or more
  // if its cards need them.)
  const placed = placeCards(known, read.binder.pages ?? DEFAULT_PAGES);
  // The name: the Binder column, or the file's name without ".csv" (and
  // without the date a WUBRG'r download adds, like " 2026-10-16")
  const fromFile = fileName.replace(/\.csv$/i, '').replace(/\s+\d{4}-\d{2}-\d{2}$/, '').trim();
  const name = read.binder.name || fromFile || nextBinderName();
  return {
    name: freeBinderName(name),
    color: read.binder.color ?? null,
    cover: cleanCover(read.binder.cover),
    pages: placed.pages,
    cards: placed.cards,
    skipped,
  };
}
