/* eslint-disable @next/next/no-img-element */
import { LOGO_ASPECT, LOGO_ASSET_PROVIDED, LOGO_SRC } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Renders the approved Movo logo from the supplied asset. The logo is never redrawn or typeset.
 * While the asset has not been added (see src/config/brand.ts), a clearly marked placeholder
 * slot of the same proportions is shown instead.
 */
export function Logo({ height = 28, className, tone = "dark" }: { height?: number; className?: string; tone?: "dark" | "light" }) {
  const width = Math.round(height * LOGO_ASPECT);
  if (LOGO_ASSET_PROVIDED) {
    return (
      <img src={LOGO_SRC} alt="Movo" width={width} height={height} className={cn("block select-none", tone === "light" && "invert", className)}
        draggable={false} />
    );
  }
  return (
    <span
      role="img"
      aria-label="Movo (logo pendiente de añadir)"
      title="Logo pendiente: añade el archivo aprobado en public/brand/movo-logo.svg"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full border border-dashed",
        tone === "dark" ? "border-ink/30 text-ink/60" : "border-white/50 text-white/80",
        className,
      )}
      style={{ width, height, fontSize: Math.max(9, height * 0.34) }}
    >
      <span className="font-medium uppercase tracking-[0.14em]">logo</span>
    </span>
  );
}
