/* =====================================================================
   HAPTIC FEEDBACK (a small buzz or tick you feel in the phone)
   Used when a held card (or binder) lifts and can be dragged, so a
   finger can feel that the long press worked.
   Phones do this in two different ways:
   - Android: the browser's "vibrate" command runs the phone's vibration
     motor for a number of milliseconds.
   - iPhone and iPad: Safari has no vibrate command. But since iOS 18, it
     gives a light "tick" when a switch-style checkbox (<input switch>) is
     flipped, so this file keeps a hidden one and flips it.
   Computers, and phones that can do neither, just do nothing.
   Plain TypeScript with no React in it.
   ===================================================================== */

// How long the Android buzz lasts, in milliseconds: long enough to feel
// on most phones' motors, short enough to feel like a tap, not a buzz
const BUZZ_MS = 30;

// The hidden switch for the iPhone tick, made the first time it's needed
let iosSwitch: HTMLLabelElement | null = null;

// Make the hidden switch: a label wrapping a switch-style checkbox,
// placed off the screen, invisible, and skipped by the Tab key and
// screen readers. Clicking the label flips the switch, and flipping it
// is what makes the tick.
function makeIosSwitch(): HTMLLabelElement {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

// One short buzz (Android) or tick (iPhone/iPad), where the phone can.
// Browsers only allow it after the person has touched the page at least
// once, so the very first long press after opening the app may be silent.
export function hapticTap(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(BUZZ_MS);
      return;
    }
    // Only on iPhones and iPads (an iPad can say it's a Mac, but a Mac
    // has no touch screen), so computers never get the hidden switch
    const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
    if (!apple) return;
    iosSwitch ??= makeIosSwitch();
    iosSwitch.click();
  } catch {
    /* not allowed here: no buzz, everything else carries on */
  }
}
