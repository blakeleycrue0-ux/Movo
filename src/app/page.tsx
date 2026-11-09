"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CreatorTable, type TableItem } from "@/components/home/CreatorTable";
import { Chip } from "@/components/ui/kit";
import { Splash } from "@/components/Splash";
import { useApp } from "@/lib/app-context";
import { t } from "@/i18n";

// Decorative illustrations: activity labels only, no invented names or counts.
const ILLUSTRATIVE: TableItem[] = [
  "Creando una app", "Busca editor", "Canal faceless", "Diseño de marca", "Aprende a editar",
  "Lanza su web", "Música", "Busca feedback", "Ilustración", "Animación 3D",
].map((label, i) => ({ id: `ill-${i}`, name: null, label, avatar: `gen:welcome-${i * 7 + 3}` }));

export default function Welcome() {
  const { status, backend } = useApp();
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (status === "ready") router.replace("/inicio");
    if (status === "onboarding") router.replace("/bienvenida");
  }, [status, router]);

  if (status === "booting" || status === "ready" || status === "onboarding") return <Splash />;

  const fade = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden" style={{ paddingTop: "var(--safe-t)", paddingBottom: "var(--safe-b)" }}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 md:px-8">
        <Logo height={30} />
        {backend?.mode === "demo" && <Chip tone="sun">{t.demo.badge}</Chip>}
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-2 px-4 pb-8 md:grid-cols-[1fr_1.15fr] md:gap-10 md:px-8">
        <div className="order-2 px-1 text-center md:order-1 md:text-left">
          <motion.h1 {...fade(0.1)} className="mx-auto max-w-md text-[32px] leading-[1.08] text-balance md:mx-0 md:text-[52px]">
            {t.welcome.tagline}
          </motion.h1>
          <motion.p {...fade(0.2)} className="mx-auto mt-4 max-w-md text-[16px] text-ink-2 text-balance md:mx-0 md:text-[17px]">
            {t.welcome.sub}
          </motion.p>
          <motion.div {...fade(0.3)} className="mt-7 flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-5">
            <Link href="/entrar?modo=registro"
              className="inline-flex h-[54px] w-full max-w-xs items-center justify-center gap-2 rounded-full bg-ink px-7 text-[16px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#33363a] active:scale-[0.98] md:w-auto">
              {t.welcome.cta} <ArrowRight className="h-4.5 w-4.5" aria-hidden />
            </Link>
            <Link href="/entrar?modo=entrar" className="rounded-full px-4 py-2 text-[15px] font-semibold text-ink underline-offset-4 hover:underline">
              {t.welcome.haveAccount}
            </Link>
          </motion.div>
          {backend?.mode === "demo" && (
            <p className="mx-auto mt-6 max-w-md rounded-2xl bg-sun-soft px-4 py-3 text-left text-[13px] text-[#6b4a0f] md:mx-0">{t.demo.banner}</p>
          )}
        </div>

        <div className="order-1 md:order-2">
          <CreatorTable
            items={ILLUSTRATIVE}
            interactive
            compact
            ariaLabel="Ilustración de tarjetas de creadores"
            center={
              <div className="flex h-[22cqw] max-h-[104px] w-[22cqw] max-w-[104px] items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-black/5 md:h-[14cqw] md:w-[14cqw]">
                <Logo height={18} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
