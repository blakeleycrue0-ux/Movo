import { Easing } from "remotion";

export const W = 1080;
export const H = 1920;
export const FPS = 25;
export const DURATION = 25 * FPS; // 625 frames

/** Palette. Warm white and sage are sampled from the authentic logo file. */
export const C = {
  forest: "#1E3A2A",
  warm: "#F8F4E9",
  sage: "#BFD3A0",
  /** Secondary text on warm white (derived from forest; 6.4:1 contrast on warm white). */
  moss: "#4A6A4F",
};

/** Layout grid & safe zones (Reels/TikTok UI covers the right edge and the bottom). */
export const G = {
  left: 96, // left margin for all text
  textRight: 900, // important text never passes this x (right ~180px is reserved for UI buttons)
  top: 230, // below status bar / top UI
  textBottom: 1440, // important text stays above this y (captions, username, CTA bar)
};

export const FONT = "Inter Tight";

export const ease = {
  /** frames/bands moving between layouts */
  move: Easing.bezier(0.65, 0, 0.35, 1),
  /** text and elements arriving */
  in: Easing.bezier(0.16, 1, 0.3, 1),
  /** text leaving */
  out: Easing.bezier(0.7, 0, 0.84, 0),
};
