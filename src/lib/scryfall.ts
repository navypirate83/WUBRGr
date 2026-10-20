/* =====================================================================
   TALKING TO SCRYFALL
   Scryfall (scryfall.com) is where all the card information and pictures
   come from. This file asks it for things and hands back the answers.
   It's plain TypeScript with no React in it, so a future phone app can
   reuse it. (The Search page asks for these through TanStack Query,
   which remembers the answers so the same thing isn't downloaded twice.)
   ===================================================================== */

import { fetchOrExplain, RequestError } from './http';

// The address of the Scryfall API
const API = 'https://api.scryfall.com';

// Scryfall asks for at least this much time between requests (in
// milliseconds: 1000 ms = 1 second)
const REQUEST_GAP_MS = 100;

/* ---------------------------------------------------------------------
   WHAT SCRYFALL SENDS
   These "types" describe the parts of Scryfall's answers this app uses,
   so TypeScript can warn if the code uses a part that doesn't exist.
   A "?" means the part isn't always there.
   --------------------------------------------------------------------- */

// The picture addresses for a card (or one side of it), in several sizes
export type ImageUris = {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
};

// One side of a card that has two (or two halves)
export type CardFace = {
  name: string;
  image_uris?: ImageUris;
};

// One printing of a card: a card in one set, one version, one language
export type ScryfallCard = {
  id: string;
  name: string;
  lang: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity?: string;
  released_at: string;
  artist?: string;
  scryfall_uri: string;
  prints_search_uri: string;
  rulings_uri: string;
  image_status?: string;
  image_uris?: ImageUris;
  card_faces?: CardFace[];
  border_color?: string;
  full_art?: boolean;
  textless?: boolean;
  frame?: string;
  frame_effects?: string[];
  promo?: boolean;
  finishes?: string[];
  legalities?: Record<string, string>;
  // Today's prices, as text like "0.31" (or null when there isn't one):
  // "usd" ones are TCGplayer's, "eur" ones are Cardmarket's
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    eur_etched?: string | null;
  };
  // Links to buy this printing at the stores
  purchase_uris?: {
    tcgplayer?: string;
    cardmarket?: string;
  };
};

// One official ruling (a note about how the card works)
export type Ruling = {
  source: string;
  published_at: string;
  comment: string;
};

// One set (from the list of every set)
type ScryfallSet = {
  code: string;
  icon_svg_uri: string;
};

// A list that may come in pages: "has_more" says another page follows
type ListPage<T> = {
  data: T[];
  has_more?: boolean;
  next_page?: string;
};

/* ---------------------------------------------------------------------
   ASKING SCRYFALL
   --------------------------------------------------------------------- */

// When the most recent request was (or will be) sent
let lastRequestTime = 0;

// A pause: "await sleep(100)" waits 100 milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch JSON from Scryfall. To be polite, wait if the previous request
// was sent less than REQUEST_GAP_MS ago. Throws a RequestError with a
// message that can be shown on the page when something goes wrong:
//  - no reply at all (offline, too slow): see fetchOrExplain in http.ts
//  - Scryfall's own message (it sends "details", e.g. a card not found)
//  - too many requests (error 429): Scryfall asks to slow down
//  - anything else, including a reply that isn't readable JSON
async function scryfall<T>(pathOrUrl: string): Promise<T> {
  const wait = Math.max(0, lastRequestTime + REQUEST_GAP_MS - Date.now());
  lastRequestTime = Date.now() + wait;
  if (wait) await sleep(wait);

  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  const response = await fetchOrExplain(url, { headers: { Accept: 'application/json' } }, 'Scryfall');
  let data: (T & { details?: string }) | null = null;
  try { data = await response.json(); } catch { /* not JSON: handled below */ }
  if (response.ok && data) return data;
  if (response.status === 429) {
    throw new RequestError('Scryfall is busy right now. Wait a moment, then try again.', { retryable: true });
  }
  if (data?.details) throw new RequestError(data.details);
  // Errors 500 and up are Scryfall's own trouble, so trying again may help.
  throw new RequestError(`Scryfall had a problem (error ${response.status}). Please try again in a moment.`,
    { retryable: response.status >= 500 });
}

// Some Scryfall lists come in pages. Keep asking for the next page
// until we have everything, then return one combined list.
async function fetchAllPages<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let next: string | undefined = url;
  while (next) {
    const page: ListPage<T> = await scryfall<ListPage<T>>(next);
    results.push(...page.data);
    next = page.has_more ? page.next_page : undefined;
  }
  return results;
}

