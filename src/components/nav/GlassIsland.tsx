"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { House, Compass, UsersRound, MessageCircle, type LucideIcon } from "lucide-react";
import { t } from "@/i18n";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/cn";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/inicio", label: t.nav.home, icon: House, match: (p) => p.startsWith("/inicio") },
  { href: "/descubrir", label: t.nav.discover, icon: Compass, match: (p) => p.startsWith("/descubrir") },
  { href: "/grupos", label: t.nav.groups, icon: UsersRound, match: (p) => p.startsWith("/grupos") },
  { href: "/chats", label: t.nav.chats, icon: MessageCircle, match: (p) => p.startsWith("/chats") },
];

/**
 * Floating glass island (mobile/tablet). Detached from edges, respects safe areas,
 * animated capsule for the active destination, opaque fallback when blur is unsupported.
 */
export function GlassIsland() {
  const pathname = usePathname();
  const { unread } = useApp();
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.9 };

  return (
    <nav
      aria-label={t.nav.main}
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 lg:hidden"
      style={{ bottom: "calc(var(--safe-b) + var(--island-gap))" }}
    >
      <ul className="glass-island pointer-events-auto flex h-[var(--island-h)] w-full max-w-[400px] items-center gap-1 rounded-full p-1.5">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const badge = item.href === "/chats" && unread > 0 ? unread : 0;
          return (
            <motion.li key={item.href} layout transition={spring} className={cn("relative h-full", active ? "flex-[1.85]" : "flex-1")}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? `${item.label}, ${badge} sin leer` : item.label}
                className="group relative flex h-full w-full items-center justify-center rounded-full outline-offset-[-2px]"
              >
                {active && (
                  <motion.span
                    layoutId="island-capsule"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-ink shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)]"
                  />
                )}
                <motion.span
                  className={cn("relative z-10 flex items-center gap-2", active ? "text-white" : "text-ink/70 group-hover:text-ink")}
                  whileTap={reduce ? undefined : { scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                >
                  <motion.span
                    key={active ? "on" : "off"}
                    initial={reduce || !active ? false : { scale: 0.7, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="relative flex"
                  >
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 2} aria-hidden />
                    {badge > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pass px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </motion.span>
                  {active && (
                    <motion.span
                      initial={reduce ? false : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reduce ? 0 : 0.08, duration: 0.18 }}
                      className="whitespace-nowrap text-[14px] font-semibold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </motion.span>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </nav>
  );
}
