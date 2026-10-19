/* =====================================================================
   THE APP: WHICH PAGE GOES WITH WHICH ADDRESS
   Every page shares the same frame (the top bar and the footer, in
   Layout). The part in the middle changes with the address.
   An address that doesn't match any page shows a "page not found" note.
   ===================================================================== */

import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import HelpPage from './pages/HelpPage';
import SearchPage from './pages/search/SearchPage';
import HomePage from './pages/home/HomePage';
import BindersPage from './pages/binders/BindersPage';
import BinderPage from './pages/binder/BinderPage';
import SettingsPage from './pages/settings/SettingsPage';
import ListsPage from './pages/lists/ListsPage';
import DecklistsPage from './pages/decklists/DecklistsPage';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <Routes>
      {/* Every page below is drawn inside Layout's frame */}
      <Route element={<Layout />}>
        {/* Home: the welcome page (the address with nothing after /WUBRGr/) */}
        <Route index element={<HomePage />} />
        {/* Binders: the shelf of binders */}
        <Route path="binders" element={<BindersPage />} />
        {/* One binder's pages, like /binders/abc123 */}
        <Route path="binders/:binderId" element={<BinderPage />} />
        {/* Search: the MTG Card Finder */}
        <Route path="search" element={<SearchPage />} />
        {/* Help: the instructions */}
        <Route path="help" element={<HelpPage />} />
        {/* Settings (the gear button in the top bar, once signed in) */}
        <Route path="settings" element={<SettingsPage />} />
        {/* New parts of the site, still being built (nothing links to
            them yet: reach them by typing the address) */}
        <Route path="lists" element={<ListsPage />} />
        <Route path="decklists" element={<DecklistsPage />} />
        {/* Any other address: a page that doesn't exist */}
        <Route path="*" element={<ComingSoon title="Page not found" missing />} />
      </Route>
    </Routes>
  );
}
