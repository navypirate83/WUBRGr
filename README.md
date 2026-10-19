# WUBRG'r Binder

A Magic: The Gathering card binder app: keep your cards in binders that
look and work like real ones, find any card with the MTG Card Finder, and
save everything to your own Google Drive (or just on your device).

This repository is the **React rewrite** of the original app,
[card-binder](https://github.com/navypirate83/card-binder)
([live site](https://navypirate83.github.io/card-binder/)), which was
built with plain HTML, CSS and JavaScript.

## Plan

- **React + TypeScript**, built with **Vite**, as a static site for
  **GitHub Pages** (no server: binders stay in each user's Google Drive).
- **React Router** for the pages: Home, Binders, a binder, Search and Help.
- **dnd-kit** for dragging cards and binders (mouse, touch and keyboard).
- **TanStack Query** for Scryfall card data (caching and retries).
- The original app's look (binder pages, covers, foil rainbow borders)
  carried over with CSS Modules.
- App logic (Scryfall, Google Drive, binder data) in plain TypeScript
  files, so a future Android / iOS app can reuse it.

Rewritten one page at a time: Help, then Search, then Binders, then the
binder pages. All done: **Help**, **Search**, **Home and Binders** (the
welcome page with Google sign-in or local use, and the shelf of
binders) and the **binder pages**.

Binders are saved under the same names as the original site (in Google
Drive and in the browser), so the two sites share them.

## Running it

You need [Node.js](https://nodejs.org) installed. In this folder:

- `npm install`: download the packages the app uses (once, and after
  they change).
- `npm run dev`: run the app while working on it, at
  http://localhost:3000/WUBRGr/ (it picks the next free port if 3000 is
  taken). It refreshes by itself when you save a file.
- `npm run build`: check the code for mistakes, then build the finished
  site into the `dist` folder, ready for GitHub Pages.

## Where things are

- `src/pages/`: the pages (`HelpPage.tsx`, with its text in
  `src/pages/help/helpTopics.tsx`). Pages made of several pieces have
  their own folder: `home/`, `binders/` (the shelf), `binder/` (one
  binder's pages) and `search/`.
- `src/components/`: pieces shared by the pages (top bar, footer, pop-up
  windows, and in `binders/` the closed binder picture and the New
  binder window).
- `src/hooks/`: shared page behavior (shortcut keys, messages read out
  to screen readers, who's signed in).
- `src/lib/`: plain TypeScript with no React (Google sign-in and Drive,
  binder storage, cover colors, talking to Scryfall, the card-name
  search, card helpers, the page-turn animation, card pictures dropped
  from other websites, saved settings, light/dark theme), to share with
  a future phone app.
- `src/styles/`: the site's colors and basics (`global.css`) and the
  binder cover colors (`covers.css`). Each page and component has its
  own `.module.css` file beside it.

Google sign-in only works from addresses listed for the site's Google
Client ID in Google Cloud Console (the live site's address is). While
working locally, use "Skip login, local use only" unless
`http://localhost:3000` has been added there too.
- `src/styles/global.css`: the site's colors and basics. Each page and
  component has its own `.module.css` file beside it.

## Card data

Card information and images are provided by [Scryfall](https://scryfall.com).
WUBRG'r Binder is unofficial Fan Content permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC.
