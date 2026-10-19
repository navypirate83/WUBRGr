/* =====================================================================
   CARD PRICES
   The prices shown beside the card on the Search page, for the exact
   printing showing, regular and foil, at three stores:
   - TCGplayer (US dollars) and Cardmarket (euros): from Scryfall, which
     sends them with each card's details (updated about once a day).
   - Card Kingdom (US dollars): from Card Kingdom's own price list. It
     covers every card at once (about 8 MB to download), listed by
     Scryfall's ID for each printing, so it's downloaded once, only when
     prices are first needed, and just the prices are kept.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { fetchOrExplain, RequestError } from './http';
import type { ScryfallCard } from './scryfall';

// One store's prices for a printing: regular and foil (null = none
// known), whether the foil is "etched" foil, and a link to the card there
export type StorePrices = {
  regular: number | null;
  foil: number | null;
  etched: boolean;
  url: string;
};

// A price as text from Scryfall or Card Kingdom ("0.31") as a number,
// or null if there isn't one
function priceNumber(text: string | null | undefined): number | null {
  const number = Number(text);
  return text && Number.isFinite(number) && number > 0 ? number : null;
}

// Show a price with its currency, like "$0.31" or "€3.57" (or "—")
export function formatPrice(price: number | null, currency: 'USD' | 'EUR'): string {
  if (price === null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
}

// A store's search page for a card's name, for when there's no direct link
function searchLink(store: 'tcgplayer' | 'cardmarket' | 'cardkingdom', name: string): string {
  const q = encodeURIComponent(name);
  if (store === 'tcgplayer') return `https://www.tcgplayer.com/search/magic/product?q=${q}`;
  if (store === 'cardmarket') return `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${q}`;
  return `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${q}`;
}

// TCGplayer's prices for a printing (from Scryfall). A printing made only
// in etched foil has its foil price under "usd_etched".
export function tcgplayerPrices(print: ScryfallCard): StorePrices {
  const p = print.prices ?? {};
  const foil = priceNumber(p.usd_foil);
  return {
    regular: priceNumber(p.usd),
    foil: foil ?? priceNumber(p.usd_etched),
    etched: foil === null && priceNumber(p.usd_etched) !== null,
    url: print.purchase_uris?.tcgplayer ?? searchLink('tcgplayer', print.name),
  };
}

// Cardmarket's prices for a printing (from Scryfall), in euros
export function cardmarketPrices(print: ScryfallCard): StorePrices {
  const p = print.prices ?? {};
  const foil = priceNumber(p.eur_foil);
  return {
    regular: priceNumber(p.eur),
    foil: foil ?? priceNumber(p.eur_etched),
    etched: foil === null && priceNumber(p.eur_etched) !== null,
    url: print.purchase_uris?.cardmarket ?? searchLink('cardmarket', print.name),
  };
}

/* ---------------------------------------------------------------------
   CARD KINGDOM
   --------------------------------------------------------------------- */

// Card Kingdom's price list: every card it sells, regular and foil
// listed separately
const CARD_KINGDOM_LIST = 'https://api.cardkingdom.com/api/pricelist';

// What's kept from each entry in the list
type CardKingdomEntry = { scryfall_id?: string; is_foil?: string; price_retail?: string; url?: string };

// The kept prices: for each Scryfall ID, the regular and foil price and
// their links
export type CardKingdomPrices = Map<string, { regular?: number; foil?: number; url?: string; foilUrl?: string }>;

// Download Card Kingdom's price list and keep just the prices.
export async function loadCardKingdomPrices(): Promise<CardKingdomPrices> {
  const response = await fetchOrExplain(CARD_KINGDOM_LIST, {}, 'Card Kingdom');
  if (!response.ok) {
    throw new RequestError(`Card Kingdom's prices couldn't be loaded (error ${response.status}).`,
      { retryable: response.status >= 500 });
  }
  const list: { meta?: { base_url?: string }; data?: CardKingdomEntry[] } = await response.json();
  const base = list.meta?.base_url ?? 'https://www.cardkingdom.com/';
  const prices: CardKingdomPrices = new Map();
  for (const entry of list.data ?? []) {
    if (!entry.scryfall_id) continue;
    const price = priceNumber(entry.price_retail);
    const url = entry.url ? base + entry.url : undefined;
    const kept = prices.get(entry.scryfall_id) ?? {};
    if (entry.is_foil === 'true') { kept.foil = price ?? undefined; kept.foilUrl = url; }
    else { kept.regular = price ?? undefined; kept.url = url; }
    prices.set(entry.scryfall_id, kept);
  }
  return prices;
}

// Card Kingdom's prices for a printing, from the downloaded list. The
// link goes to the regular card's page (or the foil one if that's all
// they have), or else a search for its name.
export function cardKingdomPrices(print: ScryfallCard, list: CardKingdomPrices): StorePrices {
  const found = list.get(print.id);
  return {
    regular: found?.regular ?? null,
    foil: found?.foil ?? null,
    etched: false,
    url: found?.url ?? found?.foilUrl ?? searchLink('cardkingdom', print.name),
  };
}
