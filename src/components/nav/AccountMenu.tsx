"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRound, Settings, UsersRound, FolderKanban, Trophy, LogOut, RotateCcw, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet, ConfirmSheet } from "@/components/ui/kit";
import { useApp } from "@/lib/app-context";
import { t } from "@/i18n";

export function AccountMenuButton({ size = "sm" as const }: { size?: "sm" | "md" }) {
  const { me } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t.nav.menu} aria-haspopup="dialog"
        className="rounded-full transition active:scale-95 focus-visible:outline-offset-2">
        <Avatar src={me?.avatar_url} name={me?.display_name} size={size} ring />
      </button>
      <AccountSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, backend } = useApp();
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const items = [
    { href: me?.username ? `/u/${me.username}` : "/ajustes", label: t.nav.profile, icon: UserRound },
    { href: "/amigos", label: t.nav.friends, icon: UsersRound },
    { href: "/proyectos?tab=mine", label: t.nav.projects, icon: FolderKanban },
    { href: "/ranking", label: t.nav.ranking, icon: Trophy },
    { href: "/ajustes", label: t.nav.settings, icon: Settings },
  ];
  return (
    <>
      <Sheet open={open} onClose={onClose} title={me?.display_name ?? t.nav.menu}>
        {me?.username && <p className="-mt-1 mb-4 text-[14px] text-ink-2">@{me.username}</p>}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl hairline">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={onClose} className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium hover:bg-fill">
                <Icon className="h-5 w-5 text-ink-2" aria-hidden /> <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2">
          <button onClick={async () => { onClose(); await backend?.auth.signOut(); router.replace("/"); }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-ink hover:bg-fill">
            <LogOut className="h-5 w-5 text-ink-2" aria-hidden /> {t.nav.signOut}
          </button>
          {backend?.mode === "demo" && (
            <button onClick={() => setResetOpen(true)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-pass hover:bg-pass-soft">
              <RotateCcw className="h-5 w-5" aria-hidden /> {t.demo.reset}
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={resetOpen} onClose={() => setResetOpen(false)} title={t.demo.reset} body={t.demo.resetConfirm} confirmLabel={t.demo.reset} danger
        onConfirm={async () => { await backend?.resetDemo?.(); window.location.href = "/"; }} />
    </>
  );
}
