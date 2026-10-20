/* =====================================================================
   THE HELP TEXT
   All the instructions on the Help page, as a list: one "topic" for each
   page of the site, each with its sections. The Help page draws both
   columns from this one list (the links on the left and the instructions
   on the right), so a section added here shows up in both places.
   Each id (like "binder-moving") is the end of that section's address
   (/help#binder-moving), so links to it keep working.
   ===================================================================== */

import type { ReactNode } from 'react';
import { Link } from 'react-router';

// One section of instructions: its id, its heading, and its text
export type HelpSection = {
  id: string;
  title: string;
  body: ReactNode;
};

// One page of the site: its id, its name, a short summary, and its sections
export type HelpTopic = {
  id: string;
  title: string;
  lead: ReactNode;
  sections: HelpSection[];
};

// A link from one part of the instructions to another section, like
// <HelpLink to="my-binders-backup">. It only changes the end of the
// address (the part after "#"), so it stays on the Help page.
function HelpLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={{ hash: `#${to}` }}>{children}</Link>;
}

export const helpTopics: HelpTopic[] = [
  /* ===================== MY BINDERS ===================== */
  {
    id: 'my-binders',
    title: 'My Binders',
    lead: (
      <>
        My Binders is your shelf: every binder you own, shown as a closed
        binder with its name, cover symbol and color. The number under each
        one is how many cards are in it.
      </>
    ),
    sections: [
      {
        id: 'my-binders-start',
        title: 'Getting started',
        body: (
          <>
            <p>
              When you first open the site, you see the welcome page: a picture of an open
              binder full of cards, with two choices under it:
            </p>
            <ul>
              <li><strong>Sign in with Google</strong> to save your binders in your own
                Google Drive (in a folder called "MTG Card Binder", one .CSV file per
                binder: see <HelpLink to="my-binders-backup">Binder files</HelpLink>). You
                can then open them on any computer or phone by signing in there.</li>
              <li><strong>Skip login, local use only</strong> to start right away without
                an account. Your binders are saved on this device only. You can sign in
                later, and your binders will be copied to Google Drive then.</li>
            </ul>
            <p>
              Either way, you then see your shelf of binders. The site remembers your choice:
              after that, the welcome page (<strong>Home</strong>) shows without the sign-in
              buttons, with a <strong>Go to your binders</strong> link,
              and <strong>Binders</strong> at the bottom of every page goes straight to your shelf.
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-new',
        title: 'Making a binder',
        body: (
          <>
            <ol>
              <li>Click the binder with the white <strong>+</strong> on it (always last on the shelf).</li>
              <li>Type a <strong>name</strong>, up to 12 characters so it fits on the cover's label.
                A name like "Binder 3" is filled in for you.</li>
              <li>Pick a <strong>cover symbol</strong>: none, one of the five colors, colorless,
                planeswalker, or one of the two-color symbols.</li>
              <li>Pick a <strong>cover color</strong>. Choose <strong>Custom</strong> to pick any
                color you like.</li>
              <li>Click <strong>Create binder</strong>.</li>
            </ol>
            <p>New binders have 10 pages of 16 pockets (160 cards). There's no limit on how many binders you can make.</p>
            <p>
              To bring back a binder you saved as a file, or make one from a ManaBox card
              list, use <strong>Upload .CSV</strong> in the same window
              (see <HelpLink to="my-binders-backup">Binder files</HelpLink>).
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-open',
        title: 'Opening and arranging',
        body: (
          <>
            <ul>
              <li><strong>Open a binder</strong>: click it.</li>
              <li><strong>Change the order</strong>: drag a binder to a new spot on the shelf and
                let go. On a phone, press and hold a binder until it lifts (with a small buzz or
                tick on most phones), then slide it.</li>
            </ul>
            <p>The shelf fits as many binders across as your screen has room for.</p>
          </>
        ),
      },
      {
        id: 'my-binders-edit',
        title: 'Changing a binder',
        body: (
          <>
            <p>
              Start dragging a binder, and a <strong>pencil circle</strong> appears at the top
              of the page. Drop the binder on it to open <strong>Binder properties</strong>,
              where you can change:
            </p>
            <ul>
              <li>its <strong>name</strong>,</li>
              <li>how many <strong>pages</strong> it has (as many as you like). It can't be made smaller
                than the pages its cards need; cards on pages that go away are moved into
                empty pockets on the pages that stay,</li>
              <li>its <strong>cover symbol</strong> and <strong>cover color</strong>.</li>
            </ul>
            <p>Click <strong>Save</strong> to keep the changes, or <strong>Cancel</strong> to leave it as it was.</p>
          </>
        ),
      },
      {
        id: 'my-binders-delete',
        title: 'Deleting a binder',
        body: (
          <>
            <p>
              While dragging a binder, a <strong>red X circle</strong> appears at the bottom of
              the page. Drop the binder on it, and you'll be asked if you're sure (with how
              many cards are in it). Click <strong>Yes, delete</strong> to delete it,
              or <strong>No</strong> to keep it.
            </p>
            <p>
              When signed in, a deleted binder goes to your Google Drive trash, where you
              can restore it for 30 days. When using the site locally, it's gone for good.
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-backup',
        title: 'Binder files',
        body: (
          <>
            <p>
              Each binder is saved as a <strong>.CSV file</strong>: a simple table of its cards
              that spreadsheet programs (like Excel or Google Sheets) can open. It uses the
              same columns as a <strong>ManaBox</strong> collection export (except ManaBox ID,
              Misprint, Altered and Signed), so ManaBox can import it. Each line is one card, with its name, set, collector number, foil,
              how many copies, language and the date it was added. After those come:
            </p>
            <ul>
              <li><strong>Page</strong> and <strong>Pocket</strong>: where the card is in the binder.</li>
              <li><strong>Side</strong>: which side of a two-sided card faces out.</li>
              <li><strong>Binder</strong>, <strong>Cover symbol</strong>, <strong>Cover
                color</strong> and <strong>Pages</strong>: the binder's own name, cover and
                size (the same on every line).</li>
            </ul>
            <p>You can also save a binder to your computer, to keep as a backup or share with a friend:</p>
            <ul>
              <li><strong>Download</strong>: click the small <strong>down arrow</strong> at the
                right end of the line under a binder (beside its card count).</li>
              <li><strong>Upload</strong>: click the <strong>+</strong> binder,
                then <strong>Upload .CSV</strong> at the bottom left of the New binder window, and
                pick a file. It's added to the end of your shelf as a new binder, with every card
                in the pocket it was saved in. If the file has more cards than the binder's pages
                hold, pages are added until they all fit. If you already have a binder with that name, the
                new one is called "Name (1)", then "Name (2)", and so on. (Names can be up to 12
                characters, so a long name is shortened to make room for the number, like
                "Planeswa (1)". You can rename it in Binder properties.)</li>
            </ul>
            <p>
              <strong>From ManaBox</strong>: export a collection or binder as a .CSV in ManaBox,
              then upload it here. Its cards fill the pockets in the order they're listed (10
              pages to start, with more added if it needs them), and the binder is named after
              the file. Details WUBRG'r doesn't show (like condition or
              purchase price) are kept, so they're still there when you download it again.
              Older WUBRG'r <strong>.JSON</strong> binder files can be uploaded too.
            </p>
            <p>
              Binders saved before were .JSON files. The first time you open My Binders, each
              one is turned into a .CSV file. A backup copy of the old .JSON file is kept in the
              same Google Drive folder.
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-search',
        title: 'Searching your binders',
        body: (
          <>
            <p>
              The <strong>Search your binders</strong> bar sits at the top of My Binders and
              above every binder's pages. It only looks at the cards in your binders. Start
              typing a card's name: part of it is enough, and small typos are fine
              ("demnic" still finds Demonic Tutor).
            </p>
            <ul>
              <li>A list shows every match, with the binder and page it's in (and "×3" if a
                pocket holds several copies).</li>
              <li>Click one, or use the <strong>up and down arrow keys</strong> and press
                <strong> Enter</strong>. <strong>Enter</strong> (or the magnifying glass) on its own
                goes to the top match.</li>
              <li>The binder opens at that page, with the card's pocket <strong>outlined and
                glowing</strong>. The glow goes when you click or press a key in the binder.</li>
              <li>Inside a binder, tick <strong>Current binder</strong> to search just that
                binder. Unticked, it searches every binder.</li>
              <li><strong>Escape</strong> closes the list (press it again to empty the box).</li>
            </ul>
          </>
        ),
      },
      {
        id: 'my-binders-links',
        title: 'Getting around',
        body: (
          <>
            <p>
              The bar along the top and the links along the bottom stay in place while you
              scroll, so they're always there. The links take you anywhere on the site:
            </p>
            <ul>
              <li><strong>Home</strong>: the welcome page. When you're signed in (or using the
                site locally), it has no sign-in buttons, just a <strong>Go to your
                binders</strong> link.</li>
              <li><strong>Binders</strong>: your shelf of binders (My Binders). Only shown when
                you're signed in or using the site locally.</li>
              <li><strong>Search</strong>: the MTG Card Finder, to look up any card.</li>
              <li><strong>Help</strong>: these instructions, opened to the page you were on.</li>
            </ul>
            <p>
              On a phone, a few words are shortened so everything fits on one line:
              <strong> Sign in</strong> (Sign in with Google), and inside a
              binder, <strong>Previous</strong> and <strong>Next</strong> (Previous page, Next page).
            </p>
            <p>
              The round <strong>back arrow</strong> to the left of the title takes you back to
              the page you were on before. It's greyed out when there's no earlier page to go
              back to.
            </p>
            <p>
              Before you sign in, the <strong>sun and moon switch</strong> at the top right
              swaps between light and dark colors on every page. Once you're signed in (or
              using the site locally), a round <strong>gear</strong> button takes its place:
              it opens <strong>Settings</strong>, where you choose the theme and more
              (see <HelpLink to="settings">Settings</HelpLink>).
            </p>
            <p>
              Using a keyboard? Press <strong>?</strong> on any page to see a list of its
              keyboard shortcuts. On this Help page, <strong>Tab</strong> moves through the
              topics and links, and <strong>Enter</strong> opens one.
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-install',
        title: 'Installing the app',
        body: (
          <>
            <p>
              WUBRG'r can be installed like an app, with the open-binder icon on your home screen
              or desktop. It then opens in its own window, without the browser's address bar.
            </p>
            <ul>
              <li><strong>Computer</strong> (Chrome or Edge): click the <strong>install</strong> icon
                at the right end of the address bar (a screen with a down arrow), or open the
                browser's menu and choose <strong>Install WUBRG'r</strong>.</li>
              <li><strong>Android</strong> (Chrome): open the menu (the three dots) and
                choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
              <li><strong>iPhone or iPad</strong> (Safari): tap the <strong>Share</strong> button
                (a square with an arrow), then <strong>Add to Home Screen</strong>.</li>
            </ul>
            <p>
              The app keeps itself up to date: when you're online, it always opens the newest
              version. With no internet, it still opens, and your binders on this device work as
              usual (changes are saved to Google Drive when you're back online). Searching for
              cards needs the internet, and card pictures that haven't been seen before show
              the back of a Magic card.
            </p>
          </>
        ),
      },
      {
        id: 'my-binders-keyboard',
        title: 'Using the keyboard',
        body: (
          <>
            <p>
              Everything you can do to binders with the mouse also works with the keyboard.
              Press <strong>Tab</strong> to get onto the shelf (the first press reaches the search
              bar; press it again for the binders). A guide at the bottom of the page
              shows which keys work right now.
            </p>
            <ul>
              <li><strong>Arrow keys</strong>: move from binder to binder.
                The <strong>+</strong> (New binder) is the last stop.</li>
              <li><strong>Home / End</strong>: jump to the first binder, or to the <strong>+</strong>.</li>
              <li><strong>Enter</strong>: open the binder (on the <strong>+</strong>, make a new binder).</li>
              <li><strong>E</strong>: Binder properties (rename, pages, cover).</li>
              <li><strong>Delete</strong>: delete the binder (it asks first).</li>
              <li><strong>D</strong>: download the binder as a .CSV file.</li>
              <li><strong>N</strong>: make a new binder.</li>
            </ul>
            <p>To change the order of your binders:</p>
            <ol>
              <li>Press <strong>Space</strong> on a binder to pick it up. It fades.</li>
              <li>Use the <strong>arrow keys</strong> to choose its new spot. A dashed outline shows it.</li>
              <li>Press <strong>Space</strong> or <strong>Enter</strong> to put it there. The binders in
                between shift along to make room.</li>
            </ol>
            <p>Press <strong>Escape</strong> at any time to put it back where it was.</p>
            <p>Press <strong>?</strong> anywhere on My Binders to see these keys.</p>
          </>
        ),
      },
      {
        id: 'my-binders-account',
        title: 'Signing in and out',
        body: (
          <ul>
            <li>The link at the bottom right of every page says <strong>Sign out</strong> when
              you're signed in. Signing out saves any changes to Google Drive first, then
              removes your binders from this browser, so the next person on this computer
              can't see them. They're still safe in your Google Drive.</li>
            <li>When using the site locally, that link says <strong>Sign in with Google</strong> instead
              (<strong>Sign in</strong> on a phone). Signing in copies the binders on
              this device to your Google Drive.</li>
          </ul>
        ),
      },
    ],
  },

  /* ===================== BINDER PAGES ===================== */
  {
    id: 'binder',
    title: 'Binder pages',
    lead: (
      <>
        Opening a binder shows its pages, like a real binder lying open: two pages
        side by side on a computer or tablet, one page at a time on a phone. Each
        page has 16 pockets, four across and four down. The binder's name is in the
        top bar (under WUBRG'r on a narrow screen), with where it's saved.
      </>
    ),
    sections: [
      {
        id: 'binder-pages',
        title: 'Turning pages',
        body: (
          <ul>
            <li>Click <strong>Previous page</strong> or <strong>Next page</strong> under the binder
              (<strong>Previous</strong> / <strong>Next</strong> on a phone). The page number
              between them shows where you are.</li>
            <li>On a phone, swipe <strong>left</strong> to go to the next page
              and <strong>right</strong> to go back.</li>
          </ul>
        ),
      },
      {
        id: 'binder-finding',
        title: 'Finding a card',
        body: (
          <>
            <p>
              The <strong>Search your binders</strong> bar above the pages finds any card you
              own. Type part of its name and pick it from the list. The right binder opens at the
              right page, with the card's pocket <strong>outlined and glowing</strong>.
            </p>
            <p>
              It searches all your binders. Tick <strong>Current binder</strong> to search
              just this one. (More in <HelpLink to="my-binders-search">Searching your binders</HelpLink>.)
            </p>
          </>
        ),
      },
      {
        id: 'binder-adding',
        title: 'Adding cards',
        body: (
          <>
            <ol>
              <li>Click the white <strong>+</strong> in an empty pocket. This opens the MTG Card Finder.</li>
              <li>Search for the card and pick the exact set, version and language you own
                (see <HelpLink to="finder-search">MTG Card Finder</HelpLink>).</li>
              <li>Click the round <strong>+</strong> button beside the card. It goes into the pocket
                you clicked, and you're taken back to that page of your binder.</li>
            </ol>
            <p>
              <strong>Or drag one in from Scryfall or EDHREC.</strong> With scryfall.com or
              edhrec.com open in another browser window beside the binder, drag a card's
              picture (or its link) onto an <strong>empty pocket</strong>. The pocket gets a
              dashed outline while you're over it; let go, and that exact card (printing,
              language and side) is added. Pockets that already hold a card don't accept drops.
            </p>
            <p>
              To <strong>look at a card</strong> already in the binder, click it: it opens in the
              MTG Card Finder. Picking a different printing there and pressing <strong>+</strong> replaces
              the card in that pocket.
            </p>
            <p>
              Cards added with <strong>Foil</strong> turned on have a <strong>rainbow border</strong>,
              so you can tell your foils apart at a glance. Clicking a foil card opens it in the
              MTG Card Finder with Foil already on.
            </p>
          </>
        ),
      },
      {
        id: 'binder-copies',
        title: 'How many copies',
        body: (
          <>
            <p>
              Along the bottom of each card is a small <strong>− 1 +</strong> bar showing how
              many copies of that card you own.
            </p>
            <ul>
              <li><strong>+</strong> adds a copy (up to 99).</li>
              <li><strong>−</strong> takes a copy away. If it's the last copy, you're
                asked <strong>Remove card?</strong> first. <strong>Yes, remove</strong> takes the card
                out of the pocket; <strong>No</strong> keeps it.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'binder-dragging',
        title: 'Moving cards around',
        body: (
          <>
            <ul>
              <li><strong>With a mouse</strong>: press on a card and drag it. A plain click
                (without moving) still opens the card in the MTG Card Finder.</li>
              <li><strong>On a phone</strong>: press and hold a card for a moment until it
                lifts (most phones give a small buzz or tick when it does), then slide it. A
                quick tap still opens the card, and a quick swipe still turns the page.</li>
            </ul>
            <p>Then:</p>
            <ul>
              <li>Drop it on an <strong>empty pocket</strong> to move it there.</li>
              <li>Drop it on a pocket that <strong>has a card</strong>, and the two cards swap places.</li>
              <li>Hold it at the <strong>left or right edge</strong> of the binder, and the page turns,
                so you can move it to another page.</li>
              <li>Press <strong>Escape</strong>, or let go anywhere outside the pockets, to put it back.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'binder-removing',
        title: 'Removing cards',
        body: (
          <>
            <p>There are two ways to take a card out of a binder:</p>
            <ul>
              <li>Press <strong>−</strong> on its copies bar until the last copy, then
                answer <strong>Yes, remove</strong>.</li>
              <li>Drag the card onto the <strong>red X circle</strong> that appears on the binder
                while dragging. This removes the card and all its copies straight away.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'binder-moving',
        title: 'Moving to another binder',
        body: (
          <ol>
            <li>Drag the card onto the <strong>blue circle</strong> (a folder with an arrow) that
              appears on the binder while dragging. The <strong>Move card to…</strong> window opens.</li>
            <li>If you own more than one copy, set <strong>How many to move</strong>. The rest
              stay in this binder.</li>
            <li>Click one of your other binders. The card goes into its first empty pocket,
              or, if that binder already has the same printing (and both are foil, or both
              aren't), it's added to that card's copies. Full binders are greyed out.</li>
            <li>Or, to start a new binder with the card in it, type a name
              under <strong>Or move it to a new binder</strong> and
              click <strong>New binder &amp; move</strong>.</li>
          </ol>
        ),
      },
      {
        id: 'binder-saving',
        title: 'Saving and backups',
        body: (
          <>
            <p>
              Every change saves by itself. The message beside the binder's name in the top
              bar tells you where it's saved: <strong>Saved to Drive</strong> when signed in,
              or <strong>Saved on this device</strong> when using the site locally. If your
              Google sign-in has run out, a <strong>Connect Drive</strong> button appears:
              click it to sign in again and finish saving.
            </p>
            <p>
              No internet? You can keep working: the message says your changes are kept on
              this device, and they're saved to Google Drive as soon as you're back online.
              Card pictures that can't be downloaded show the back of a Magic card instead.
            </p>
            <p>
              To keep your own copy of a binder as a file, use the download button under it
              on My Binders, as a .CSV file (see <HelpLink to="my-binders-backup">Binder files</HelpLink>).
            </p>
          </>
        ),
      },
      {
        id: 'binder-keyboard',
        title: 'Using the keyboard',
        body: (
          <>
            <p>
              Everything you can do to cards with the mouse also works with the keyboard.
              Press <strong>Tab</strong> to get into the binder (the first press reaches the
              search bar and its tick box; keep going to reach the pockets). A guide at the top of the page
              shows which keys work right now.
            </p>
            <ul>
              <li><strong>Arrow keys</strong>: move from pocket to pocket. Going past the left
                or right edge turns the page.</li>
              <li><strong>Page Up / Page Down</strong>: turn the page back or forward.</li>
              <li><strong>Enter</strong>: open the card in the MTG Card Finder (on an empty
                pocket, pick a card to add), the same as clicking.</li>
              <li><strong>+ / −</strong>: one more or one fewer copy. On the last
                copy, <strong>−</strong> asks before removing the card.</li>
              <li><strong>Delete</strong>: remove the card (it asks first).</li>
              <li><strong>M</strong>: move the card to another binder.</li>
            </ul>
            <p>To move a card to another pocket:</p>
            <ol>
              <li>Press <strong>Space</strong> on the card to pick it up. Its pocket fades.</li>
              <li>Use the <strong>arrow keys</strong> to choose where it goes. A dashed outline
                shows the spot, and the page turns at the left and right edges.</li>
              <li>Press <strong>Space</strong> or <strong>Enter</strong> to drop it. If that pocket
                has a card, the two swap places.</li>
            </ol>
            <p>Press <strong>Escape</strong> at any time to put the card back where it was.</p>
            <p>If you use a screen reader, each step is read out as you go.</p>
            <p>Press <strong>?</strong> anywhere on a binder page to see these keys.</p>
          </>
        ),
      },
    ],
  },

  /* ===================== MTG CARD FINDER ===================== */
  {
    id: 'finder',
    title: 'MTG Card Finder',
    lead: (
      <>
        The MTG Card Finder looks up any Magic card (using Scryfall's card list), shows
        its picture and details, and adds it to your binders. You can use it without
        signing in; adding to a binder needs you to be signed in or using the site locally.
      </>
    ),
    sections: [
      {
        id: 'finder-search',
        title: 'Searching for a card',
        body: (
          <>
            <ol>
              <li>Start typing a card's name in the search box at the top.</li>
              <li>A list of matching names drops down. Click one, or use
                the <strong>up and down arrow keys</strong> and press <strong>Enter</strong>.</li>
              <li>The card's picture appears, with its name, set and artist under it.</li>
            </ol>
            <p>
              To start again, click the <strong>×</strong> at the right end of the search box. It
              empties the box, ready for a new name.
            </p>
            <p>
              Looking for a card you already own? Use <strong>Search your binders</strong> on
              My Binders instead (see <HelpLink to="my-binders-search">Searching your binders</HelpLink>).
            </p>
            <p>
              Cards with two sides have a <strong>Flip card ↻</strong> button under the picture
              to see the other side.
            </p>
          </>
        ),
      },
      {
        id: 'finder-printing',
        title: 'Set, version and language',
        body: (
          <>
            <p>Most cards were printed many times. Use the boxes to pick the exact one you own:</p>
            <ul>
              <li><strong>Set</strong>: every set the card was printed in, with each set's symbol.</li>
              <li><strong>Version</strong>: the different printings within that set (for example
                borderless or full-art versions).</li>
              <li><strong>Language</strong> (above the card): the languages that printing was made in.</li>
            </ul>
            <p>The picture changes to match what you pick, and that's the printing that gets added to your binder.</p>
            <p>
              Have the <strong>foil</strong> version? Press the <strong>Foil</strong> button under
              the card so it turns orange before adding the card to a binder. The button can only
              be pressed when that printing comes in foil (or etched foil). If it only comes in
              foil, the button is already on. Foil cards get a rainbow border in your binder.
            </p>
          </>
        ),
      },
      {
        id: 'finder-prices',
        title: 'Prices',
        body: (
          <>
            <p>
              The <strong>Prices</strong> box shows what the printing on show costs at three
              stores: <strong>TCGplayer</strong>, <strong>Card Kingdom</strong> and
              <strong> Cardmarket</strong> (in euros). Each has a regular and a foil price; the
              one that matches the <strong>Foil</strong> button is highlighted.
            </p>
            <p>
              Click a store's icon (or name) to see the card there. On a wide screen the box
              is beside the card, on the left, with just the stores' icons; on a narrow screen
              it's under <strong>Notes and Rules</strong>, with the stores' names too.
            </p>
            <p>
              Prices change often (TCGplayer and Cardmarket's come from Scryfall, updated about
              once a day), so check the store before buying.
            </p>
          </>
        ),
      },
      {
        id: 'finder-add',
        title: 'Adding to a binder',
        body: (
          <>
            <p>The round <strong>+</strong> button beside the card adds it to a binder:</p>
            <ul>
              <li><strong>Came from a binder's pocket?</strong> The card goes straight into that pocket.</li>
              <li><strong>Opened the finder on its own?</strong> A menu asks <strong>Add to which
                binder?</strong> with each binder's card count. Pick one, and the card goes into
                its first empty pocket. Full binders can't be picked. <strong>New binder</strong> at
                the bottom makes a new binder with the card in it.</li>
            </ul>
            <p>Either way, you're taken to the binder, opened to the page with the new card.</p>
            <p>
              The <strong>+</strong> button only shows when you're signed in or using the site
              locally. When you came from a binder, the round <strong>back arrow</strong> at the
              top left (or the <strong>B</strong> key) takes you back to it.
              When you're not signed in, <strong>Home</strong> at the bottom goes back to the
              welcome page, where you can sign in.
            </p>
          </>
        ),
      },
      {
        id: 'finder-share',
        title: 'Sharing a card',
        body: (
          <p>
            The <strong>share button</strong> (three joined dots) beside the card makes a link to
            this exact printing and language (and foil, if Foil is on). On a phone it opens your
            share menu; on a computer the link is copied, ready to paste. Opening the link shows
            the same card.
          </p>
        ),
      },
      {
        id: 'finder-rules',
        title: 'Rules and legality',
        body: (
          <ul>
            <li><strong>Notes and Rules</strong>: official rulings about how the card works.</li>
            <li><strong>Format Legality</strong>: whether the card is allowed in each way of
              playing (Standard, Modern, Commander and more). To show only the formats you
              play, untick the others in <strong>Settings → Search → Format legality
              display</strong> (the gear at the top right).</li>
          </ul>
        ),
      },
      {
        id: 'finder-keyboard',
        title: 'Using the keyboard',
        body: (
          <>
            <p>
              The search box, its list of names, the Set list and the "Add to which binder?"
              menu all work with the arrow keys, <strong>Enter</strong> and <strong>Escape</strong>.
              There are also shortcut keys that work anywhere on the page, except while you're
              typing in a box:
            </p>
            <ul>
              <li><strong>/</strong>: jump to the search box, ready to type a new name.</li>
              <li><strong>Escape</strong> (in the search box): leave it, so the shortcut keys work.</li>
              <li><strong>[ / ]</strong>: previous / next version in this set.</li>
              {/* The curly brackets are written as text in quotes, because in
                  this kind of file a bare { starts a piece of code */}
              <li><strong>{'{ / }'}</strong> (Shift + [ / ]): previous / next set.</li>
              <li><strong>F</strong>: flip a two-sided card.</li>
              <li><strong>A</strong>: add to binder (when signed in or using the site locally).</li>
              <li><strong>S</strong>: share a link to this card.</li>
              <li><strong>B</strong>: back to the binder you came from.</li>
              <li><strong>?</strong>: show a list of these keys.</li>
            </ul>
            <p>
              On a computer, the line under the search box reminds you:
              "<strong>/</strong> search · <strong>?</strong> shortcuts". Click it to see the list.
            </p>
          </>
        ),
      },
    ],
  },

  /* ===================== SETTINGS ===================== */
  {
    id: 'settings',
    title: 'Settings',
    lead: (
      <>
        Settings is where you choose how the site looks and works for you. Your choices
        are saved, so they're the same every time you come back.
      </>
    ),
    sections: [
      {
        id: 'settings-open',
        title: 'Opening Settings',
        body: (
          <>
            <p>
              Once you're signed in (or using the site locally), a round <strong>gear</strong> button
              sits at the top right of every page, where the sun and moon switch was. Click it to
              open Settings. It turns orange while you're on the Settings page.
            </p>
            <p>
              Before you sign in, there's no Settings page: the sun and moon switch at the top
              right swaps between light and dark instead.
            </p>
            <p>
              Settings are in sections, like <strong>Appearance</strong> and
              <strong> Search</strong>. Each change saves as soon as you make it: there's no Save
              button. The line under the Settings heading says where it was saved.
            </p>
          </>
        ),
      },
      {
        id: 'settings-theme',
        title: 'Theme (light and dark)',
        body: (
          <>
            <p>Under <strong>Appearance</strong>, <strong>Theme</strong> has three choices:</p>
            <ul>
              <li><strong>Dark</strong>: light text on a dark background, easier on the eyes at night.</li>
              <li><strong>System</strong>: match your computer's or phone's own light/dark setting.
                If your device switches by itself (some turn dark in the evening), the site
                switches with it.</li>
              <li><strong>Light</strong>: dark text on a light background.</li>
            </ul>
            <p>
              Click a choice, or use <strong>Tab</strong> to reach them and the
              <strong> arrow keys</strong> to move between them.
            </p>
          </>
        ),
      },
      {
        id: 'settings-formats',
        title: 'Format legality display',
        body: (
          <>
            <p>
              Under <strong>Search</strong>, <strong>Format legality display</strong> has a
              checkbox for every format (Standard, Modern, Commander and more). Untick the ones you
              don't play, and they're left out of a card's <strong>Format Legality</strong> box
              in the MTG Card Finder (see <HelpLink to="finder-rules">Rules and legality</HelpLink>).
            </p>
            <ul>
              <li><strong>Show all</strong> ticks every format again.</li>
              <li><strong>Hide all</strong> unticks them all (the Format Legality box then doesn't
                show at all).</li>
            </ul>
            <p>A new format added to Magic later shows up ticked, so you won't miss it.</p>
          </>
        ),
      },
      {
        id: 'settings-saving',
        title: 'Where settings are saved',
        body: (
          <>
            <ul>
              <li><strong>Signed in with Google</strong>: in your Google Drive, in a file called
                "WUBRGr settings.json" in the "MTG Card Binder" folder (next to your binders). So
                they follow you: sign in on another computer or phone and your settings are
                there too.</li>
              <li><strong>Using the site locally</strong>: on this device only.</li>
            </ul>
            <p>
              If your Google sign-in has run out, a change is kept on this device for now, and
              saved to Google Drive the next time you sign in.
            </p>
          </>
        ),
      },
    ],
  },
];
