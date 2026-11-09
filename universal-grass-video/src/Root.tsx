import { Composition } from "remotion";
import { UniversalGrassV2 } from "./UniversalGrassV2";
import { FPS, DURATION, W, H } from "./theme";

export const Root = () => (
  <>
    <Composition id="UniversalGrassV2" component={UniversalGrassV2} durationInFrames={DURATION} fps={FPS} width={W} height={H}
      defaultProps={{ showSafeZones: false }} />
    {/* Same composition with the Reels/TikTok safe-zone guide overlaid, for review only. */}
    <Composition id="UniversalGrassV2-SafeZones" component={UniversalGrassV2} durationInFrames={DURATION} fps={FPS} width={W} height={H}
      defaultProps={{ showSafeZones: true }} />
  </>
);
