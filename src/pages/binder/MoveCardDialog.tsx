/* =====================================================================
   THE "MOVE CARD TO…" WINDOW
   Opens when a card is dropped on the blue move circle (or with the M
   key). Pick one of your other binders and the card goes into that
   binder's first empty pocket (and leaves this one). Or type a name and
   click "New binder & move" to make a new binder with just this card.
   If the pocket has several copies, it also asks how many to move; the
   rest stay here. Copies moved into a binder that already has the same
   printing are added to that pocket's count.
   The other binder is fetched fresh from Google Drive first, so cards
   added to it on another computer aren't overwritten.
   ===================================================================== */

import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { NameField } from '../../components/binders/BinderChoices';
import {
  DEFAULT_COVER, DEFAULT_PAGES, NAME_LIMIT, pocketsPerPage,
  binderName, binderPages, cardCount, firstEmptyPocket, isLocalMode, loadBinder, loadBinderList,
  manaColor, nextBinderName, pocketKey, samePrinting, saveBinder, saveBinderList, withCount,
  type BinderCard,
} from '../../lib/binderStorage';
import { createBinderFile, isSignedIn, signInWithGoogle, syncBinder } from '../../lib/googleDrive';
import windows from '../../components/binders/BinderWindows.module.css';
import styles from './BinderPage.module.css';

type Props = {
  binderId: string;
  card: BinderCard;
  // The copies are safely in the other binder: "note" says where they
  // went, "amount" how many
  onMoved: (note: string, amount: number) => void;
  onCancel: () => void;
};

