"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Portrait } from "@/components/ui/Portrait";
import { useResolvedUrl, useMediaQuery } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

export interface TableItem {
  id: string;
  name: string | null;
  label: string;
  avatar: string | null; // "gen:<seed>" or storage ref
  username?: string | null;
}

/** Slot = centre position (% of the table), depth scale, base rotation, drift timing. */
interface Slot { x: number; y: number; s: number; r: number; dur: number; delay: number; alt?: boolean; tape?: boolean }

// Hand-tuned so cards never cover each other, their captions, or the central button.
const SLOTS_MOBILE: Slot[] = [
  { x: 18, y: 16, s: 0.96, r: -7, dur: 9.5, delay: 0, tape: true },
  { x: 52, y: 12, s: 0.8, r: 3, dur: 11, delay: -3, alt: true },
  { x: 83, y: 19, s: 1, r: 6, dur: 10, delay: -6 },
  { x: 14, y: 50, s: 0.84, r: 4, dur: 12, delay: -2, alt: true },
  { x: 86, y: 52, s: 0.9, r: -5, dur: 9, delay: -5, tape: true },
  { x: 24, y: 84, s: 1, r: 5, dur: 10.5, delay: -1 },
  { x: 58, y: 87, s: 0.8, r: -3, dur: 12.5, delay: -7, alt: true },
  { x: 86, y: 84, s: 0.92, r: -6, dur: 9.8, delay: -4 },
];
const SLOTS_DESKTOP: Slot[] = [
  { x: 12, y: 20, s: 0.92, r: -7, dur: 9.5, delay: 0, tape: true },
  { x: 34, y: 14, s: 0.8, r: 4, dur: 11, delay: -3, alt: true },
  { x: 60, y: 15, s: 0.86, r: -3, dur: 10, delay: -6 },
  { x: 86, y: 20, s: 1, r: 6, dur: 10.5, delay: -2, tape: true },
  { x: 8, y: 54, s: 0.84, r: 5, dur: 12, delay: -5, alt: true },
  { x: 92, y: 58, s: 0.9, r: -5, dur: 9, delay: -1 },
  { x: 20, y: 84, s: 1, r: 4, dur: 10, delay: -4 },
  { x: 42, y: 86, s: 0.8, r: -4, dur: 12.5, delay: -7, alt: true },
  { x: 66, y: 84, s: 0.94, r: 3, dur: 11.5, delay: -2.5, tape: true },
];

// Square layout with smaller cards (welcome screen on phones, where the CTA must stay visible).
const SLOTS_COMPACT: Slot[] = [
  { x: 17, y: 17, s: 0.95, r: -7, dur: 9.5, delay: 0, tape: true },
  { x: 50, y: 13, s: 0.82, r: 3, dur: 11, delay: -3, alt: true },
  { x: 83, y: 17, s: 1, r: 6, dur: 10, delay: -6 },
  { x: 12, y: 52, s: 0.86, r: 4, dur: 12, delay: -2, alt: true },
  { x: 88, y: 52, s: 0.9, r: -5, dur: 9, delay: -5, tape: true },
  { x: 24, y: 84, s: 1, r: 5, dur: 10.5, delay: -1 },
  { x: 55, y: 87, s: 0.82, r: -3, dur: 12.5, delay: -7, alt: true },
  { x: 85, y: 84, s: 0.92, r: -6, dur: 9.8, delay: -4 },
];

const TAPE = ["rgba(242,193,78,0.55)", "rgba(207,224,240,0.75)", "rgba(242,208,214,0.75)"];

