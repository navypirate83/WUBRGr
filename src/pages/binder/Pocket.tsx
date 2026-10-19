/* =====================================================================
   ONE POCKET IN A BINDER PAGE
   - Holding a card: its picture, which links to that card in the MTG
     Card Finder, with the "− 3 +" copies bar along the bottom. A foil
     card gets a rainbow border.
   - Empty: a white "+" that links to the MTG Card Finder to pick a card.
   Either way, the link carries this binder, page and pocket along, so
   "+" over there puts the card in this exact pocket.
   "memo" means React only redraws a pocket when something about it
   changes (a binder can have 2,400 of them).
   ===================================================================== */

import { memo } from 'react';
import { Link } from 'react-router';
import { useDraggable } from '@dnd-kit/core';
import { CARD_BACK } from '../../lib/cards';
import { MAX_COPIES, cardCount, pocketKey, type BinderCard } from '../../lib/binderStorage';
import styles from './BinderPage.module.css';

type Props = {
  binderId: string;
  page: number;
  slot: number;
  card: BinderCard | undefined;
  // Is this the pocket the Tab key reaches (the keyboard's pocket)?
  tabStop: boolean;
  // Should its picture download yet (its page is near the one showing)?
  loaded: boolean;
  // Faded (its card is being moved), outlined (a card would drop here),
  // or waiting for a dropped card picture to be looked up
  faded: boolean;
  outlined: boolean;
  loading: boolean;
  // Found with the search bar: a glowing outline shows where it is
  highlighted?: boolean;
  // Keep track of the pocket's link (so the keyboard can be moved onto it)
  registerLink: (key: string, element: HTMLAnchorElement | null) => void;
  // The "−" / "+" buttons: one fewer (-1) or one more (+1) copy
  onCopies: (key: string, step: number) => void;
};

// The link to the MTG Card Finder for one pocket. If the pocket holds a
// card, it also says which card to open (the same set / number / face /
// language / foil format as a shared link).
function searchLinkFor(binderId: string, page: number, slot: number, card?: BinderCard): string {
  const params = new URLSearchParams();
  if (card) {
    params.set('set', card.set);
    params.set('number', card.number);
    if (card.face === 1) params.set('face', 'back');
    if (card.lang) params.set('lang', card.lang);   // e.g. "ja" for Japanese
    if (card.foil) params.set('foil', '1');         // opens with Foil already on
  }
  params.set('binder', binderId);
  params.set('binderPage', String(page));
  params.set('binderSlot', String(slot));
  return `/search?${params}`;
}

function Pocket(props: Props) {
  const { binderId, page, slot, card, tabStop, loaded, faded, outlined, loading, highlighted, registerLink, onCopies } = props;
  const key = pocketKey(page, slot);
  // A card can be picked up and dragged (dnd-kit); an empty pocket can't.
  const draggable = useDraggable({ id: key, disabled: !card });
  const count = cardCount(card);

  // The pocket's classes: a foil card's rainbow border, and the
  // dragging / dropping looks
  const classes = [
    styles.pocket,
    card?.foil ? styles.foil : '',
    faded || draggable.isDragging ? styles.dragSource : '',
    outlined ? styles.dropTarget : '',
    loading ? styles.dropLoading : '',
    highlighted ? styles.found : '',
  ].join(' ');

  return (
    <div className={classes} data-key={key}>
      {card ? (
        <Link
          ref={(element) => registerLink(key, element)}
          to={searchLinkFor(binderId, page, slot, card)}
          className={styles.pocketCard}
          tabIndex={tabStop ? 0 : -1}
          draggable={false}
          aria-label={`${card.name}${card.foil ? ', foil' : ''}${count > 1 ? `, ${count} copies` : ''}, page ${page}, pocket ${slot}. Open in card search`}
          // dnd-kit's "listeners" start a drag on mouse down / touch start
          {...draggable.listeners}
        >
          {/* The picture only downloads once its page is near the one
              showing. If it won't download, the back of a Magic card shows. */}
          <span ref={draggable.setNodeRef} className={styles.cardHolder}>
            {loaded && (
              <img
                src={card.image}
                alt=""
                draggable={false}
                onError={(event) => {
                  if (event.currentTarget.src !== CARD_BACK) event.currentTarget.src = CARD_BACK;
                }}
              />
            )}
          </span>
        </Link>
      ) : (
        <Link
          ref={(element) => registerLink(key, element)}
          to={searchLinkFor(binderId, page, slot)}
          className={styles.pocketAdd}
          tabIndex={tabStop ? 0 : -1}
          draggable={false}
          aria-label={`Empty, page ${page}, pocket ${slot}. Add a card`}
        >
          +
        </Link>
      )}

      {/* The "− 3 +" bar along the bottom of a card: how many copies you
          own. It sits beside the card's link, not inside it, so tapping a
          button doesn't open the card search. tabIndex -1: keyboard users
          press + and − on the card instead. */}
      {card && (
        <div className={styles.copiesBar}>
          <button
            type="button"
            tabIndex={-1}
            aria-label={count > 1 ? `One fewer ${card.name}` : `Remove ${card.name}`}
            onClick={() => onCopies(key, -1)}
          >
            −
          </button>
          <span className={styles.copiesCount} aria-label={`${count} owned`}>{count}</span>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`One more ${card.name}`}
            disabled={count >= MAX_COPIES}
            onClick={() => onCopies(key, 1)}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(Pocket);