export default function MoveCardDialog({ binderId, card, onMoved, onCancel }: Props) {
  const owned = cardCount(card);
  // How many to move (as typed), the new binder's name, whether a move
  // is being saved, the message line, and a number that goes up to
  // redraw the list once fresher card counts arrive from Drive
  const [amountText, setAmountText] = useState(String(owned));
  const [newName, setNewName] = useState(nextBinderName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [, setCountsChanged] = useState(0);

  // The other binders, each with its card count (and whether it's full)
  const others = loadBinderList().filter((b) => b.id !== binderId).map((b) => {
    const count = Object.keys(loadBinder(b.id)).length;
    return { ...b, count, full: count >= binderPages(b.id) * pocketsPerPage() };
  });

  // The counts come from this browser's copies, which can be out of date
  // (a binder may have been filled on another computer). So once the
  // window is open, fetch each other binder from Drive in the background
  // and redraw the list with the real counts. (Not signed in: the list
  // stays as is; the move itself always fetches the target fresh anyway.)
  useEffect(() => {
    if (!isSignedIn()) return;
    let open = true;
    const ids = loadBinderList().filter((b) => b.id !== binderId).map((b) => b.id);
    Promise.all(ids.map((id) => syncBinder(id).catch(() => { /* keep the old count */ })))
      .then(() => { if (open) setCountsChanged((n) => n + 1); });
    return () => { open = false; };
  }, [binderId]);

  // How many copies to move: the number in the box, kept between 1 and
  // how many the pocket has (all of them if the box isn't shown).
  function amountToMove(): number {
    if (owned < 2) return owned;
    const typed = Math.round(Number(amountText));
    return Number.isFinite(typed) ? Math.min(Math.max(typed, 1), owned) : owned;
  }

  // Make sure we're signed in to Google before saving to another binder
  // (opens Google's sign-in window if the sign-in has run out). This runs
  // straight from a click, which browsers require for pop-up windows.
  async function ensureSignedIn() {
    if (!isLocalMode() && !isSignedIn()) await signInWithGoogle();
  }

  // Move the card (or some of its copies) into another binder. If that
  // binder already has the same printing, the copies are added to it;
  // otherwise they go into its first empty pocket.
  async function moveTo(targetId: string) {
    const amount = amountToMove();
    setBusy(true);
    setMessage({ text: 'Moving…' });
    try {
      await ensureSignedIn();
      // Get the other binder's latest cards from Drive (or send it any
      // changes this browser has for it first).
      const cards = await syncBinder(targetId);
      const sameKey = Object.keys(cards).find((k) => samePrinting(cards[k], card));
      let page: number;
      if (sameKey) {
        // Already there: add to that pocket's count.
        cards[sameKey] = withCount(cards[sameKey], cardCount(cards[sameKey]) + amount);
        page = Number(sameKey.split('-')[0]);
      } else {
        // Not there yet: use its first gap.
        const spot = firstEmptyPocket(cards, binderPages(targetId));
        if (!spot) {
          setBusy(false);
          setMessage({ text: `"${binderName(targetId)}" is full.`, error: true });
          return;
        }
        cards[pocketKey(spot.page, spot.slot)] = withCount(card, amount);
        page = spot.page;
      }
      saveBinder(cards, targetId);   // keep it in this browser (marked "needs saving")...
      await syncBinder(targetId);    // ...and save it to Drive
      onMoved(`✓ Moved ${amount > 1 ? `${amount} ` : ''}to ${binderName(targetId)}, page ${page}`, amount);
    } catch (err) {
      setBusy(false);
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  // Make a new binder (with the typed name, or the next free "Binder N")
  // holding just this card, in its first pocket. It goes at the end of
  // the shelf, with no symbol and the usual black cover.
  async function moveToNew() {
    const amount = amountToMove();
    const name = newName.trim().slice(0, NAME_LIMIT) || nextBinderName();
    setBusy(true);
    setMessage({ text: 'Making the new binder…' });
    try {
      await ensureSignedIn();
      const cards = { [pocketKey(1, 1)]: withCount(card, amount) };
      const list = loadBinderList();
      const file = await createBinderFile(name, cards, null, list.length);
      saveBinderList([...list, { id: file.id, name, color: null, cover: DEFAULT_COVER, pages: DEFAULT_PAGES }]);
      saveBinder(cards, file.id, { dirty: false });
      onMoved(`✓ Moved ${amount > 1 ? `${amount} ` : ''}to new binder ${name}`, amount);
    } catch (err) {
      setBusy(false);
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  return (
    <Modal labelledBy="moveCardTitle" onClose={onCancel}>
      <form method="dialog">
        <h2 id="moveCardTitle" className={windows.title}>Move card to…</h2>
        <p className={styles.dialogText}>
          Pick a binder for "{card.name}". It goes into that binder's first empty pocket.
        </p>

        {/* "How many to move": only when the pocket holds several copies.
            It starts at all of them; the rest stay in this binder. */}
        {owned > 1 && (
          <div className={styles.moveHowMany}>
            <label className={styles.fieldLabel} htmlFor="moveAmount">How many to move</label>
            <div className={styles.moveAmountRow}>
              <input
                id="moveAmount"
                className={styles.moveAmount}
                type="number"
                min={1}
                max={owned}
                step={1}
                inputMode="numeric"
                disabled={busy}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
              />
              <span className={styles.moveAmountNote}>of {owned}</span>
            </div>
          </div>
        )}

        {/* One button per other binder: its symbol, name and card count.
            Full binders (or while a move is saving) can't be picked. */}
        <div className={styles.moveTargets}>
          {others.length === 0 && <p className={styles.moveNone}>You don't have any other binders yet.</p>}
          {others.map((other) => {
            const symbol = manaColor(other.color);
            return (
              <button
                key={other.id}
                type="button"
                className={styles.moveTarget}
                disabled={other.full || busy}
                onClick={() => moveTo(other.id)}
              >
                {symbol ? <img className={styles.moveSymbol} src={symbol.symbol} alt="" /> : <span className={styles.moveSymbol} />}
                <span className={styles.moveName}>{other.name}</span>
                <span className={styles.moveCount}>{other.full ? 'Full' : `${other.count} card${other.count === 1 ? '' : 's'}`}</span>
              </button>
            );
          })}
        </div>

        {/* Or a new binder, with just this card in it */}
        <div className={styles.moveNew}>
          <div className={styles.moveNewRow}>
            <div className={styles.moveNameField}>
              <NameField id="moveNewName" label="Or move it to a new binder" required={false}
                         value={newName} onChange={setNewName} />
            </div>
            <button
              className={`${windows.button} ${windows.primary} ${styles.moveNewButton}`}
              type="button"
              disabled={busy}
              onClick={moveToNew}
            >
              New binder &amp; move
            </button>
          </div>
        </div>

        {/* "Moving…", or a problem like "That binder is full" (in red) */}
        <p className={`${styles.moveMessage} ${message.error ? styles.error : ''}`} role="status">{message.text}</p>

        <div className={styles.moveButtons}>
          <button value="cancel" className={windows.button} type="submit" disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
