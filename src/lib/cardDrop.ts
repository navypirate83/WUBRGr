/* =====================================================================
   DROPPING CARD PICTURES FROM OTHER WEBSITES
   Drag a card picture (or a card's link) from Scryfall or EDHREC in
   another browser window onto an EMPTY binder pocket, and that pocket
   gets the card. The browser hands over what was dragged in a
   "dataTransfer": web addresses, a little HTML (like <img src=... alt=...>)
   and plain text. From those we work out which card it is:
     - a Scryfall card picture (cards.scryfall.io/.../front/a/b/ID.jpg):
       its ID is that exact printing (and language); "back" in the
       address means the back side of a two-sided card. EDHREC shows
       Scryfall's pictures, so its card pictures work the same way.
     - a Scryfall card page (scryfall.com/card/SET/NUMBER/...): that printing
     - an EDHREC card page (edhrec.com/cards/sol-ring): looked up by name
     - otherwise a card name: the picture's description (alt text), or
       dragged text, looked up by name (Scryfall picks the closest match)
   Plain TypeScript with no React in it.
   ===================================================================== */

import type { BinderCard } from './binderStorage';
import { CARD_BACK, foilChoices, imageFor, isDoubleSided } from './cards';
import type { ScryfallCard } from './scryfall';

// Is something being dragged in from outside the page (a picture, link
// or text)? Moving cards inside the binder doesn't use this kind of drag.
export function isOutsideDrag(dataTransfer: DataTransfer | null): boolean {
  const types = dataTransfer ? [...dataTransfer.types] : [];
  return types.includes('text/uri-list') || types.includes('text/html') || types.includes('text/plain');
}

// Work out how to look up the dragged card on Scryfall. Returns
// { path, face } (the Scryfall address to ask, and 0 = front / 1 = back),
// or null if nothing dragged looks like a card.
export function lookupFromDrop(dataTransfer: DataTransfer): { path: string; face: number } | null {
  const addresses: string[] = [];
  let altText = '';

  // Web addresses: the "uri-list" (one per line; lines starting with #
  // are notes), and the picture / link addresses inside any HTML.
  const uriList = dataTransfer.getData('text/uri-list');
  for (const line of uriList.split(/\r?\n/)) if (line && !line.startsWith('#')) addresses.push(line.trim());
  const html = dataTransfer.getData('text/html');
  if (html) {
    // Read the HTML without running it (DOMParser only reads it)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const img = doc.querySelector('img');
    if (img) { addresses.unshift(img.getAttribute('src') ?? ''); altText = img.getAttribute('alt') ?? ''; }
    const link = doc.querySelector('a[href]');
    if (link) addresses.push(link.getAttribute('href')!);
  }
  const text = dataTransfer.getData('text/plain').trim();
  if (/^https?:\/\//.test(text)) addresses.push(text);

  for (const address of addresses) {
    let url: URL;
    try { url = new URL(address); } catch { continue; }   // not a web address
    const host = url.hostname;
    // A Scryfall picture: the card's ID is the long code at the end.
    const picture = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$/i.exec(url.pathname);
    if (picture && /(^|\.)scryfall\.(io|com)$/.test(host)) {
      return { path: `/cards/${picture[1]}`, face: url.pathname.includes('/back/') ? 1 : 0 };
    }
    // A Scryfall card page: /card/SET/NUMBER/... (sometimes /card/SET/NUMBER/LANGUAGE/name)
    const page = /^\/card\/([^/]+)\/([^/]+)(?:\/([a-z]{2,3})\/)?/i.exec(url.pathname);
    if (page && /(^|\.)scryfall\.com$/.test(host)) {
      const lang = page[3] ? `/${page[3]}` : '';
      return { path: `/cards/${encodeURIComponent(page[1])}/${encodeURIComponent(page[2])}${lang}`, face: 0 };
    }
    // An EDHREC card or commander page: the name is in the address.
    const edhrec = /^\/(?:cards|commanders)\/([^/?#]+)/.exec(url.pathname);
    if (edhrec && /(^|\.)edhrec\.com$/.test(host)) {
      return { path: `/cards/named?fuzzy=${encodeURIComponent(edhrec[1].replace(/-/g, ' '))}`, face: 0 };
    }
  }

  // No address we know: try a card name (the picture's description, or
  // plain dragged text that isn't an address).
  const name = altText || (/^https?:\/\//.test(text) ? '' : text);
  if (name && name.length <= 150) return { path: `/cards/named?fuzzy=${encodeURIComponent(name)}`, face: 0 };
  return null;
}

// Turn Scryfall's card details into a binder card, the same way the MTG
// Card Finder does: its name, set, number, side, language (if not
// English), the pocket-sized picture, foil if it ONLY comes in foil, when
// it's added (now), and the set's name and the card's rarity.
export function binderCardFrom(card: ScryfallCard, wantedFace: number): BinderCard {
  const face = isDoubleSided(card) ? wantedFace : 0;
  return {
    name: card.name,
    set: card.set,
    number: card.collector_number,
    face,
    lang: card.lang && card.lang !== 'en' ? card.lang : undefined,
    foil: foilChoices(card).onlyFoil ? true : undefined,
    image: imageFor(card, face, ['normal', 'large']) ?? CARD_BACK,
    added: new Date().toISOString(),
    extra: { 'Set name': card.set_name, ...(card.rarity && { Rarity: card.rarity }) },
  };
}
