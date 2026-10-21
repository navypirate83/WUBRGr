/* =====================================================================
   THE SHELF OF BINDERS
   A closed binder for each binder (a link that opens it), with its card
   count under it, then the "+" binder for
   making a new one. As many fit across as the window has room for.

   DRAGGING (with dnd-kit, a library that handles the mouse and touch):
   pick up a binder and
   - drop it on another binder's spot to move it there (the others shift
     along to make room)
   - drop it on the pencil circle at the top for Binder properties
   - drop it on the red X circle at the bottom to delete it (it asks)
   With a mouse: press and move. On a phone: press and HOLD a moment
   until it lifts, then slide. A plain click or tap still opens it.
   Escape puts it back.

   THE KEYBOARD (the same keys as the original site): Tab gets onto the
   shelf (only one spot at a time is a Tab stop), then the arrow keys move
   from binder to binder, Home / End go to the first / the "+", Enter
   opens, Space picks a binder up (arrows choose its spot, Space drops,
   Escape cancels), E edits, Delete deletes, N makes a new one.
   ===================================================================== */

import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import {
  DndContext, DragOverlay, MeasuringStrategy, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent,
} from '@dnd-kit/core';
import ClosedBinder from '../../components/binders/ClosedBinder';
import { cardCountText, manaColor, type Binder } from '../../lib/binderStorage';
import { coverColorName } from '../../lib/covers';
import { hapticTap } from '../../lib/haptics';
import styles from './BindersPage.module.css';

// How close (pixels from the center) a dragged binder must be to the
// edit or delete circle to count as "over" it (the circles are 64px across)
const DROP_ZONE_REACH = 52;

// The drop circles' ids (the binders' ids are their own Drive ids)
const EDIT_ZONE = 'edit-zone';
const DELETE_ZONE = 'delete-zone';
// The "+" New binder spot's id, for the keyboard
const ADD_STOP = 'add';

// What the page can ask the shelf to do (see BindersPage)
export type ShelfHandle = {
  // Put the keyboard back on the shelf, if a key (E, Delete or N) opened
  // the window that just closed
  returnFocus: () => void;
};

type Props = {
  binders: Binder[];
  counts: Record<string, number>;
  addDisabled: boolean;
  onMove: (id: string, targetId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  announce: (text: string) => void;
  ref?: Ref<ShelfHandle>;
};

// Which drop spot is under the pointer: the edit or delete circle (if
// it's within reach of its center), otherwise the binder under the
// pointer. (dnd-kit calls this while dragging.) The circles only appear
// once a drag starts, so they're measured here and now, from the page,
// rather than from dnd-kit's own measurements (taken before they showed).
const findDropSpot: CollisionDetection = (args) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  for (const id of [EDIT_ZONE, DELETE_ZONE]) {
    const box = document.querySelector(`[data-zone="${id}"]`)?.getBoundingClientRect();
    if (box && box.width > 0 &&
        Math.hypot(pointer.x - (box.left + box.width / 2), pointer.y - (box.top + box.height / 2)) <= DROP_ZONE_REACH) {
      return [{ id }];
    }
  }
  return pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.id !== EDIT_ZONE && c.id !== DELETE_ZONE),
  });
};

