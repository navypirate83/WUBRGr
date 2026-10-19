/* =====================================================================
   A CLOSED BINDER (the picture of one on the shelf)
   A cover a little taller than wide, with a spine down the left side, a
   label window near the top with the binder's name, and its symbol (if
   it has one) in the middle. Or, for the "New binder" spot, a big "+".
   ===================================================================== */

import { useLayoutEffect, useRef } from 'react';
import { manaColor } from '../../lib/binderStorage';
import { coverLook } from '../../lib/covers';
import styles from './ClosedBinder.module.css';

type Props = {
  name?: string;
  // The cover symbol's code ("U"), or null for none
  colorCode?: string | null;
  // The cover color ("gold", or a custom "#3a7bd5"); black if left out
  cover?: string;
  // Show the big "+" (the New binder spot)
  plus?: boolean;
};

export default function ClosedBinder({ name, colorCode, cover, plus = false }: Props) {
  const look = coverLook(cover);
  const symbol = manaColor(colorCode);
  const labelRef = useRef<HTMLSpanElement>(null);

  // Make sure the name fits on one line of its label: if it's wider than
  // the label (only possible with extra-wide letters, like "WWW"), shrink
  // the text a step at a time until it fits (but never below 8px; past
  // that, the stylesheet ends it in "…"). Done again whenever the window
  // changes size, since the binders' size changes with it.
  // (useLayoutEffect runs after drawing but before the screen updates,
  // so the name never shows at the wrong size.)
  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    function fit() {
      label!.style.fontSize = '';   // start from the normal size
      let size = parseFloat(getComputedStyle(label!).fontSize);
      while (nameTooWide(label!) && size > 8) {
        size -= 0.5;
        label!.style.fontSize = `${size}px`;
      }
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [name]);

  return (
    // "data-cover" and "data-plus" let the shelf's stylesheet find the
    // cover and the "+" (to lift the cover, or outline it, under the mouse).
    <span
      className={`${styles.cover} ${look.className} ${look.light ? styles.light : ''}`}
      style={look.style}
      data-cover=""
    >
      {name && <span ref={labelRef} className={styles.label}>{name}</span>}
      {symbol && <img className={styles.symbol} src={symbol.symbol} alt="" draggable={false} />}
      {plus && <span className={styles.plus} data-plus="">+</span>}
    </span>
  );
}

// Is a label's name wider than the space inside the label? This measures
// exactly, to fractions of a pixel (the browser's simpler "scrollWidth"
// rounds to whole pixels, so a name half a pixel too wide looked like it
// fit, and got cut short with "…"). A "range" wraps the label's text, so
// we can ask how wide the text is.
function nameTooWide(label: HTMLElement): boolean {
  const range = document.createRange();
  range.selectNodeContents(label);
  const textWidth = range.getBoundingClientRect().width;
  const style = getComputedStyle(label);
  const space = label.getBoundingClientRect().width
    - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
  return textWidth > space;
}
