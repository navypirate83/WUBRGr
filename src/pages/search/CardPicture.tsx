/* =====================================================================
   CARD PICTURE
   The big picture of the card, in a frame the shape of a real card. A
   spinning ring shows on top while a new picture downloads (or while a
   card is being looked up). If a picture won't download, the back of a
   Magic card shows instead.
   ===================================================================== */

import { useState } from 'react';
import { CARD_BACK, CARD_BACK_ALT } from '../../lib/cards';
import styles from './SearchPage.module.css';

type Props = {
  // The picture to show, or null for the card back
  src: string | null;
  alt: string;
  // A card is being looked up: show the spinner even if the picture is ready
  busy: boolean;
};

export default function CardPicture({ src, alt, busy }: Props) {
  // The last picture that finished downloading, and the last one that
  // failed (that one is swapped for the card back)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // What to actually show: the picture, or the card back if there's no
  // picture or it failed
  const showBack = !src || src === failedSrc;
  const shown = showBack ? CARD_BACK : src;
  // Still downloading (or looking up a card): show the spinner
  const loading = busy || shown !== loadedSrc;

  return (
    <div className={`${styles.cardFrame} ${loading ? styles.loading : ''}`}>
      <img
        src={shown}
        alt={showBack ? CARD_BACK_ALT : alt}
        // Finished downloading: hide the spinner
        onLoad={() => setLoadedSrc(shown)}
        // Couldn't download: show the card back instead. (If the card back
        // itself fails, just stop the spinner, so it doesn't loop forever.)
        onError={() => {
          if (shown !== CARD_BACK) setFailedSrc(shown);
          else setLoadedSrc(shown);
        }}
      />
    </div>
  );
}