/* ---------------------------------------------------------------------
   THE THINGS THE SEARCH PAGE ASKS FOR
   --------------------------------------------------------------------- */

// The full list of card names (about 35,000), downloaded once so the
// search can run instantly in the browser as you type.
export async function loadCardNames(): Promise<string[]> {
  const catalog = await scryfall<{ data: string[] }>('/catalog/card-names');
  return catalog.data;
}

// Scryfall's own name suggestions (at most 20), used until the full list
// of names has downloaded. Returns nothing if it can't be reached.
export async function autocomplete(text: string): Promise<string[]> {
  try {
    const result = await scryfall<{ data: string[] }>('/cards/autocomplete?q=' + encodeURIComponent(text));
    return result.data;
  } catch {
    return [];
  }
}

// Every set's symbol picture, as a lookup from set code to picture address
export async function loadSetIcons(): Promise<Map<string, string>> {
  const sets = await scryfall<{ data: ScryfallSet[] }>('/sets');
  return new Map(sets.data.map((set) => [set.code, set.icon_svg_uri]));
}

// The addresses that look up one card:
//  - by name: "exact" when the name came from the suggestion list,
//    otherwise Scryfall guesses the closest match ("fuzzy")
//  - by set code and collector number: one exact printing (used by
//    shared links)
export function cardByNamePath(name: string, exact: boolean): string {
  return `/cards/named?${exact ? 'exact' : 'fuzzy'}=${encodeURIComponent(name)}`;
}
export function cardBySetPath(setCode: string, number: string): string {
  return `/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(number)}`;
}

// Look up a card, then every printing of it (in every set).
export async function loadCard(path: string): Promise<{ card: ScryfallCard; prints: ScryfallCard[] }> {
  const card = await scryfall<ScryfallCard>(path);
  const prints = await fetchAllPages<ScryfallCard>(card.prints_search_uri);
  return { card, prints };
}

// Look up just one card, by a Scryfall address like "/cards/<id>" or
// "/cards/named?fuzzy=sol%20ring" (used when a card picture is dropped
// on a binder pocket).
export function loadOneCard(path: string): Promise<ScryfallCard> {
  return scryfall<ScryfallCard>(path);
}

// Look up many exact printings at once, by set code and collector number
// (used when an uploaded .csv file has cards without a Scryfall ID).
// Scryfall's "collection" lookup takes up to 75 cards per request, so
// the list is sent in batches of 75, with the usual polite gap between
// requests. Returns a lookup from "set/number" (lowercase) to the card;
// cards Scryfall doesn't know are just missing from it.
export async function loadPrintings(wanted: { set: string; number: string }[]): Promise<Map<string, ScryfallCard>> {
  const found = new Map<string, ScryfallCard>();
  for (let start = 0; start < wanted.length; start += 75) {
    const batch = wanted.slice(start, start + 75);
    const wait = Math.max(0, lastRequestTime + REQUEST_GAP_MS - Date.now());
    lastRequestTime = Date.now() + wait;
    if (wait) await sleep(wait);
    const response = await fetchOrExplain(`${API}/cards/collection`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: batch.map((c) => ({ set: c.set, collector_number: c.number })) }),
    }, 'Scryfall');
    if (!response.ok) throw new RequestError(`Scryfall had a problem (error ${response.status}). Please try again in a moment.`);
    const data: { data: ScryfallCard[] } = await response.json();
    for (const card of data.data) found.set(`${card.set}/${card.collector_number}`.toLowerCase(), card);
  }
  return found;
}

// The official rulings for a card, oldest first (the order Scryfall sends)
export function loadRulings(rulingsUrl: string): Promise<Ruling[]> {
  return fetchAllPages<Ruling>(rulingsUrl);
}

// One exact printing in every language it was made in. Scryfall treats
// each language as its own card, so this searches for "this set + this
// collector number, in any language". If the list can't be loaded, it's
// just this printing. Sorted English first, then A to Z by language name.
export async function loadLanguages(
  print: ScryfallCard,
  languageName: (code: string) => string,
): Promise<ScryfallCard[]> {
  let versions: ScryfallCard[];
  try {
    const query = `set:${print.set} cn:"${print.collector_number}" lang:any`;
    versions = await fetchAllPages<ScryfallCard>(`/cards/search?unique=prints&q=${encodeURIComponent(query)}`);
  } catch {
    versions = [];
  }
  if (!versions.some((v) => v.lang === print.lang)) versions.push(print);
  return versions.sort((a, b) =>
    Number(b.lang === 'en') - Number(a.lang === 'en') ||
    languageName(a.lang).localeCompare(languageName(b.lang)));
}
