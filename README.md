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
binder pages.

## Card data

Card information and images are provided by [Scryfall](https://scryfall.com).
WUBRG'r Binder is unofficial Fan Content permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC.