export function CreatorTable({
  items, onOpen, center, emptyMessage, interactive = true, cycleMs = 4200, ariaLabel = t.home.tableTitle, compact = false,
}: {
  compact?: boolean;
  items: TableItem[];
  onOpen?: (item: TableItem) => void;
  center: ReactNode;
  emptyMessage?: string;
  interactive?: boolean;
  cycleMs?: number;
  ariaLabel?: string;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const reduce = useReducedMotion();
  const slots = desktop ? SLOTS_DESKTOP : compact ? SLOTS_COMPACT : SLOTS_MOBILE;
  const cardWidth = desktop ? "17.8cqw" : compact ? "23cqw" : "29cqw";

  // Which pool index sits in each slot.
  const [assign, setAssign] = useState<number[]>([]);
  const nextRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    const n = Math.min(slots.length, items.length);
    setAssign(Array.from({ length: n }, (_, i) => i));
    nextRef.current = n;
  }, [items, slots.length]);

  const pause = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
  }, []);
  const scheduleResume = useCallback((ms = 2600) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), ms);
  }, []);
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  // Periodically swap one card for a profile not currently on the table.
  useEffect(() => {
    if (reduce || paused || items.length <= assign.length || assign.length === 0) return;
    const iv = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setAssign((cur) => {
        if (cur.length === 0) return cur;
        const slot = Math.floor(Math.random() * cur.length);
        const shown = new Set(cur);
        let idx = nextRef.current % items.length;
        let guard = 0;
        while (shown.has(idx) && guard++ < items.length) idx = (idx + 1) % items.length;
        nextRef.current = idx + 1;
        if (shown.has(idx)) return cur;
        const copy = [...cur];
        copy[slot] = idx;
        return copy;
      });
    }, cycleMs);
    return () => clearInterval(iv);
  }, [reduce, paused, items.length, assign.length, cycleMs]);

  const cards = useMemo(() => assign.map((poolIdx, slotIdx) => ({ slot: slots[slotIdx], item: items[poolIdx], slotIdx })).filter((c) => c.item && c.slot), [assign, items, slots]);

  return (
    <section
      aria-label={ariaLabel}
      className={cn("relative mx-auto w-full select-none [container-type:inline-size]", paused && "table-paused")}
      style={{ aspectRatio: desktop ? "19 / 13.5" : compact ? "1 / 1" : "9 / 11" }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse" && interactive) pause(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") scheduleResume(900); }}
      onPointerDown={() => { if (interactive) pause(); }}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") scheduleResume(); }}
      onFocusCapture={pause}
      onBlurCapture={() => scheduleResume()}
    >
      {cards.map(({ slot, item, slotIdx }) => (
        <div
          key={slotIdx}
          className="absolute"
          style={{
            left: `${slot.x}%`, top: `${slot.y}%`,
            width: cardWidth,
            transform: `translate(-50%, -50%) scale(${slot.s})`,
            zIndex: dragging === item.id ? 30 : Math.round(slot.s * 10),
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={item.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82, y: 14 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: -10, transition: { duration: 0.45 } }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                drag={interactive}
                dragSnapToOrigin
                dragElastic={0.55}
                dragTransition={{ bounceStiffness: 260, bounceDamping: 18 }}
                whileDrag={{ scale: 1.07, cursor: "grabbing" }}
                onDragStart={() => { draggedRef.current = true; setDragging(item.id); pause(); }}
                onDragEnd={() => { setDragging(null); scheduleResume(); setTimeout(() => { draggedRef.current = false; }, 80); }}
                className={cn(interactive && "cursor-grab touch-none")}
              >
                <div
                  className={cn(!reduce && "drift", slot.alt && "alt")}
                  style={{ ["--rot" as string]: `${slot.r}deg`, ["--dur" as string]: `${slot.dur}s`, ["--delay" as string]: `${slot.delay}s`, transform: `rotate(${slot.r}deg)` }}
                >
                  <PolaroidCard item={item} tape={slot.tape ? TAPE[slotIdx % TAPE.length] : undefined} depth={slot.s}
                    onOpen={interactive && onOpen ? () => { if (!draggedRef.current) onOpen(item); } : undefined} />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      ))}

      {/* Central action: stable, never drifts. */}
      <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        {center}
        {items.length === 0 && emptyMessage && (
          <p className="mt-4 w-[62cqw] max-w-[320px] text-center text-[14px] text-ink-2 text-balance">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function PolaroidCard({ item, onOpen, tape, depth }: { item: TableItem; onOpen?: () => void; tape?: string; depth: number }) {
  const url = useResolvedUrl(item.avatar && !item.avatar.startsWith("gen:") ? item.avatar : null, "avatars");
  const shadow = depth > 0.93 ? "var(--shadow-lg)" : depth > 0.85 ? "var(--shadow-md)" : "0 4px 12px -4px rgba(16,24,40,0.16)";
  const Body = (
    <>
      {tape && <span aria-hidden className="absolute -top-[5%] left-1/2 h-[9%] w-[38%] -translate-x-1/2 rotate-[-4deg] rounded-[2px]" style={{ background: tape }} />}
      <span className="block aspect-square w-full overflow-hidden rounded-[7%] bg-fill">
        {item.avatar?.startsWith("gen:") ? (
          <Portrait seed={item.avatar.slice(4)} className="h-full w-full" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" draggable={false} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <Portrait seed={item.id} className="h-full w-full" />
        )}
      </span>
      <span className="block px-[3%] pb-[2%] pt-[6%] text-left">
        {item.name && <span className="block truncate font-display text-[clamp(11px,3.6cqw,15px)] font-semibold leading-tight text-ink md:text-[clamp(11px,1.9cqw,15px)]">{item.name}</span>}
        <span className="mt-[2px] line-clamp-2 text-[clamp(10px,3.1cqw,13px)] leading-tight text-ink-2 md:text-[clamp(10px,1.6cqw,13px)]">{item.label}</span>
      </span>
    </>
  );
  const cls = "relative block w-full rounded-[9%] bg-card p-[6%] text-left ring-1 ring-black/[0.04]";
  return onOpen ? (
    <button type="button" onClick={onOpen} draggable={false}
      aria-label={`${item.name ?? ""}, ${item.label}. ${t.discover.viewProfile}`} className={cls} style={{ boxShadow: shadow }}>
      {Body}
    </button>
  ) : (
    <div className={cls} style={{ boxShadow: shadow }} aria-hidden>{Body}</div>
  );
}
