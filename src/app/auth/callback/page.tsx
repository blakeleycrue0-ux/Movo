"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { Splash } from "@/components/Splash";

/** OAuth / email-confirmation landing. The Supabase client exchanges the code automatically (PKCE). */
export default function AuthCallback() {
  const { status } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (status === "ready") router.replace("/inicio");
    else if (status === "onboarding") router.replace("/bienvenida");
    else if (status === "signedOut") {
      const tmo = setTimeout(() => router.replace("/entrar?modo=entrar"), 4000);
      return () => clearTimeout(tmo);
    }
  }, [status, router]);
  return <Splash />;
}
