# WUBRG'r Binder

**Live site: [navypirate83.github.io/WUBRGr](https://navypirate83.github.io/WUBRGr/)**

A Magic: The Gathering card binder app: keep your cards in binders that
look and work like real ones, find any card with the MTG Card Finder, and
save everything to your own Google Drive (or just on your device).

This repository is the **React rewrite** of the original app,
[card-binder](https://github.com/navypirate83/card-binder)
([live site](https://navypirate83.github.io/card-binder/)), which was
built with plain HTML, CSS and JavaScript. Both use the same Google Drive
folder, but WUBRG'r saves each binder as a `.csv` file, and the original
saved `.json` files. The first time WUBRG'r opens a Drive folder, it
turns each old `.json` binder into a `.csv` one, and keeps a backup copy
of the `.json` (which the original site can still open).

## What it does

- **My Binders**: a shelf of binders with colored covers and Magic
  symbols. Make, rename, reorder, delete, download and upload them, and
  search the cards in them. Binders are `.csv` files in the same layout
  as a ManaBox export (plus each card's page and pocket, and the binder's
  name, cover and pages), so ManaBox lists can be uploaded and binders
  imported into ManaBox.
- **Binder pages**: pockets of cards that turn like a real binder, with
  copy counts, foil borders, dragging cards between pockets and binders,
  and dropping card pictures in from Scryfall or EDHREC.
- **MTG Card Finder**: search any card, pick its set, version and
  language, see its rulings, format legality and prices (TCGplayer, Card
  Kingdom, Cardmarket), share it, and add it to a binder.
- **Settings**: theme (Dark, System or Light), the binder page layout
  (pockets across × down, like 3 × 3 or 3 × 5), and which formats show in
  Format Legality, saved to Google Drive.
- **Help**: instructions for every page.
- **Installable** as an app on computers and phones, and opens without an
  internet connection (`public/manifest.webmanifest` and the service
  worker `public/sw.js`).
- Works with the mouse, touch and the keyboard.

## How it's built

- **React + TypeScript**, built with **Vite**, as a static site on
  **GitHub Pages** (no server: binders stay in each user's Google Drive).
- **React Router** for the pages, **TanStack Query** for Scryfall card
  data, and **dnd-kit** for dragging cards and binders.
- Every push to `main` is built and published by a GitHub Actions
  workflow (`.github/workflows/deploy.yml`).

## Where things are

- `src/pages/`: the pages (`HelpPage.tsx`, with its text in
  `src/pages/help/helpTopics.tsx`). Pages made of several pieces have
  their own folder: `home/`, `binders/` (the shelf), `binder/` (one
  binder's pages), `search/` and `settings/`, plus the starter `lists/`
  and `decklists/` pages.
- `src/components/`: pieces shared by the pages (top bar, footer, pop-up
  windows, and in `binders/` the closed binder picture and the New
  binder window).
- `src/hooks/`: shared page behavior (shortcut keys, messages read out
  to screen readers, who's signed in, settings).
- `src/lib/`: plain TypeScript with no React (Google sign-in and Drive,
  binder storage (each binder's cards in the browser's IndexedDB), binder
  `.csv` files, cover colors, talking to Scryfall, the card-name
  search, card helpers, prices, the page-turn animation, card pictures
  dropped from other websites, settings, light/dark theme), to share
  with a future phone app.
- `src/styles/`: the site's colors and basics (`global.css`) and the
  binder cover colors (`covers.css`). Each page and component has its
  own `.module.css` file beside it.

## Card data

Card information and images are provided by [Scryfall](https://scryfall.com).
WUBRG'r Binder is unofficial Fan Content permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC.
