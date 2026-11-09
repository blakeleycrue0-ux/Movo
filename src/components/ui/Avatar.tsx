"use client";

import { Portrait, CoverArt } from "./Portrait";
import { useResolvedUrl } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { Users } from "lucide-react";

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 88, "2xl": 120 } as const;

export function Avatar({ src, name, size = "md", className, ring }: {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const px = SIZES[size];
  const url = useResolvedUrl(src && !src.startsWith("gen:") ? src : null, "avatars");
  const initials = (name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-fill-strong align-middle", ring && "ring-2 ring-white", className)}
      style={{ width: px, height: px }}
    >
      {src?.startsWith("gen:") ? (
        <Portrait seed={src.slice(4)} className="h-full w-full" />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={px} height={px} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-semibold text-ink-2" style={{ fontSize: px * 0.38 }} aria-hidden>
          {initials}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Square-ish image for a group. */
export function GroupImage({ src, name, size = 44, className }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  const url = useResolvedUrl(src && !src.startsWith("gen:") ? src : null);
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] bg-fill-strong", className)}
      style={{ width: size, height: size }} aria-hidden>
      {src?.startsWith("gen:") ? (
        <CoverArt seed={src.slice(4)} className="h-full w-full" />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Users className="text-ink-2" style={{ width: size * 0.45, height: size * 0.45 }} />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function ProjectCover({ src, seed, className }: { src: string | null | undefined; seed: string; className?: string }) {
  const url = useResolvedUrl(src && !src.startsWith("gen:") ? src : null);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cn("h-full w-full object-cover", className)} loading="lazy" decoding="async" />;
  }
  return <CoverArt seed={src?.startsWith("gen:") ? src.slice(4) : seed} className={cn("h-full w-full", className)} />;
}
