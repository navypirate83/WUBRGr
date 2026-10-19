/* =====================================================================
   BROWSER STORAGE
   Small safe wrappers around localStorage (the browser's own little
   store that keeps things between visits). Some browsers (for example
   some private windows) block it; then these quietly do nothing instead
   of crashing the page.
   This file is plain TypeScript with no React in it, so a future phone
   app can reuse it.
   ===================================================================== */

// Read a saved value, or null if there isn't one (or storage is blocked).
export function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// Save a value. Returns true if it was saved, false if storage is blocked.
export function storageSet(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

// Forget a saved value.
export function storageRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* blocked: nothing to do */ }
}
