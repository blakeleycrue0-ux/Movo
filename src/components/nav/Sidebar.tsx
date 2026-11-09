"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FolderKanban, Trophy, UserPlus, ChevronsUpDown } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/kit";
import { NAV_ITEMS } from "./GlassIsland";
import { AccountSheet } from "./AccountMenu";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

const SECONDARY = [
  { href: "/proyectos", label: t.nav.projects, icon: FolderKanban, match: (p: string) => p.startsWith("/proyectos") },
  { href: "/ranking", label: t.nav.ranking, icon: Trophy, match: (p: string) => p.startsWith("/ranking") },
  { href: "/amigos", label: t.nav.friends, icon: UserPlus, match: (p: string) => p.startsWith("/amigos") },
];

/** Desktop navigation rail (lg and up). */
export function Sidebar() {
  const pathname = usePathname();
  const { me, unread, backend } = useApp();
  const reduce = useReducedMotion();
  const [menu, setMenu] = useState(false);

  const item = (it: { href: string; label: string; icon: typeof FolderKanban; match: (p: string) => boolean }, badge = 0) => {
    const active = it.match(pathname);
    const Icon = it.icon;
    return (
      <li key={it.href}>
        <Link href={it.href} aria-current={active ? "page" : undefined}
          className={cn("relative flex h-11 items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}>
          {active && <motion.span layoutId="sidebar-capsule" className="absolute inset-0 rounded-full bg-card shadow-sm hairline"
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
          <Icon className="relative h-5 w-5" strokeWidth={active ? 2.3 : 2} aria-hidden />
          <span className="relative flex-1">{it.label}</span>
          {badge > 0 && <span className="relative rounded-full bg-pass px-2 py-0.5 text-[12px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
        </Link>
      </li>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-bg px-4 py-6 lg:flex" aria-label={t.nav.main}>
      <Link href="/inicio" className="mb-8 flex items-center gap-2 px-3" aria-label={`${t.meta.title} – ${t.nav.home}`}>
        <Logo height={30} />
      </Link>
      <ul className="space-y-1">{NAV_ITEMS.map((it) => item(it, it.href === "/chats" ? unread : 0))}</ul>
      <div className="mx-3 my-5 h-px bg-line" />
      <ul className="space-y-1">{SECONDARY.map((it) => item(it))}</ul>
      <div className="mt-auto space-y-3">
        {backend?.mode === "demo" && <div className="px-3"><Chip tone="sun">{t.demo.badge}</Chip></div>}
        <button onClick={() => setMenu(true)} aria-haspopup="dialog" aria-label={t.nav.menu}
          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-card hover:shadow-sm">
          <Avatar src={me?.avatar_url} name={me?.display_name} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{me?.display_name}</span>
            <span className="block truncate text-[13px] text-ink-2">@{me?.username}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-ink-3" aria-hidden />
        </button>
      </div>
      <AccountSheet open={menu} onClose={() => setMenu(false)} />
    </aside>
  );
}