export default function Shelf(props: Props) {
  const { binders, counts, addDisabled, onMove, onEdit, onDelete, onNew, announce, ref } = props;

  /* ----- Dragging ----- */

  // The binder being dragged, and what it's over right now
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // When the last drag ended (the click right after a drag is ignored, so
  // dropping a binder doesn't also open it)
  const lastDragEnd = useRef(0);

  // How a drag starts: with a mouse, once it moves 6px (so a plain click
  // still opens the binder); with a finger, after holding still for
  // 350ms (moving more than 10px first counts as scrolling instead)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 10 } }),
  );

  // A binder was let go: do whatever it was dropped on.
  function handleDragEnd({ active, over }: DragEndEvent) {
    endDrag();
    const id = String(active.id);
    if (!over) return;
    if (over.id === DELETE_ZONE) onDelete(id);
    else if (over.id === EDIT_ZONE) onEdit(id);
    else if (over.id !== id) onMove(id, String(over.id));
  }
  function endDrag() {
    setDragId(null);
    setOverId(null);
    document.body.classList.remove(styles.dragging);
    lastDragEnd.current = Date.now();
  }
  const dragBinder = binders.find((b) => b.id === dragId);

  /* ----- The keyboard ----- */

  // The spot the keyboard is on (a binder's id, or "add" for the "+"),
  // and its position (so if that binder is deleted, the keyboard lands on
  // the one that takes its place). Only that spot is a Tab stop.
  const [keyId, setKeyId] = useState<string | null>(null);
  const [keyIndex, setKeyIndex] = useState(0);
  // The binder being moved with the keyboard, if any
  const [carrying, setCarrying] = useState<string | null>(null);
  // Is the keyboard on the shelf (so the key guide shows)?
  const [keyboardHere, setKeyboardHere] = useState(false);
  // Each spot's element, so the keyboard can be moved onto it
  const stopElements = useRef(new Map<string, HTMLElement>());
  // True after E, Delete or N opened a window from the keyboard
  const keyboardOpenedWindow = useRef(false);
  // A binder to put the keyboard on once the shelf has been redrawn
  // (after one is moved with the keyboard, it keeps the keyboard)
  const focusAfterRedraw = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfterRedraw.current) return;
    stopElements.current.get(focusAfterRedraw.current)?.focus();
    focusAfterRedraw.current = null;
  });

  // Every spot in order: each binder, then the "+"
  const stops = [...binders.map((b) => b.id), ADD_STOP];
  const foundIndex = keyId ? stops.indexOf(keyId) : -1;
  const keyStopIndex = foundIndex >= 0 ? foundIndex : Math.min(keyIndex, stops.length - 1);
  const keyStop = stops[keyStopIndex];

  // A binder's name, for what screen readers hear
  const nameOf = (id: string) => binders.find((b) => b.id === id)?.name ?? 'Binder';

  // Move the keyboard to the spot at a position.
  function goToStop(index: number) {
    const id = stops[index];
    setKeyId(id);
    setKeyIndex(index);
    stopElements.current.get(id)?.focus();
    if (carrying) {
      const binderCount = stops.length - 1;
      announce(id === carrying
        ? `Back at spot ${index + 1} of ${binderCount}, where it started.`
        : `Spot ${index + 1} of ${binderCount}, where ${nameOf(id)} is now.`);
    }
  }

  // How many spots fit across one row right now: the spots sitting at the
  // same height as the first one.
  function columns(): number {
    const tops = stops.map((id) => Math.round(stopElements.current.get(id)?.getBoundingClientRect().top ?? 0));
    return tops.filter((top) => top === tops[0]).length;
  }

  // The page asks for the keyboard back after a window closes.
  useImperativeHandle(ref, () => ({
    returnFocus() {
      if (!keyboardOpenedWindow.current) return;
      keyboardOpenedWindow.current = false;
      // Wait a moment, so the shelf has been redrawn first.
      requestAnimationFrame(() => stopElements.current.get(keyStop)?.focus());
    },
  }));

  // The keys, while the keyboard is on a spot (not while dragging with
  // the mouse, and not with Ctrl / Alt / Cmd held, which belong to the
  // browser).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const stop = (event.target as HTMLElement).closest<HTMLElement>('[data-stop]');
    if (!stop || dragId || event.ctrlKey || event.altKey || event.metaKey) return;
    const id = stop.dataset.stop!;
    const here = stops.indexOf(id);

    // Arrow keys, Home and End: up and down jump a whole row; down from a
    // row above the last one, with nothing right below, goes to the last
    // spot. While moving a binder, the "+" spot is skipped.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();              // don't scroll the page
      const last = carrying ? stops.length - 2 : stops.length - 1;
      const across = columns();
      let next = here;
      if (event.key === 'ArrowLeft') next = here - 1;
      if (event.key === 'ArrowRight') next = here + 1;
      if (event.key === 'ArrowUp') next = here - across >= 0 ? here - across : here;
      if (event.key === 'ArrowDown') {
        const onLastRow = Math.floor(here / across) === Math.floor(last / across);
        next = onLastRow ? here : Math.min(here + across, last);
      }
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = last;
      goToStop(Math.max(0, Math.min(last, next)));
      return;
    }

    // While moving a binder: Space or Enter drops it here (the binders in
    // between shift along), Escape puts it back, Tab gives up and moves on.
    if (carrying) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();            // Enter mustn't open the binder here
        setCarrying(null);
        if (id === carrying) { announce(`${nameOf(carrying)} stays where it was.`); return; }
        onMove(carrying, id);
        setKeyId(carrying);                // the keyboard stays on the moved binder
        focusAfterRedraw.current = carrying;
        announce(`Moved ${nameOf(carrying)} to spot ${here + 1} of ${stops.length - 1}.`);
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        announce(`Cancelled. ${nameOf(carrying)} stays where it was.`);
        setCarrying(null);
      }
      return;
    }

    // N works on any spot: the New binder window.
    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      keyboardOpenedWindow.current = true;
      onNew();
      return;
    }

    // The rest only do something on a binder. (On the "+", Enter and
    // Space press it like a button; Enter on a binder opens it like a click.)
    if (id === ADD_STOP) return;
    if (event.key === ' ') {
      event.preventDefault();              // don't scroll the page
      setCarrying(id);
      announce(`Picked up ${nameOf(id)}. Use the arrow keys to choose its new spot, ` +
        'then Space to drop it, or Escape to cancel.');
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      keyboardOpenedWindow.current = true;
      onEdit(id);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      keyboardOpenedWindow.current = true;
      onDelete(id);
    }
  }

  // The key guide at the bottom of the page: which keys do what right now.
  // It shows while the keyboard is on the shelf (or a binder is moving).
  const hint = carrying
    ? `Moving ${nameOf(carrying)}: ←↑↓→ choose a spot · Space or Enter drop · Esc cancel`
    : keyStop === ADD_STOP
      ? '←↑↓→ move · Enter new binder · Home / End first / last · ? all keys'
      : '←↑↓→ move · Enter open · Space pick up · E edit · Del delete · N new binder · ? all keys';

  // Keep track of whether the keyboard is on a spot. ":focus-visible"
  // means it got there by keyboard (not a mouse click).
  function checkKeyboardHere() {
    const focused = document.activeElement as HTMLElement | null;
    setKeyboardHere(Boolean(focused?.closest('[data-stop]') && focused.matches(':focus-visible')));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={findDropSpot}
      // Measure the binders' spots all the time, since the circles
      // appearing can shift things
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // Don't put the keyboard back on the dragged binder after a drop:
      // a window may have just opened (and its name box needs it)
      accessibility={{ restoreFocus: false }}
      onDragStart={({ active, activatorEvent }) => {
        setDragId(String(active.id));
        if (carrying) setCarrying(null);   // only one binder moves at a time
        document.body.classList.add(styles.dragging);   // the "grabbing hand" everywhere
        // A small buzz or tick when a finger picks one up (lib/haptics.ts)
        if (typeof TouchEvent !== 'undefined' && activatorEvent instanceof TouchEvent) hapticTap();
      }}
      onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
      onDragEnd={handleDragEnd}
      onDragCancel={endDrag}
    >
      <div
        className={styles.shelf}
        onKeyDown={handleKeyDown}
        // When the keyboard arrives on a spot (by Tab, arrows or a
        // click), it becomes the keyboard's spot.
        onFocus={(event) => {
          const stop = (event.target as HTMLElement).closest<HTMLElement>('[data-stop]');
          if (stop) {
            setKeyId(stop.dataset.stop!);
            setKeyIndex(stops.indexOf(stop.dataset.stop!));
          }
          checkKeyboardHere();
        }}
        // Checked a moment later, once the browser has settled where the
        // keyboard went
        onBlur={() => setTimeout(checkKeyboardHere, 0)}
        // Ignore the click browsers send right after a drag ("Capture":
        // catch it before the link sees it), so dropping a binder doesn't
        // also open it
        onClickCapture={(event) => {
          if (dragId || Date.now() - lastDragEnd.current < 400) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        // A long press on a phone normally opens a menu (Open link…);
        // block it on binders, since a long press picks the binder up
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest('[data-stop]')) event.preventDefault();
        }}
        // Starting a mouse or finger drag while moving a binder with the
        // keyboard puts the keyboard's binder back first
        onPointerDownCapture={() => { if (carrying) setCarrying(null); }}
      >
        {binders.map((binder) => (
          <ShelfBinder
            key={binder.id}
            binder={binder}
            count={counts[binder.id] ?? 0}
            tabStop={keyStop === binder.id}
            faded={carrying === binder.id}
            outlined={(carrying !== null && keyStop === binder.id && carrying !== binder.id) ||
              (dragId !== null && overId === binder.id && dragId !== binder.id)}
            registerStop={(element) => {
              if (element) stopElements.current.set(binder.id, element);
              else stopElements.current.delete(binder.id);
            }}
          />
        ))}

        {/* The "+" binder, always last on the shelf (there's no limit) */}
        <button
          ref={(element) => {
            if (element) stopElements.current.set(ADD_STOP, element);
            else stopElements.current.delete(ADD_STOP);
          }}
          className={styles.tile}
          type="button"
          data-stop={ADD_STOP}
          tabIndex={keyStop === ADD_STOP ? 0 : -1}
          aria-label="Make a new binder"
          disabled={addDisabled}
          onClick={onNew}
        >
          <ClosedBinder plus />
          <span className={styles.caption}>New binder</span>
        </button>
      </div>

      {/* The drop circles, only while a binder is being dragged:
          the pencil at the top (edit) and the red X at the bottom (delete).
          aria-hidden: they only work with dragging, so screen readers skip them. */}
      {dragId && (
        <>
          <DropCircle id={EDIT_ZONE} active={overId === EDIT_ZONE} className={styles.editZone}>
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
            <path d="M13.5 6.5l4 4" />
          </DropCircle>
          <DropCircle id={DELETE_ZONE} active={overId === DELETE_ZONE} className={styles.deleteZone}>
            <path d="M7 7l10 10M17 7L7 17" />
          </DropCircle>
        </>
      )}

      {/* The floating copy of the binder that follows the pointer, tilted
          a little. It fades over a drop circle, so the circle shows. */}
      <DragOverlay dropAnimation={null}>
        {dragBinder && (
          <div className={`${styles.ghost} ${overId === EDIT_ZONE || overId === DELETE_ZONE ? styles.overZone : ''}`}>
            <ClosedBinder name={dragBinder.name} colorCode={dragBinder.color} cover={dragBinder.cover} />
          </div>
        )}
      </DragOverlay>

      {/* The key guide (aria-hidden: screen readers hear the same help
          from the announcements instead) */}
      <div className={styles.keyboardHint} aria-hidden="true" hidden={!(carrying || keyboardHere)}>{hint}</div>
    </DndContext>
  );
}

