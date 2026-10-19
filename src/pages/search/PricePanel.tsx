/* =====================================================================
   PRICES (on the Search page)
   A small table: "Regular" and "Foil" across the top, then one row per
   store (TCGplayer, Card Kingdom, Cardmarket), each with its icon (a
   link to this card at the store) and its two prices for the printing
   showing. The column that matches the Foil button is highlighted.
   It's drawn in two places, and the stylesheet shows one of them:
   - "side": a narrow box in the space to the LEFT of the card, with just
     the stores' icons (on pages wide enough for it)
   - "below": under Notes and Rules, with the stores' names too (on
     pages too narrow for the side box)
   (Where the prices come from: see lib/prices.ts.)
   ===================================================================== */

import { useQuery } from '@tanstack/react-query';
import type { ScryfallCard } from '../../lib/scryfall';
import {
  cardKingdomPrices, cardmarketPrices, formatPrice, loadCardKingdomPrices, tcgplayerPrices,
  type StorePrices,
} from '../../lib/prices';
import styles from './SearchPage.module.css';

type Props = {
  // The printing showing
  print: ScryfallCard;
  // Is the Foil button on?
  foil: boolean;
  // Which of the two places this is (see above)
  layout: 'side' | 'below';
};

// The stores' icons, in the "public/icons/stores" folder
const icon = (file: string) => `${import.meta.env.BASE_URL}icons/stores/${file}`;

export default function PricePanel({ print, foil, layout }: Props) {
  // Card Kingdom's price list: downloaded once (the first time a card is
  // shown) and kept for the whole visit. (Both boxes share the one copy.)
  const cardKingdom = useQuery({
    queryKey: ['card-kingdom-prices'],
    queryFn: loadCardKingdomPrices,
    gcTime: Infinity,
  });

  // Card Kingdom's row while its list is loading, or if it couldn't be
  // loaded: a message instead of prices
  const ckMessage = cardKingdom.isError ? 'Couldn\'t load'
    : cardKingdom.isPending ? 'Loading…' : null;
  const showNames = layout === 'below';

  // The highlighted column's class: the one matching the Foil button
  const shown = (isFoilColumn: boolean) => (isFoilColumn === foil ? styles.priceShown : undefined);

  // One store's row: its icon (and name, if shown), a link to the card at
  // the store that opens in a new tab, then its two prices. Without the
  // name showing, the link's aria-label and title (shown on hover) still
  // say which store it is. "message" replaces the prices while they load.
  function row(name: string, iconFile: string, currency: 'USD' | 'EUR', prices: StorePrices | null, message?: string | null) {
    const label = (
      <>
        <img className={styles.storeIcon} src={icon(iconFile)} alt="" />
        {showNames && name}
      </>
    );
    return (
      <tr>
        {/* The row's heading cell: the store */}
        <th scope="row">
          {prices ? (
            <a className={styles.storeName} href={prices.url} target="_blank" rel="noopener"
               aria-label={`${name}: see this card`} title={name}>
              {label}
            </a>
          ) : (
            <span className={styles.storeName} title={name} aria-label={name}>{label}</span>
          )}
        </th>
        {message || !prices ? (
          <td colSpan={2} className={styles.pricesNote}>{message}</td>
        ) : (
          <>
            <td className={shown(false)}>{formatPrice(prices.regular, currency)}</td>
            {/* "Etched" foil (a special foil finish) is noted on hover */}
            <td className={shown(true)} title={prices.etched ? 'Etched foil' : undefined}>
              {formatPrice(prices.foil, currency)}
            </td>
          </>
        )}
      </tr>
    );
  }

  return (
    <section
      className={`${styles.prices} ${layout === 'side' ? styles.pricesSide : styles.pricesBelow}`}
      aria-label="Prices"
    >
      <table className={styles.priceTable}>
        {/* The column headings: an empty corner, then Regular and Foil */}
        <thead>
          <tr>
            <td />
            <th scope="col" className={shown(false)}>Regular</th>
            <th scope="col" className={shown(true)}>Foil</th>
          </tr>
        </thead>
        <tbody>
          {row('TCGplayer', 'tcgplayer.png', 'USD', tcgplayerPrices(print))}
          {row('Card Kingdom', 'cardkingdom.png', 'USD',
            cardKingdom.data ? cardKingdomPrices(print, cardKingdom.data) : null, ckMessage)}
          {row('Cardmarket', 'cardmarket.png', 'EUR', cardmarketPrices(print))}
        </tbody>
      </table>
    </section>
  );
}
