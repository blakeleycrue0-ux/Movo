// Renders the six review keyframes straight from the composition that will be animated.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const KEYFRAMES = [
  { name: "1-apertura", frame: 50 },
  { name: "2-servicio", frame: 150 },
  { name: "3-aplicaciones", frame: 240 },
  { name: "4-asesoramiento", frame: 395 },
  { name: "5-presupuesto", frame: 475 },
  { name: "6-cierre", frame: 600 },
];
const extra = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const outDir = path.resolve("out/stills");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const id of ["UniversalGrassV2", "UniversalGrassV2-SafeZones"]) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const list = extra.length ? extra.map((f) => ({ name: `f${f}`, frame: f })) : KEYFRAMES;
  for (const k of list) {
    const output = path.join(outDir, `${id === "UniversalGrassV2" ? "" : "safe-"}${k.name}.png`);
    await renderStill({ serveUrl, composition, frame: k.frame, output, browserExecutable });
    console.log(output);
  }
}
