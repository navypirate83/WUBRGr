/* =====================================================================
   DECKLISTS
   The start of a new part of the site (at the address /decklists).
   Nothing links here yet: it's a page to build on as the site grows.
   ===================================================================== */

import styles from './DecklistsPage.module.css';

export default function DecklistsPage() {
  return (
    <div className={styles.page}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>Decklists – WUBRG'r</title>

      <h2 className={styles.pageTitle}>Decklists</h2>
      <p className={styles.intro}>This page is still being built.</p>

      {/* The page's sections go here as it's built */}
    </div>
  );
}
