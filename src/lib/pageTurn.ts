/* =====================================================================
   THE PAGE-TURN ANIMATION
   A temporary page (the "flipper") is laid exactly over the page that's
   turning, and swings around the spine like a door on a hinge, in 3D.
   Its two sides are copies of the pages involved. Shadows on the binder
   underneath fade as the page lifts and darken as it lands.
   The turn happens in TWO halves. In the first half the page lifts until
   it stands straight up (edge-on, so neither side can be seen). Right
   then the side showing is swapped, and in the second half the page
   comes down. So only ONE side is ever drawn at a time, and the cards on
   one side can never show through to the other.
   This works on the page's elements directly (the "DOM"), the same way
   as the original site. The binder page gives it its class names.
   Plain TypeScript with no React in it.
   ===================================================================== */

// The class names the binder page's stylesheet uses for the turning page
export type TurnClasses = {
  flipper: string;     // the turning page
  face: string;        // one side of it
  front: string;       // the front side
  back: string;        // the back side (starts turned around)
  shade: string;       // a dark layer that fades in and out over a side
  blank: string;       // a plain page back (phones)
  shadow: string;      // the shadow cast on the binder
};

// How long one page turn takes, in milliseconds (1000 = 1 second)
export const TURN_MS = 650;

// Where an element sits inside the binder (its left/top edge and size)
type Spot = { left: number; top: number; width: number; height: number };
function spotOf(element: HTMLElement): Spot {
  return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
}

// The settings for one turn:
//  - cover:    the page element the turning page starts on top of
//  - front:    the page element copied onto its front (null = blank)
//  - back:     the page element copied onto its back (null = blank)
//  - hinge:    which edge it swings on: 'left' or 'right' (the spine side)
//  - from, to: start and end angles (0 = lying flat, ±180 = turned over)
//  - landing:  the page element on the other side of the spine, where a
//              page turned over to ±180 comes to rest (null on phones)
//  - fade:     'out' to fade it away at the end, 'in' to fade in at the start
//  - showUnder: called once the turning page is in place, to show the
//              pages that will be revealed underneath
export type TurnSettings = {
  binder: HTMLElement;
  classes: TurnClasses;
  cover: HTMLElement;
  front: HTMLElement | null;
  back: HTMLElement | null;
  hinge: 'left' | 'right';
  from: number;
  to: number;
  landing: HTMLElement | null;
  fade?: 'in' | 'out';
  showUnder: () => void;
};

