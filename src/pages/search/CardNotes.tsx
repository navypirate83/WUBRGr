/* =====================================================================
   NOTES AND RULES, AND FORMAT LEGALITY
   The two boxes under the pickers:
   - Notes and Rules: the official rulings about how the card works,
     downloaded from Scryfall (the same for every printing of a card).
   - Format Legality: whether the card is allowed in each way of playing.
   ===================================================================== */

import { useQuery } from '@tanstack/react-query';
import { loadRulings, type ScryfallCard } from '../../lib/scryfall';
import { formatDate, legalityRows, rulingSource } from '../../lib/cards';
import { useSettings } from '../../hooks/useSettings';
import styles from './SearchPage.module.css';

// The Notes and Rules box. "card" is the card that was looked up; its
// rulings are downloaded once and remembered (TanStack Query).
export function Rulings({ card }: { card: ScryfallCard }) {
  const rulings = useQuery({
    queryKey: ['rulings', card.rulings_uri],
    queryFn: () => loadRulings(card.rulings_uri),
  });

  // One line of text in the box: still loading, no rulings, or a problem
  let message: string | null = null;
  if (rulings.isPending) message = 'Loading rulings…';
  else if (rulings.isError) message = 'Rulings could not be loaded right now.';
  else if (rulings.data.length === 0) message = 'There are no rulings for this card.';

  return (
    <section className={styles.notesBox} aria-labelledby="rulingsTitle">
      <h2 id="rulingsTitle" className={styles.notesTitle}>Notes and Rules</h2>
      {message !== null ? (
        <p className={styles.notesMessage}>{message}</p>
      ) : (
        // Each ruling: the date and who published it, then the ruling.
        // (The index is part of the key because two rulings can share a date.)
        <ul className={styles.rulingsList}>
          {rulings.data!.map((ruling, i) => (
            <li key={`${ruling.published_at}-${i}`}>
              <span className={styles.rulingDate}>
                {formatDate(ruling.published_at)} · {rulingSource(ruling.source)}
              </span>
              {ruling.comment}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The Format Legality box for a printing: one line per format, with the
// format's name and a colored status label. Formats unticked on the
// Settings page are left out (useSettings redraws the box if that
// changes). Nothing at all if there are no formats left to show.
export function Legality({ print }: { print: ScryfallCard }) {
  const { hiddenFormats } = useSettings();
  const rows = legalityRows(print, hiddenFormats);
  if (rows.length === 0) return null;
  return (
    <section className={`${styles.notesBox} ${styles.legality}`} aria-labelledby="legalityTitle">
      <h2 id="legalityTitle" className={styles.notesTitle}>Format Legality</h2>
      <ul className={styles.legalityList}>
        {rows.map((row) => (
          <li key={row.code}>
            <span>{row.name}</span>
            {/* The status picks the label's color (see SearchPage.module.css) */}
            <span className={`${styles.legalityStatus} ${styles[row.status]}`}>{row.word}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
