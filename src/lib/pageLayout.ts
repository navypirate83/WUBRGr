/* =====================================================================
   THE PAGE LAYOUT: how many pockets across and down each binder page has
   One layout for every binder, chosen on the Settings page (Binders →
   Page layout): 4 across by 4 down (16 pockets) to start, anything from
   1 to 6 each way (like 3 by 3 for 9-pocket pages, or 3 by 5).
   It's kept on this device under "pageLayout" (settings.ts also saves it
   to Google Drive). Changing it moves every binder's cards to match (see
   relayoutAllBinders in binderStorage.ts): each card keeps its place in
   the binder's order (pocket 1, 2, 3… counting page by page), so
   changing back puts every card exactly where it was.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageSet } from './storage';

// A layout: pockets across (columns) and down (rows) on each page
export type PageLayout = { across: number; down: number };

// The layout to start with (the same as a real 16-pocket page), and the
// fewest and most pockets each way
export const DEFAULT_LAYOUT: PageLayout = { across: 4, down: 4 };
export const LAYOUT_MIN = 1;
export const LAYOUT_MAX = 6;

// Where it's kept on this device
const LAYOUT_KEY = 'pageLayout';

// One count made safe: a whole number from 1 to 6 (anything else: the default)
function cleanCount(value: unknown, fallback: number): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= LAYOUT_MIN && number <= LAYOUT_MAX ? number : fallback;
}

// Any layout made safe (from this device, a settings file or a .csv file)
export function cleanLayout(value: unknown): PageLayout {
  const layout = (value ?? {}) as Partial<PageLayout>;
  return { across: cleanCount(layout.across, DEFAULT_LAYOUT.across), down: cleanCount(layout.down, DEFAULT_LAYOUT.down) };
}

// A layout written as text, like "3x5" (across, then down), for .csv
// files, and read back from that text (null if it isn't one)
export function layoutToText(layout: PageLayout): string {
  return `${layout.across}x${layout.down}`;
}
export function layoutFromText(text: string): PageLayout | null {
  const match = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(text);
  return match ? cleanLayout({ across: match[1], down: match[2] }) : null;
}

// The layout now. It's read from storage once, then remembered here.
let current: PageLayout | null = null;
export function pageLayout(): PageLayout {
  if (!current) {
    try { current = cleanLayout(JSON.parse(storageGet(LAYOUT_KEY) ?? 'null')); } catch { current = { ...DEFAULT_LAYOUT }; }
  }
  return current;
}

// How many pockets each page has with the layout now (or a given one)
export function pocketsPerPage(layout: PageLayout = pageLayout()): number {
  return layout.across * layout.down;
}

// Are two layouts the same?
export function sameLayout(a: PageLayout, b: PageLayout): boolean {
  return a.across === b.across && a.down === b.down;
}

// The functions to call when the layout changes (pages showing a binder
// redraw it), and a short text that changes with it (for React's
// useSyncExternalStore, which redraws when this changes)
const listeners = new Set<() => void>();
export function onLayoutChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function layoutKey(): string {
  return layoutToText(pageLayout());
}

// Keep a new layout on this device, and tell the pages. (Only call this
// after the binders' cards have been moved to match: settings.ts does both.)
export function saveLayout(layout: PageLayout): void {
  current = cleanLayout(layout);
  storageSet(LAYOUT_KEY, JSON.stringify(current));
  for (const listener of listeners) listener();
}

// Another open tab of the site changed the layout (the browser tells the
// other tabs with a "storage" event). That tab has already moved the
// cards, and sent them to this tab (see cardStore.ts), so just take the
// new layout and tell this tab's pages.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LAYOUT_KEY) return;
    current = null;   // read it again from storage
    pageLayout();
    for (const listener of listeners) listener();
  });
}
