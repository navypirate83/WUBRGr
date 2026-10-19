/* =====================================================================
   FINDING CARD NAMES AS YOU TYPE (the fuzzy search)
   Matches what's typed against the full list of card names, forgiving
   spacing, punctuation, accents and small typos. The same rules as the
   original site, so the suggestions come out in the same order.
   Plain TypeScript with no React in it.
   ===================================================================== */

// One card name, kept in a few forms for fast matching: as shown,
// simplified, and a list of "word tails" (the compact name starting from
// each word). For "Krang, Utrom Warlord" the tails are:
//   "krangutromwarlord", "utromwarlord", "warlord"
// This lets the search match the start of ANY word quickly.
export type NameEntry = {
  name: string;
  simple: string;
  wordTails: string[];
};

// Make text easier to compare:
//   - lowercase, and remove accents ("Séance" -> "seance"). NFD splits an
//     accented letter into letter + accent mark; \p{M} then removes the marks.
//   - turn dashes and slashes into spaces ("Ur-Dragon" -> "ur dragon").
//     \p{Pd} means "any kind of dash".
//   - drop all other punctuation (commas, apostrophes, etc.)
//   - squash repeated spaces into one
export function simplify(text: string): string {
  return text
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{Pd}/_]/gu, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// An even simpler version with NO spaces at all, so spacing and
// punctuation never matter: "ur dragon", "ur-dragon" and "urdragon"
// all become "urdragon".
export function compact(text: string): string {
  return simplify(text).replace(/ /g, '');
}

// Prepare the downloaded list of names for searching (done once).
export function prepareNames(names: string[]): NameEntry[] {
  return names.map((name) => {
    const words = simplify(name).split(' ');
    return {
      name,
      simple: words.join(' '),
      wordTails: words.map((_, i) => words.slice(i).join('')),
    };
  });
}

// Count how many single-letter edits (add, remove, or change a letter)
// turn one word into another. This is the "Levenshtein distance" and
// lets the search forgive typos like "lightnig" for "lightning".
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

// Score how well a card name matches what was typed, for when NO word
// in any name starts with the typed text. Higher = better; 0 = no match.
// Checks, best first:
//   1. the text appears inside a word ("ightning" -> "Lightning Bolt")
//   2. the letters appear in order with small gaps ("lgtbolt" -> "Lightning Bolt")
//   3. close enough with a typo or two ("lightnig" -> "Lightning Bolt")
function fuzzyScore(query: string, target: string): number {
  const index = target.indexOf(query);
  if (index !== -1) return 700 - index - (target.length - query.length) * 0.1;

  // Letters in order: walk through the name looking for each typed letter.
  // Matches that begin at the start of a word get a bonus, and matches
  // that begin further into the name get a small penalty.
  let position = 0;
  let gaps = 0;
  let firstFound = -1;
  let lastFound = -1;
  let inOrder = true;
  for (const letter of query) {
    const found = target.indexOf(letter, position);
    if (found === -1) { inOrder = false; break; }
    if (firstFound === -1) firstFound = found;
    if (lastFound !== -1) gaps += found - lastFound - 1;
    lastFound = found;
    position = found + 1;
  }
  if (inOrder && gaps <= query.length * 2) {
    const wordStartBonus = (firstFound === 0 || target[firstFound - 1] === ' ') ? 40 : 0;
    return 500 + wordStartBonus - gaps * 5 - firstFound * 2 - target.length * 0.1;
  }

  // Typo check: compare the typed text with same-length chunks of the
  // name that begin at the start of each word. Longer text may have more typos.
  if (query.length >= 4) {
    const allowedTypos = query.length >= 8 ? 2 : 1;
    let best = Infinity;
    for (let start = 0; start < target.length && best > 0; start++) {
      if (start > 0 && target[start - 1] !== ' ') continue;
      best = Math.min(best, editDistance(query, target.slice(start, start + query.length)));
    }
    if (best <= allowedTypos) return 300 - best * 50 - target.length * 0.1;
  }
  return 0;
}

// Find every card name that matches the typed text, best matches first.
export function fuzzySearch(entries: NameEntry[], text: string): string[] {
  const query = simplify(text);
  if (!query) return [];

  // Step 1: if the typed text matches the start of the name, or the start
  // of any later word, show ONLY those cards. We compare compact forms, so
  // "krang utrom" and "utrom" both match "Krang, Utrom Warlord".
  const typedCompact = compact(text);
  const wordMatches: { entry: NameEntry; wordIndex: number }[] = [];
  for (const entry of entries) {
    const wordIndex = entry.wordTails.findIndex((tail) => tail.startsWith(typedCompact));
    if (wordIndex !== -1) wordMatches.push({ entry, wordIndex });
  }
  if (wordMatches.length) {
    // Names that START with it come first, then matches on the 2nd word,
    // then the 3rd, and so on. Ties: shorter names first, then A to Z.
    wordMatches.sort((a, b) =>
      a.wordIndex - b.wordIndex ||
      a.entry.simple.length - b.entry.simple.length ||
      a.entry.name.localeCompare(b.entry.name));
    return wordMatches.map((m) => m.entry.name);
  }

  // Step 2: nothing starts with it, so score every name with fuzzyScore.
  const scored: { name: string; score: number }[] = [];
  for (const entry of entries) {
    const score = fuzzyScore(query, entry.simple);
    if (score > 0) scored.push({ name: entry.name, score });
  }
  // Best score first; if tied, shorter names first.
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored.map((m) => m.name);
}

// Split a name into three parts around the bit that matches what was
// typed, so the page can highlight the middle part. Spaces and
// punctuation are ignored, so typing "ur dragon" still highlights
// "Ur-Dragon" in the name. No match: everything is in "before".
export function matchParts(name: string, typed: string): { before: string; match: string; after: string } {
  const none = { before: name, match: '', after: '' };
  const typedCompact = compact(typed);
  if (!typedCompact) return none;

  // Build a compact copy of the name, remembering where each of its
  // letters came from in the original name.
  let nameCompact = '';
  const origin: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const letter = compact(name[i]);
    if (letter) { nameCompact += letter; origin.push(i); }
  }

  // Does the compact letter at "pos" begin a word in the real name?
  // (True at the very start, or right after a space/dash/comma — but not
  // after an apostrophe, so the "s" in "Karn's" doesn't count.)
  const startsWord = (pos: number) => {
    const before = name[origin[pos] - 1];
    return origin[pos] === 0 || (before !== '\'' && compact(before) === '');
  };

  // Find the typed text in the compact name, preferring a spot at the
  // start of a word (so "utrom" highlights "Utrom", not the middle of
  // some other word).
  let at = nameCompact.indexOf(typedCompact);
  for (let pos = at; pos !== -1; pos = nameCompact.indexOf(typedCompact, pos + 1)) {
    if (startsWord(pos)) { at = pos; break; }
  }
  if (at === -1) return none;

  // Turn the compact positions back into positions in the real name.
  const start = origin[at];
  const end = origin[at + typedCompact.length - 1] + 1;
  return { before: name.slice(0, start), match: name.slice(start, end), after: name.slice(end) };
}
