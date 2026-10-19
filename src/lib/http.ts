/* =====================================================================
   SAFER INTERNET REQUESTS
   Every request to Scryfall (card details), and later Google Drive
   (binders), goes through fetchOrExplain, so problems come back as
   plain-English messages instead of the browser's "Failed to fetch", and
   a request that never answers doesn't leave the page stuck on
   "Loading…". (The same as the original site's binder-storage.js.)
   ===================================================================== */

// How long to wait for a reply before giving up (20 seconds).
const REQUEST_TIMEOUT_MS = 20000;

// An error that can say whether trying again might help. "offline" means
// there was no reply at all (no internet, or too slow), and "retryable"
// means asking again in a moment could work (TanStack Query, which runs
// the requests, uses it to decide whether to try again by itself).
export class RequestError extends Error {
  offline: boolean;
  retryable: boolean;
  constructor(message: string, { offline = false, retryable = false } = {}) {
    super(message);
    this.offline = offline;
    this.retryable = retryable;
  }
}

// Send a request ("fetch") and return the reply. "service" is who it's
// for, used in messages (like "Scryfall"). If there's no reply at all,
// it throws a RequestError that explains why:
//  - the device is offline
//  - it took longer than REQUEST_TIMEOUT_MS ("AbortController" is the
//    browser's way to cancel a request part way)
//  - anything else (no internet, a blocked or broken connection)
// A reply that says something went wrong (like "not found") is still a
// reply: it's returned, and the caller decides what to say.
export async function fetchOrExplain(
  url: string,
  options: RequestInit = {},
  service = 'the server',
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    const message = navigator.onLine === false
      ? 'You\'re offline. Check your internet connection, then try again.'
      : (err as Error).name === 'AbortError'
        ? `${service} is taking too long to answer. Please try again in a moment.`
        : `Couldn't reach ${service}. Check your internet connection, then try again.`;
    throw new RequestError(message, { offline: true, retryable: true });
  } finally {
    clearTimeout(timer);
  }
}
