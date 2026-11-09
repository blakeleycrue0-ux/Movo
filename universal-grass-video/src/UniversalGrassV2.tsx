import { AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, G, H, W, ease } from "./theme";
import { COPY } from "./copy";
import { MaskLine, PhotoFrame, Rule, type Move, type Shot } from "./primitives";

/* ---------------------------------------------------------------- fonts (local, OFL) */
const fontHandle = typeof document !== "undefined" ? delayRender("Loading Inter Tight") : null;
if (typeof document !== "undefined") {
  Promise.all([400, 500, 600, 700].map((w) =>
    new FontFace(FONT, `url(${staticFile(`fonts/inter-tight-latin-${w}-normal.woff2`)}) format("woff2")`, { weight: String(w) })
      .load().then((ff) => document.fonts.add(ff)),
  )).then(() => fontHandle !== null && continueRender(fontHandle))
    .catch(() => fontHandle !== null && continueRender(fontHandle));
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ---------------------------------------------------------------- assets */
const IMG = {
  terrace: "assets/piscina-terraza.webp", // pool + terrace with artificial grass strip
  house: "assets/casa-piscina-jardin.webp", // house, deck, pool, lawn with stepping stones
  install: "assets/instalacion-rollo.webp", // installer unrolling grass
  logo: "assets/logo-universalgrass.webp",
};

/* ---------------------------------------------------------------- timeline (frames @25fps) */
export const T = {
  opening: [0, 75], // 0–3 s
  service: [75, 175], // 3–7 s
  spaces: [175, 300], // 7–12 s
  advice: [300, 425], // 12–17 s
  quote: [425, 500], // 17–20 s
  close: [500, 625], // 20–25 s
};

/** Main photo frame: one window that travels through the whole piece. */
const MAIN_MOVES: Move[] = [
  { at: 0, dur: 0, rect: { x: 1040, y: 790, w: 40, h: 720 } },
  { at: 4, dur: 24, rect: { x: 500, y: 790, w: 580, h: 720 } }, // opening: lateral cut-out, bleeds off the right edge
  { at: 66, dur: 22, rect: { x: 0, y: 930, w: W, h: 440 } }, // service: becomes a full-width band
  { at: 166, dur: 18, rect: { x: G.left, y: 300, w: W - G.left * 2, h: 860 } }, // terrazas
  { at: 208, dur: 18, rect: { x: 0, y: 250, w: W, h: 760 } }, // jardines
  { at: 250, dur: 18, rect: { x: 380, y: 640, w: 700, h: 800 } }, // junto a la piscina
  { at: 292, dur: 20, rect: { x: G.left, y: 680, w: W - G.left * 2, h: 700 } }, // cuéntanos tu idea
  { at: 352, dur: 18, rect: { x: G.left, y: 680, w: 428, h: 700 } }, // te ayudamos a elegir (left half)
  { at: 418, dur: 24, rect: { x: 0, y: 0, w: W, h: H } }, // expands to fill the screen → forest green
];

const MAIN_SHOTS: Shot[] = [
  { src: IMG.house, at: 0, pos: "72% 42%", inspiration: true },
  { src: IMG.install, at: 70, dur: 20, pos: "50% 58%", dir: "left", inspiration: true },
  { src: IMG.terrace, at: 168, pos: "94% 70%", dir: "up", inspiration: true },
  { src: IMG.house, at: 210, pos: "50% 86%", dir: "left", inspiration: true },
  { src: IMG.terrace, at: 252, pos: "64% 84%", dir: "down", inspiration: true },
  { src: IMG.terrace, at: 294, pos: "38% 50%", dir: "left", inspiration: true },
  { src: IMG.install, at: 354, pos: "84% 50%", dir: "up", inspiration: true },
];

/** Second frame, only for "Te ayudamos a elegir": the space splits into two details. */
const SIDE_MOVES: Move[] = [
  { at: 0, dur: 0, rect: { x: 984, y: 680, w: 0, h: 700 } },
  { at: 356, dur: 18, rect: { x: 556, y: 680, w: 428, h: 700 } },
  { at: 416, dur: 12, rect: { x: 984, y: 680, w: 0, h: 700 } },
];
const SIDE_SHOTS: Shot[] = [{ src: IMG.terrace, at: 0, pos: "78% 96%", inspiration: true }];

export const UniversalGrassV2 = ({ showSafeZones }: { showSafeZones: boolean }) => {
  const f = useCurrentFrame();
  const L = G.left;

  return (
    <AbsoluteFill style={{ background: C.warm, fontFamily: FONT }}>
      {/* ---------------- frames ---------------- */}
      <PhotoFrame moves={MAIN_MOVES} shots={MAIN_SHOTS} fill={C.forest} fillFrom={420} fillDur={22} label={COPY.inspiration} />
      <PhotoFrame moves={SIDE_MOVES} shots={SIDE_SHOTS} label={COPY.inspiration} />

      {/* ---------------- 0–3 s · opening ---------------- */}
      <Rule top={250} left={L} width={64} inAt={0} outAt={62} />
      <MaskLine top={300} left={L} size={116} inAt={0} outAt={64}>{COPY.opening[0]}</MaskLine>
      <MaskLine top={430} left={L} size={116} color={C.moss} inAt={4} outAt={66}>{COPY.opening[1]}</MaskLine>
      <MaskLine top={560} left={L} size={116} color={C.moss} inAt={8} outAt={68}>{COPY.opening[2]}</MaskLine>

      {/* ---------------- 3–7 s · service ---------------- */}
      <MaskLine top={290} left={L} size={128} inAt={80} outAt={160}>{COPY.service.title[0]}</MaskLine>
      <MaskLine top={420} left={L} size={128} inAt={84} outAt={162}>{COPY.service.title[1]}</MaskLine>
      <MaskLine top={580} left={L} size={80} weight={600} color={C.moss} tracking={-0.03} inAt={92} outAt={162}>{COPY.service.subtitle[0]}</MaskLine>
      <MaskLine top={668} left={L} size={80} weight={600} color={C.moss} tracking={-0.03} inAt={96} outAt={163}>{COPY.service.subtitle[1]}</MaskLine>
      <Rule top={818} left={L} width={40} inAt={106} outAt={162} />
      <MaskLine top={800} left={L + 58} size={40} weight={500} color={C.forest} tracking={-0.01} inAt={106} outAt={164}>{COPY.service.place}</MaskLine>

      {/* ---------------- 7–12 s · spaces (one at a time) ---------------- */}
      <SpaceIndex index={COPY.spaces[0].index} top={1210} inAt={176} outAt={204} />
      <MaskLine top={1260} left={L} size={150} inAt={178} outAt={206}>{COPY.spaces[0].lines[0]}</MaskLine>

      <SpaceIndex index={COPY.spaces[1].index} top={1070} inAt={218} outAt={246} />
      <MaskLine top={1120} left={L} size={150} inAt={220} outAt={248}>{COPY.spaces[1].lines[0]}</MaskLine>

      <SpaceIndex index={COPY.spaces[2].index} top={250} inAt={260} outAt={286} />
      <MaskLine top={300} left={L} size={124} inAt={262} outAt={288}>{COPY.spaces[2].lines[0]}</MaskLine>
      <MaskLine top={428} left={L} size={124} inAt={266} outAt={290}>{COPY.spaces[2].lines[1]}</MaskLine>

      {/* ---------------- 12–17 s · how to start (two steps) ---------------- */}
      <StepTrack f={f} />
      <MaskLine top={390} left={L} size={120} inAt={304} outAt={346}>{COPY.advice[0].lines[0]}</MaskLine>
      <MaskLine top={515} left={L} size={120} inAt={308} outAt={348}>{COPY.advice[0].lines[1]}</MaskLine>
      <MaskLine top={390} left={L} size={120} inAt={360} outAt={410}>{COPY.advice[1].lines[0]}</MaskLine>
      <MaskLine top={515} left={L} size={120} inAt={364} outAt={412}>{COPY.advice[1].lines[1]}</MaskLine>

      {/* ---------------- 17–20 s · quote (on forest green) ---------------- */}
      <MaskLine top={560} left={L} size={100} color={C.warm} inAt={436} outAt={486}>{COPY.quote.title[0]}</MaskLine>
      <MaskLine top={670} left={L} size={100} color={C.warm} inAt={440} outAt={488}>{COPY.quote.title[1]}</MaskLine>
      <Rule top={850} left={L} width={64} inAt={448} outAt={486} />
      <MaskLine top={900} left={L} size={48} weight={500} color={C.sage} tracking={-0.015} inAt={450} outAt={488}>{COPY.quote.detail[0]}</MaskLine>
      <MaskLine top={962} left={L} size={48} weight={500} color={C.sage} tracking={-0.015} inAt={453} outAt={490}>{COPY.quote.detail[1]}</MaskLine>

      {/* ---------------- 20–25 s · close (stable ≥ 4 s) ---------------- */}
      <Close f={f} />

      {showSafeZones && <SafeZones />}
    </AbsoluteFill>
  );
};

function SpaceIndex({ index, top, inAt, outAt }: { index: string; top: number; inAt: number; outAt: number }) {
  return (
    <>
      <MaskLine top={top} left={G.left} size={30} weight={600} color={C.moss} tracking={0.02} inAt={inAt} outAt={outAt} inDur={12}>
        {`${index} / 03`}
      </MaskLine>
      <Rule top={top + 17} left={G.left + 118} width={56} inAt={inAt + 2} outAt={outAt} thickness={3} />
    </>
  );
}

/** Two numbered markers joined by a line that fills as we move from step 1 to step 2. */
function StepTrack({ f }: { f: number }) {
  const show = interpolate(f, [300, 314], [0, 1], { ...clamp, easing: ease.in }) * interpolate(f, [410, 420], [1, 0], clamp);
  if (show <= 0) return null;
  const fillP = interpolate(f, [350, 366], [0, 1], { ...clamp, easing: ease.move });
  const marker = (n: string, active: boolean, x: number) => (
    <div style={{
      position: "absolute", left: x, top: 270, width: 72, height: 72, borderRadius: 36,
      background: active ? C.forest : "transparent", border: `3px solid ${C.forest}`, color: active ? C.warm : C.forest,
      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 32, fontWeight: 600,
    }}>{n}</div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: show, transform: `translateY(${(1 - show) * 12}px)` }}>
      <div style={{ position: "absolute", left: G.left + 72, top: 304, width: 120, height: 4, background: "rgba(30,58,42,0.15)" }} />
      <div style={{ position: "absolute", left: G.left + 72, top: 304, width: 120 * fillP, height: 4, background: C.forest }} />
      {marker("1", true, G.left)}
      {marker("2", fillP > 0.6, G.left + 192)}
    </div>
  );
}

