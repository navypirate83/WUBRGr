/* =====================================================================
   THE FRAME AROUND EVERY PAGE
   The top bar (back button, title, and Settings button or light/dark
   switch) at the top, the page itself in the middle, and the footer's
   links at the bottom.
   ===================================================================== */

import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useAccount } from '../hooks/useAccount';
import { syncSettings } from '../lib/settings';
import TopBar from './TopBar';
import Footer from './Footer';

export default function Layout() {
  const { signedIn } = useAccount();

  // Signed in with Google (when the site opens, or just after signing
  // in): bring the settings up to date with the settings file in Google
  // Drive, so a theme chosen on another computer shows here too. If
  // Drive can't be reached, this device's settings just stay as they are.
  useEffect(() => {
    if (signedIn) syncSettings().catch(() => { /* keep this device's settings */ });
  }, [signedIn]);

  return (
    <>
      <TopBar />
      {/* <Outlet /> is where the page for the current address is drawn */}
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
