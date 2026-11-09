import type { CSSProperties, ReactNode } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, ease } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * One line of type revealed through a mask: the words slide in as a block (never letter by letter),
 * with a short travel and a touch of blur that resolves as it lands. Optionally exits upwards.
 */
export function MaskLine({ children, top, left, size, weight = 700, color = C.forest, inAt, outAt, inDur = 16, outDur = 11, tracking = -0.035, style }: {
  children: ReactNode; top: number; left: number; size: number; weight?: number; color?: string;
  inAt: number; outAt?: number; inDur?: number; outDur?: number; tracking?: number; style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  const pin = interpolate(f, [inAt, inAt + inDur], [0, 1], { ...clamp, easing: ease.in });
  const pout = outAt === undefined ? 0 : interpolate(f, [outAt, outAt + outDur], [0, 1], { ...clamp, easing: ease.out });
  if (f < inAt || (outAt !== undefined && f > outAt + outDur)) return null;
  const y = (1 - pin) * 105 - pout * 105;
  const blur = (1 - pin) * 6 + pout * 5;
  return (
    <div style={{ position: "absolute", top, left, overflow: "hidden", paddingBottom: size * 0.16, paddingRight: 8, ...style }}>
      <div style={{
        fontFamily: FONT, fontSize: size, fontWeight: weight, lineHeight: 1, letterSpacing: `${tracking}em`, color,
        whiteSpace: "nowrap", transform: `translateY(${y}%)`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

/** A thin rule that draws from the left. */
export function Rule({ top, left, width, color = C.sage, inAt, outAt, thickness = 4 }: { top: number; left: number; width: number; color?: string; inAt: number; outAt?: number; thickness?: number }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [inAt, inAt + 14], [0, 1], { ...clamp, easing: ease.in });
  const q = outAt === undefined ? 0 : interpolate(f, [outAt, outAt + 10], [0, 1], { ...clamp, easing: ease.out });
  return <div style={{ position: "absolute", top, left: left + width * q, width: width * p * (1 - q), height: thickness, background: color }} />;
}

export interface Rect { x: number; y: number; w: number; h: number }
/** A layout change of a frame: starts at `at`, lasts `dur` frames. The first entry is the initial layout. */
export interface Move { at: number; dur: number; rect: Rect }

export function rectAt(frame: number, moves: Move[]): Rect {
  let r = moves[0].rect;
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i];
    const p = interpolate(frame, [m.at, m.at + m.dur], [0, 1], { ...clamp, easing: ease.move });
    if (p <= 0) break;
    r = { x: r.x + (m.rect.x - r.x) * p, y: r.y + (m.rect.y - r.y) * p, w: r.w + (m.rect.w - r.w) * p, h: r.h + (m.rect.h - r.h) * p };
  }
  return r;
}

export interface Shot {
  src: string;
  at: number; // wipe starts
  dur?: number;
  /** object-position of the crop inside the frame */
  pos: string;
  dir?: "left" | "right" | "up" | "down";
  inspiration?: boolean;
}

/**
 * The photo window. Its rectangle is keyframed (moves) and photos change inside it with a
 * directional wipe and a short counter-slide, so one frame carries the story from scene to scene.
 */
export function PhotoFrame({ moves, shots, fill, fillFrom, fillDur = 20, label, labelHideAfter }: {
  moves: Move[]; shots: Shot[]; fill?: string; fillFrom?: number; fillDur?: number; label: string; labelHideAfter?: number;
}) {
  const f = useCurrentFrame();
  const r = rectAt(f, moves);
  if (r.w < 1 || r.h < 1) return null;
  const visible = shots.filter((s) => f >= s.at);
  const fillP = fill && fillFrom !== undefined ? interpolate(f, [fillFrom, fillFrom + fillDur], [0, 1], { ...clamp, easing: ease.move }) : 0;
  const current = visible[visible.length - 1];
  const labelOpacity = current?.inspiration && (labelHideAfter === undefined || f < labelHideAfter)
    ? interpolate(f, [current.at + 10, current.at + 18], [0, 1], clamp) * (1 - fillP) : 0;
  const showLabel = labelOpacity > 0 && r.w > 260 && r.h > 260;

  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden", background: C.forest }}>
      {visible.map((s, i) => {
        const dur = s.dur ?? 18;
        const p = i === 0 && s.at <= moves[0].at ? 1 : interpolate(f, [s.at, s.at + dur], [0, 1], { ...clamp, easing: ease.move });
        const dir = s.dir ?? "left";
        const inset = (1 - p) * 100;
        const clip = dir === "left" ? `inset(0 0 0 ${inset}%)` : dir === "right" ? `inset(0 ${inset}% 0 0)` : dir === "up" ? `inset(${inset}% 0 0 0)` : `inset(0 0 ${inset}% 0)`;
        const slide = (1 - p) * 8;
        const tx = dir === "left" ? slide : dir === "right" ? -slide : 0;
        const ty = dir === "up" ? slide : dir === "down" ? -slide : 0;
        return (
          <div key={`${s.src}-${s.at}`} style={{ position: "absolute", inset: 0, clipPath: p < 1 ? clip : undefined }}>
            <Img src={staticFile(s.src)} style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos,
              transform: `translate(${tx}%, ${ty}%) scale(1.04)`,
            }} />
          </div>
        );
      })}
      {fillP > 0 && <div style={{ position: "absolute", inset: 0, background: fill, opacity: fillP }} />}
      {showLabel && (
        <div style={{
          position: "absolute", left: 20, bottom: 20, padding: "8px 14px", background: "rgba(248,244,233,0.92)", color: C.forest,
          fontFamily: FONT, fontSize: 22, fontWeight: 500, letterSpacing: "0.01em", borderRadius: 2, opacity: labelOpacity,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
