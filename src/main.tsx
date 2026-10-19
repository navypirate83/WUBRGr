/* =====================================================================
   THE APP'S STARTING POINT
   index.html loads this file. It loads the site-wide styles and draws
   the app into the empty <div id="root"> box.
   ===================================================================== */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestError } from './lib/http';
import App from './App';
import './styles/global.css';
import './styles/covers.css';

// TanStack Query runs the requests for Scryfall's card data, and keeps
// ("caches") the answers, so looking at the same card again is instant.
// These are its settings for every request:
//  - staleTime Infinity: card details don't change while you're on the
//    site, so an answer it already has is never downloaded again.
//  - retry: when a request fails in a way that trying again might fix
//    (no reply, or Scryfall too busy), try again up to 2 more times.
//    A "card not found" answer isn't tried again: it would just fail again.
//  - refetchOnWindowFocus false: don't re-download when you switch back
//    to this browser tab.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: (failureCount, error) => error instanceof RequestError && error.retryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Draw the app. The pieces around it:
//  - StrictMode: while working locally, React double-checks the code and
//    warns about common mistakes (it does nothing on the real site).
//  - QueryClientProvider: lets every page use the queryClient above.
//  - BrowserRouter: lets the app show a different page for each address
//    (like /WUBRGr/help) without reloading. "basename" is the "/WUBRGr/"
//    part at the start of every address (set as "base" in vite.config.ts).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
