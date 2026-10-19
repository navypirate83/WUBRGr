/* =====================================================================
   "PAGE NOT FOUND"
   Shown for an address that doesn't match any page of the site.
   (It used to also say "coming soon" for pages not yet rewritten; every
   page is rewritten now.)
   ===================================================================== */

import styles from './ComingSoon.module.css';

export default function ComingSoon({ title }: { title: string; missing?: boolean }) {
  return (
    <div className={styles.box}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>{`${title} – WUBRG'r`}</title>
      <h2>{title}</h2>
      <p>There's no page at this address. Use the links at the bottom to find your way.</p>
    </div>
  );
}
