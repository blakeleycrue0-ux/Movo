"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { Splash } from "@/components/Splash";
import { Sidebar } from "@/components/nav/Sidebar";
import { GlassIsland } from "@/components/nav/GlassIsland";

/** Authenticated app shell. Redirects visitors and unfinished onboarding (UX only — the server enforces access). */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, bootError } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  // Conversation threads and call rooms use the full height; the island would cover the composer.
  const immersive = /^\/chats\/[^/]+/.test(pathname) || pathname.startsWith("/llamada");

  useEffect(() => {
    if (status === "signedOut") router.replace("/");
    if (status === "onboarding") router.replace("/bienvenida");
  }, [status, router]);

  if (status !== "ready") return <Splash error={status === "error" ? bootError : null} />;

  return (
    <>
      <Sidebar />
      <main className={immersive ? "lg:pl-[248px]" : "pb-island lg:pl-[248px]"}>{children}</main>
      {!immersive && <GlassIsland />}
    </>
  );
}