// Run one page turn. Resolves once the page has landed (and the turning
// page and shadows are gone).
export async function animateTurn(s: TurnSettings): Promise<void> {
  const { binder, classes } = s;
  const spot = spotOf(s.cover);
  const otherSide = s.hinge === 'left' ? 'right' : 'left';

  // Make a copy of a page for one side of the turning page (or a plain
  // blank page back), with a shade layer over it.
  function side(sideClass: string, page: HTMLElement | null): HTMLElement {
    const face = document.createElement('div');
    face.className = `${classes.face} ${sideClass}`;
    let content: HTMLElement;
    if (page) {
      content = page.cloneNode(true) as HTMLElement;
      content.hidden = false;
      content.removeAttribute('aria-label');
    } else {
      content = document.createElement('div');
      content.className = classes.blank;
    }
    const shade = document.createElement('div');
    shade.className = classes.shade;
    face.append(content, shade);
    return face;
  }

  // A soft shadow over one page-sized spot of the binder: darkest along
  // the spine and fading out toward the outer edge, like the shadow a
  // lifted page casts. "spineSide" is which edge of the spot is the spine.
  function castShadow(where: Spot, spineSide: 'left' | 'right'): HTMLElement {
    const shadow = document.createElement('div');
    shadow.className = classes.shadow;
    Object.assign(shadow.style, {
      left: `${where.left}px`, top: `${where.top}px`,
      width: `${where.width}px`, height: `${where.height}px`,
      background: `linear-gradient(to ${spineSide === 'left' ? 'right' : 'left'},
        rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.25) 35%, rgba(0, 0, 0, 0) 75%)`,
    });
    binder.appendChild(shadow);
    return shadow;
  }

  // Wait for one half of the turn to finish, but not forever: if the
  // browser isn't drawing the page (a frozen or hidden tab), animations
  // stand still and would never finish, leaving the binder stuck mid-turn.
  // So half a second after it should have finished, jump it to its end.
  async function finishedOrForced(animation: Animation, duration: number) {
    const timeUp = new Promise((resolve) => setTimeout(resolve, duration + 500));
    await Promise.race([animation.finished, timeUp]);
    if (animation.playState !== 'finished') {
      for (const other of binder.getAnimations({ subtree: true })) {
        // Some animations never end (like the pulsing edge glow): skip those.
        try { other.finish(); } catch { /* never-ending: leave it running */ }
      }
    }
  }

  // Build the turning page and lay it exactly over the covered page.
  // aria-hidden and inert: screen readers and the keyboard skip it.
  const flipper = document.createElement('div');
  flipper.className = classes.flipper;
  flipper.setAttribute('aria-hidden', 'true');
  flipper.inert = true;
  Object.assign(flipper.style, {
    left: `${spot.left}px`, top: `${spot.top}px`,
    width: `${spot.width}px`, height: `${spot.height}px`,
    transformOrigin: `${s.hinge} center`,
  });
  const frontFace = side(classes.front, s.front);
  const backFace = side(classes.back, s.back);
  flipper.append(frontFace, backFace);

  // Which side faces up at the start? Flat (0°) = the front; turned
  // over (±180°) = the back. Only that side is drawn for now.
  const startsOnBack = Math.abs(s.from) > 90;
  frontFace.hidden = startsOnBack;
  backFace.hidden = !startsOnBack;

  // Shadows on the binder underneath: where the page starts flat (fades
  // as it lifts away), and where it lands flat (darkens as it comes down).
  const startShadow = s.from === 0 ? castShadow(spot, s.hinge)
    : s.landing ? castShadow(spotOf(s.landing), otherSide) : null;
  const endShadow = s.to === 0 ? castShadow(spot, s.hinge)
    : s.landing ? castShadow(spotOf(s.landing), otherSide) : null;
  if (endShadow) endShadow.style.opacity = '0';

  // Show the pages that will be revealed, and put the turning page on top.
  s.showUnder();
  binder.appendChild(flipper);

  const half = TURN_MS / 2;
  const middle = (s.from + s.to) / 2;   // the straight-up angle (±90°)

  // FIRST HALF: lift the page until it stands straight up. "ease-in"
  // starts slowly and speeds up, like a page peeling off the binder.
  const lift = flipper.animate([
    { transform: `rotateY(${s.from}deg)`, opacity: s.fade === 'in' ? 0 : 1 },
    { transform: `rotateY(${middle}deg)`, opacity: 1 },
  ], { duration: half, easing: 'ease-in', fill: 'forwards' });
  // The page darkens as it tilts away from the light, and its shadow on
  // the binder fades as it rises.
  (startsOnBack ? backFace : frontFace).lastElementChild!.animate(
    [{ opacity: 0 }, { opacity: 0.5 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
  startShadow?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
  await finishedOrForced(lift, half);

  // HALFWAY: the page is edge-on. Show the other side instead.
  frontFace.hidden = !startsOnBack;
  backFace.hidden = startsOnBack;

  // SECOND HALF: bring the page down. "ease-out" starts fast and slows
  // to a gentle stop as it settles flat.
  const settle = flipper.animate([
    { transform: `rotateY(${middle}deg)`, opacity: 1 },
    { transform: `rotateY(${s.to}deg)`, opacity: s.fade === 'out' ? 0 : 1 },
  ], { duration: half, easing: 'ease-out', fill: 'forwards' });
  // The newly showing side starts dark and brightens as it lies flat,
  // while its shadow on the binder darkens as it comes down.
  (startsOnBack ? frontFace : backFace).lastElementChild!.animate(
    [{ opacity: 0.5 }, { opacity: 0 }], { duration: half, easing: 'ease-out', fill: 'forwards' });
  endShadow?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: half, easing: 'ease-out', fill: 'forwards' });
  await finishedOrForced(settle, half);

  // Landed: remove the turning page and the shadows.
  flipper.remove();
  startShadow?.remove();
  endShadow?.remove();
}
