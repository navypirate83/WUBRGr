/* =====================================================================
   SPEAKING TO SCREEN READERS
   A hook that gives a page a hidden message area which screen readers
   read out (aria-live="polite" means "read it when you get a moment"),
   and an "announce" function to put a message in it. Used to say what a
   shortcut key just did, like "Set 2 of 6: Innistrad".
   ===================================================================== */

import { useCallback, useRef, useState } from 'react';

export function useAnnouncer() {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  // Say something. The area is emptied first and the message put in a
  // moment later, so a screen reader reads it even if it's the same as
  // the last message.
  const announce = useCallback((text: string) => {
    setMessage('');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(text), 50);
  }, []);

  // The hidden message area, to put anywhere on the page
  const announcer = <p className="visually-hidden" aria-live="polite">{message}</p>;

  return { announce, announcer };
}
