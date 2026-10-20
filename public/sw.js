/* =====================================================================
   THE SERVICE WORKER: lets WUBRG'r open without an internet connection
   A service worker is a small script the browser keeps running in the
   background for this site. Every time the app asks for one of its own
   files (the page, its JavaScript and styles, its icons), the request
   passes through here first, so this script can answer from a saved copy
   (a "cache") when the internet isn't there.
   - The page itself (index.html): always fetched fresh when online, so
     an update to the site shows up straight away. The saved copy is only
     used when offline.
   - The app's code and styles (in /assets/): their file names change
     with every new version (like "index-D8R33kTa.js"), so a saved copy
     is never out of date: use it if there is one, otherwise download it
     and save it.
   - Icons and pictures in the site: the same, saved the first time.
   - Everything from other websites (Scryfall cards, Google sign-in and
     Drive, prices) isn't touched: it goes straight to the internet as
     normal.
   The browser installs this file (see src/main.tsx). Changing CACHE_NAME
   below throws away every saved copy and starts afresh.
   ===================================================================== */

// The name of this site's box of saved files
const CACHE_NAME = 'wubrgr-v1';

// The site's own address (e.g. https://navypirate83.github.io/WUBRGr/),
// worked out from where this file lives, so it works locally too
const SCOPE = self.registration.scope;

// INSTALLING: save the starting page straight away, so the app can open
// offline even before it has been used much. "skipWaiting" lets a new
// version of this file take over without waiting for every tab to close.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(SCOPE))
      .then(() => self.skipWaiting()),
  );
});

// TAKING OVER: throw away boxes of saved files from older versions of
// this file (any other name), then start handling the open tabs.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// EVERY REQUEST: decide where the answer comes from.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only plain downloads ("GET") of this site's own files. Anything else
  // (other websites, saving to Google Drive) goes ahead as normal.
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  // Opening a page of the app (any address, like /WUBRGr/binders/...):
  // the app is one page that draws every address itself, so the answer
  // is always index.html. Fetch it fresh (and save that copy); if there's
  // no internet, use the saved copy.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SCOPE, copy));
          }
          return response;
        })
        .catch(() => caches.match(SCOPE, { ignoreVary: true })),
    );
    return;
  }

  // The app's code, styles, icons and pictures (and the manifest): the
  // saved copy if there is one, otherwise download it (and save it for
  // next time). Anything else of the site's goes ahead as normal.
  // "ignoreVary": a saved copy is found by its address alone. (Servers
  // can mark a file as "differs by the Origin header", and a stylesheet's
  // request doesn't always carry the same Origin header as when it was
  // saved; for the site's own files that difference doesn't matter.)
  const path = request.url.slice(SCOPE.length);
  if (!/^(assets|icons|images)\//.test(path) && path !== 'manifest.webmanifest') return;
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((saved) => saved ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
