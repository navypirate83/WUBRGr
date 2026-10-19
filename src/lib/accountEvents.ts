/* =====================================================================
   "SOMETHING ABOUT THE ACCOUNT CHANGED"
   Signing in or out, choosing "local use only", or the list of binders
   changing all affect what the pages show (like the footer's "Binders"
   and "Sign out" links). The storage code calls accountChanged() after
   each of those, and the pages listen (see hooks/useAccount.ts) and draw
   themselves again.
   Plain TypeScript with no React in it.
   ===================================================================== */

// A number that goes up with every change, and the functions to call
// when it does
let version = 0;
const listeners = new Set<() => void>();

// Tell everyone listening that something changed.
export function accountChanged(): void {
  version++;
  for (const listener of listeners) listener();
}

// Start listening. Returns a function that stops listening again.
export function onAccountChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The current number (React compares it to see if anything changed)
export function accountVersion(): number {
  return version;
}
