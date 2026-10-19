/* =====================================================================
   COVER COLORS: HOW TO DRAW ONE
   A cover (a binder on the shelf, a color swatch, a dot in a menu) is
   drawn with four shades: --cover-light, --cover-base and --cover-dark
   (a sheen from corner to corner) and --cover-edge (its thin border).
   - One of the named colors ("gold"): its "cover-gold" class, in
     styles/covers.css, sets the shades.
   - A custom color ("#3a7bd5"): the shades are worked out here, by
     mixing it with white and black.
   Plain TypeScript with no React in it.
   ===================================================================== */

import type { CSSProperties } from 'react';
import { COVER_COLORS, cleanCover, isCustomCover } from './binderStorage';

// Split "#3a7bd5" into its red, green and blue amounts (each 0 to 255).
function colorParts(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// Blend two colors: "amount" of the way from the first to the second
// (0.25 = a quarter of the way). Gives back a "#rrggbb" code.
function mixColors(hex: string, towards: string, amount: number): string {
  const from = colorParts(hex);
  const to = colorParts(towards);
  return '#' + from.map((value, i) => {
    const mixed = Math.round(value + (to[i] - value) * amount);
    return mixed.toString(16).padStart(2, '0');
  }).join('');
}

// How bright a color looks, from 0 (black) to 1 (white). Green looks
// brighter to our eyes than red, and red than blue, so they count
// differently (the usual "perceived brightness" weights).
function brightness(hex: string): number {
  const [r, g, b] = colorParts(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// How to draw a cover color: the class to add (named colors), the
// shades to set directly (custom colors), and whether it's a pale cover
// (whose name label then needs dark text).
export function coverLook(code: string | null | undefined): { className: string; style: CSSProperties; light: boolean } {
  const clean = cleanCover(code);
  if (isCustomCover(clean)) {
    return {
      className: '',
      style: {
        '--cover-light': mixColors(clean, '#ffffff', 0.25),   // a quarter white
        '--cover-base': clean,
        '--cover-dark': mixColors(clean, '#000000', 0.45),    // nearly half black
        '--cover-edge': mixColors(clean, '#000000', 0.2),
      } as CSSProperties,
      light: brightness(clean) > 0.6,
    };
  }
  return {
    className: `cover-${clean}`,
    style: {},
    light: COVER_COLORS.find((c) => c.code === clean)?.light === true,
  };
}

// The readable name of a cover color, e.g. "gray" -> "Light gray", or
// "Custom color" for one picked with the color chooser.
export function coverColorName(code: string | null | undefined): string {
  const clean = cleanCover(code);
  return isCustomCover(clean) ? 'Custom color' : COVER_COLORS.find((c) => c.code === clean)!.name;
}