function Close({ f }: { f: number }) {
  if (f < 496) return null;
  const L = G.left;
  const logoP = interpolate(f, [500, 518], [0, 1], { ...clamp, easing: ease.move });
  const ctaP = interpolate(f, [508, 524], [0, 1], { ...clamp, easing: ease.in });
  const logoW = 780;
  return (
    <>
      <div style={{ position: "absolute", left: L - 10, top: 470, width: logoW, clipPath: `inset(0 ${(1 - logoP) * 100}% 0 0)` }}>
        {/* Authentic logo file, used as supplied (no redraw, no recolour). */}
        <Img src={staticFile(IMG.logo)} style={{ width: logoW, display: "block", transform: `translateX(${(1 - logoP) * -24}px)` }} />
      </div>
      <MaskLine top={740} left={L} size={92} color={C.warm} inAt={504}>{COPY.close.lines[0]}</MaskLine>
      <MaskLine top={844} left={L} size={92} color={C.warm} inAt={507}>{COPY.close.lines[1]}</MaskLine>
      <div style={{ position: "absolute", left: L, top: 1040, overflow: "hidden" }}>
        <div style={{
          transform: `translateY(${(1 - ctaP) * 105}%)`, background: C.sage, color: C.forest, fontFamily: FONT, fontSize: 46, fontWeight: 600,
          letterSpacing: "-0.015em", padding: "26px 44px", borderRadius: 999, whiteSpace: "nowrap", lineHeight: 1,
        }}>
          {COPY.close.cta}
        </div>
      </div>
      <Rule top={1198} left={L} width={64} inAt={512} />
      <MaskLine top={1226} left={L} size={52} weight={500} color={C.warm} tracking={-0.01} inAt={512}>{COPY.close.web}</MaskLine>
    </>
  );
}

/** Review overlay: approximate areas covered by Reels / TikTok UI. Never rendered in the final export. */
function SafeZones() {
  const zone = { position: "absolute" as const, background: "rgba(220,40,40,0.18)", border: "2px dashed rgba(220,40,40,0.7)" };
  return (
    <>
      <div style={{ ...zone, left: 0, top: 0, width: W, height: 200 }} />
      <div style={{ ...zone, left: G.textRight, top: 200, width: W - G.textRight, height: H - 200 }} />
      <div style={{ ...zone, left: 0, top: G.textBottom + 40, width: G.textRight, height: H - G.textBottom - 40 }} />
      <div style={{ position: "absolute", left: G.left, top: 0, width: 2, height: H, background: "rgba(40,90,220,0.5)" }} />
    </>
  );
}
