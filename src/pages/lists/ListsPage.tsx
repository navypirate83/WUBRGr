/* =====================================================================
   LISTS
   The start of a new part of the site (at the address /lists). Nothing
   links here yet: it's a page to build on as the site grows.
   ===================================================================== */

import styles from './ListsPage.module.css';

export default function ListsPage() {
  return (
    <div className={styles.page}>
      {/* React puts this <title> in the page's <head>: the browser tab's name */}
      <title>Lists – WUBRG'r</title>

      <h2 className={styles.pageTitle}>Lists</h2>
      <p className={styles.intro}>This page is still being built.</p>

      {/* The page's sections go here as it's built */}
    </div>
  );
}
