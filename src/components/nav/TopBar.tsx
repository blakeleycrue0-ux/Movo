"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { IconButton, Chip } from "@/components/ui/kit";
import { AccountMenuButton } from "./AccountMenu";
import { useApp } from "@/lib/app-context";
import { t } from "@/i18n";

/** Mobile top bar for main destinations: logo, friends, avatar (profile & settings). */
export function TopBar({ requests = 0 }: { requests?: number }) {
  const { backend } = useApp();
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-line lg:hidden" style={{ paddingTop: "var(--safe-t)" }}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        <Link href="/inicio" aria-label={`${t.meta.title} – ${t.nav.home}`} className="mr-auto flex items-center gap-2">
          <Logo height={24} />
          {backend?.mode === "demo" && <Chip tone="sun" className="text-[12px]">{t.demo.badge}</Chip>}
        </Link>
        <Link href="/amigos" aria-label={requests ? `${t.nav.friends}, ${requests} pendientes` : t.nav.friends}
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-fill">
          <UserPlus className="h-5 w-5" aria-hidden />
          {requests > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-pass ring-2 ring-bg" />}
        </Link>
        <AccountMenuButton />
      </div>
    </header>
  );
}

/** Header for detail pages: back button, title, optional actions. Sticky on all sizes. */
export function PageHeader({ title, subtitle, actions, back, leading }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string | true; leading?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-line" style={{ paddingTop: "var(--safe-t)" }}>
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3 lg:max-w-4xl lg:px-6">
        {back && (
          <IconButton label={t.common.back} onClick={() => (typeof back === "string" ? router.push(back) : window.history.length > 1 ? router.back() : router.push("/inicio"))}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        )}
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] leading-tight">{title}</h1>
          {subtitle && <div className="truncate text-[13px] text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}
