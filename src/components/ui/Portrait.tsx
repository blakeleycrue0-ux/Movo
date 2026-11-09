/**
 * Deterministic illustrated portrait from a seed. Original artwork drawn in SVG — used for demo
 * people and as avatar choices during onboarding. Flat, paper-cut style with a restrained palette.
 */
import { memo } from "react";

const BG = ["#F6D3C4", "#CFE0F0", "#D7E5CF", "#F4E3B0", "#F2D0D6", "#CDE7E0", "#E9DCCB", "#DDE3EA"];
const SKIN = ["#F6DCC8", "#F1CDB3", "#E3B08D", "#C98E67", "#A0694A", "#74492F"];
const HAIR = ["#2A211F", "#4A3326", "#7B4E34", "#C2925A", "#1E1E24", "#8E3B2F", "#D9C7A8"];
const SHIRT = ["#2F3B4C", "#E07A5F", "#3D8B7A", "#EDB94A", "#5B7DB1", "#202124", "#B5655C", "#6E8B5B"];

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], h: number, salt: number) {
  return arr[(h >>> salt) % arr.length];
}

export const Portrait = memo(function Portrait({ seed, className, title }: { seed: string; className?: string; title?: string }) {
  const h = hashSeed(seed);
  const bg = pick(BG, h, 0);
  const skin = pick(SKIN, h, 3);
  const hair = pick(HAIR, h, 6);
  const shirt = pick(SHIRT, h, 9);
  const style = (h >>> 12) % 7;
  const glasses = (h >>> 16) % 5 === 0;
  const collar = (h >>> 19) % 3;
  const tilt = ((h >>> 21) % 7) - 3;
  const shade = "rgba(0,0,0,0.08)";

  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill={bg} />
      <circle cx={78} cy={18} r={30} fill="#fff" opacity={0.22} />
      <circle cx={14} cy={88} r={22} fill="#fff" opacity={0.14} />
      <g transform={`rotate(${tilt} 50 60)`}>
        {/* hair behind head (long styles) */}
        {style === 1 && <path d="M28 46c0-14 10-25 22-25s22 11 22 25v26c-4 3-9 4-14 4H42c-5 0-10-1-14-4z" fill={hair} />}
        {style === 5 && <path d="M30 44c0-13 9-22 20-22s20 9 20 22l3 20c-6 4-13 5-23 5s-17-1-23-5z" fill={hair} />}
        {/* torso */}
        <path d="M18 100c0-17 14-28 32-28s32 11 32 28z" fill={shirt} />
        {collar === 0 && <path d="M42 73l8 9 8-9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
        {collar === 1 && <path d="M38 76c4 5 8 7 12 7s8-2 12-7" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={2.5} strokeLinecap="round" />}
        {/* neck */}
        <path d="M44 62h12v10c0 3-3 5-6 5s-6-2-6-5z" fill={skin} />
        <path d="M44 66c2 2 4 3 6 3s4-1 6-3v-4H44z" fill={shade} />
        {/* ears */}
        <ellipse cx={32.5} cy={47} rx={3.4} ry={4.6} fill={skin} />
        <ellipse cx={67.5} cy={47} rx={3.4} ry={4.6} fill={skin} />
        {/* head */}
        <ellipse cx={50} cy={45} rx={17.5} ry={20} fill={skin} />
        {/* hair on top */}
        {style === 0 && <path d="M32 42c-1-12 7-20 18-20 12 0 19 8 18 19-5-6-11-8-18-8-8 0-14 3-18 9z" fill={hair} />}
        {style === 1 && <path d="M32 44c0-12 8-21 18-21s18 9 18 21c-6-7-12-10-18-10s-12 3-18 10z" fill={hair} />}
        {style === 2 && (<>
          <circle cx={50} cy={20} r={8} fill={hair} />
          <path d="M32 43c0-11 8-19 18-19s18 8 18 19c-5-5-11-7-18-7s-13 2-18 7z" fill={hair} />
        </>)}
        {style === 3 && (<g fill={hair}>
          {[[36, 32], [44, 26], [53, 25], [61, 29], [66, 37], [33, 40], [48, 31], [57, 33], [40, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} />)}
        </g>)}
        {style === 4 && <path d="M32 44c-1-13 8-22 19-22 9 0 16 6 17 15-9-1-17-4-23-10-3 7-8 13-13 17z" fill={hair} />}
        {style === 5 && <path d="M32 42c0-11 8-19 18-19s18 8 18 19c-3-4-8-7-13-8l-5 5-4-5c-6 1-11 4-14 8z" fill={hair} />}
        {style === 6 && <path d="M33 40c1-10 8-16 17-16s16 6 17 16c-5-3-11-5-17-5s-12 2-17 5z" fill={hair} opacity={0.9} />}
        {/* face */}
        <circle cx={43.5} cy={48} r={1.7} fill="#202124" />
        <circle cx={56.5} cy={48} r={1.7} fill="#202124" />
        <path d="M45.5 56c1.4 1.6 2.9 2.3 4.5 2.3s3.1-.7 4.5-2.3" fill="none" stroke="#202124" strokeWidth={1.6} strokeLinecap="round" />
        <circle cx={40} cy={54} r={2.8} fill="#E8826B" opacity={0.25} />
        <circle cx={60} cy={54} r={2.8} fill="#E8826B" opacity={0.25} />
        {glasses && (
          <g fill="none" stroke="#202124" strokeWidth={1.4}>
            <circle cx={43.5} cy={48} r={4.6} />
            <circle cx={56.5} cy={48} r={4.6} />
            <path d="M48.1 48h3.8" />
          </g>
        )}
      </g>
    </svg>
  );
});

/** Abstract cover artwork for projects without an uploaded cover. */
export const CoverArt = memo(function CoverArt({ seed, className }: { seed: string; className?: string }) {
  const h = hashSeed(seed);
  const bg = pick(BG, h, 0);
  const a = pick(SHIRT, h, 4);
  const b = pick(BG, h, 8);
  const v = (h >>> 12) % 3;
  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="100" fill={bg} />
      {v === 0 && (<>
        <circle cx="118" cy="30" r="34" fill={a} opacity={0.85} />
        <rect x="18" y="52" width="70" height="30" rx="15" fill="#fff" opacity={0.7} />
        <rect x="30" y="20" width="40" height="12" rx="6" fill={b} />
      </>)}
      {v === 1 && (<>
        <rect x="20" y="18" width="56" height="64" rx="14" fill="#fff" opacity={0.75} />
        <rect x="30" y="30" width="36" height="6" rx="3" fill={a} />
        <rect x="30" y="42" width="26" height="6" rx="3" fill={a} opacity={0.5} />
        <circle cx="116" cy="62" r="26" fill={a} opacity={0.8} />
      </>)}
      {v === 2 && (<>
        <path d="M0 78 C40 50 70 98 110 66 S160 52 160 52 V100 H0Z" fill={a} opacity={0.8} />
        <circle cx="44" cy="36" r="16" fill="#fff" opacity={0.75} />
        <rect x="92" y="24" width="44" height="10" rx="5" fill={b} />
      </>)}
    </svg>
  );
});