/* ---------------------------------------------------------------------
   ONE BINDER ON THE SHELF
   --------------------------------------------------------------------- */

function ShelfBinder({ binder, count, tabStop, faded, outlined, registerStop }: {
  binder: Binder;
  count: number;
  tabStop: boolean;
  faded: boolean;
  outlined: boolean;
  registerStop: (element: HTMLElement | null) => void;
}) {
  // The binder can be dragged (by its link), and other binders can be
  // dropped on its spot. The cover is what's measured for the floating copy.
  const draggable = useDraggable({ id: binder.id });
  const droppable = useDroppable({ id: binder.id });

  // What screen readers say about it, e.g. "Open Red, Black cover, Blue, 5 cards"
  const symbol = manaColor(binder.color);
  const label = `Open ${binder.name}, ${coverColorName(binder.cover)} cover${symbol ? `, ${symbol.name}` : ''}, ${cardCountText(count)}`;

  return (
    // The binder's spot on the shelf (other binders can be dropped on it)
    <div ref={droppable.setNodeRef} className={styles.slot}>
      <Link
        ref={registerStop}
        to={`/binders/${encodeURIComponent(binder.id)}`}
        className={`${styles.tile} ${draggable.isDragging || faded ? styles.dragSource : ''} ${outlined ? styles.dropTarget : ''}`}
        data-stop={binder.id}
        tabIndex={tabStop ? 0 : -1}
        aria-label={label}
        draggable={false}
        // dnd-kit's "listeners" start a drag on mouse down / touch start
        {...draggable.listeners}
      >
        <span ref={draggable.setNodeRef} className={styles.coverHolder}>
          <ClosedBinder name={binder.name} colorCode={binder.color} cover={binder.cover} />
        </span>
        <span className={styles.caption}>{cardCountText(count)}</span>
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------------
   A DROP CIRCLE (edit or delete)
   --------------------------------------------------------------------- */

function DropCircle({ id, active, className, children }: {
  id: string;
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  const droppable = useDroppable({ id });
  return (
    <div ref={droppable.setNodeRef} className={`${styles.dropZone} ${className} ${active ? styles.active : ''}`}
         data-zone={id} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={id === DELETE_ZONE ? 3 : 2.2}
           strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}
