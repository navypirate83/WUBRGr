/* =====================================================================
   POP-UP WINDOW
   A <dialog>: a pop-up window built into the browser. It sits on top of
   the page and dims everything behind it. The page draws this only while
   the window should be open; it opens as soon as it's drawn.
   Inside goes a <form method="dialog">: its buttons close the window,
   and the clicked button's "value" (like "create" or "cancel") is handed
   to onClose, so the page knows which one closed it. Escape, or a click
   on the dimmed area outside, closes it as "cancel".
   ===================================================================== */

import { useEffect, useRef, type KeyboardEvent, type FormEvent, type ReactNode } from 'react';
import styles from './binders/BinderWindows.module.css';

type Props = {
  // The id of the window's title, which screen readers announce
  labelledBy: string;
  // Called once the window has closed, with the closing button's value
  onClose: (returnValue: string) => void;
  // Called once the window has opened (e.g. to select the name box's text)
  onOpened?: () => void;
  children: ReactNode;
};

export default function Modal({ labelledBy, onClose, onOpened, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Has the page been told the window closed? (So it's only told once.)
  const told = useRef(false);

  // Close the window and tell the page which button (or "cancel") did it.
  // This doesn't wait for the browser's own "close" event, because some
  // browsers (like the one built into VS Code) never send it.
  function closeWith(value: string) {
    if (told.current) return;
    told.current = true;
    dialogRef.current?.close(value);
    onClose(value);
  }

  // Keep the newest closeWith in a "ref" (a box that survives redraws),
  // so the listeners below always call the latest one (which knows the
  // latest name typed, symbol picked and so on).
  const closeRef = useRef(closeWith);
  closeRef.current = closeWith;

  // Open the window as soon as it's drawn. showModal() centers it, dims
  // the page behind it, and keeps the Tab key inside the window.
  // Also listen for the browser's own "cancel" (Escape) and "close"
  // events, in case the window closes some other way.
  useEffect(() => {
    const dialog = dialogRef.current!;
    function handleCancel(event: Event) {
      event.preventDefault();
      closeRef.current('cancel');
    }
    function handleClose() {
      closeRef.current(dialog.returnValue || 'cancel');
    }
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    if (!dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
      onOpened?.();
    }
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
    // Only when it's first drawn: [] means "run once".
  }, []);

  // A button in the form was pressed (the browser has already checked
  // the boxes, like a name that's "required"): close with its value.
  // "submitter" is the button that sent the form.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    closeWith(button?.value ?? '');
  }

  // Escape closes the window as "cancel".
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWith('cancel');
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      // A click on the dimmed area counts as a click on the <dialog> itself
      onClick={(event) => { if (event.target === event.currentTarget) closeWith('cancel'); }}
    >
      {children}
    </dialog>
  );
}
