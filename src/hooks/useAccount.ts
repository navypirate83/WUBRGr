/* =====================================================================
   WHO'S USING THE SITE?
   A hook that tells a page whether someone is signed in to Google,
   using the site locally, or using the binders at all, and draws the
   page again whenever that changes (signing in or out, "Skip login", or
   the list of binders changing: see lib/accountEvents.ts).
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { accountVersion, onAccountChange } from '../lib/accountEvents';
import { isSignedIn, isUsingBinders } from '../lib/googleDrive';
import { isLocalMode } from '../lib/binderStorage';

export function useAccount() {
  // "useSyncExternalStore" is React's way to follow something kept
  // outside React: it calls onAccountChange to listen, and redraws when
  // accountVersion() comes back different.
  useSyncExternalStore(onAccountChange, accountVersion);
  return {
    signedIn: isSignedIn(),
    localMode: isLocalMode(),
    usingBinders: isUsingBinders(),
  };
}
