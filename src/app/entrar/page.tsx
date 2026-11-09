"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button, Field, Input, IconButton, Chip } from "@/components/ui/kit";
import { useApp } from "@/lib/app-context";
import { BackendError } from "@/lib/backend";
import { errorMessage, t } from "@/i18n";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { backend, status } = useApp();
  const [mode, setMode] = useState<"registro" | "entrar">(params.get("modo") === "entrar" ? "entrar" : "registro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready") router.replace("/inicio");
    if (status === "onboarding") router.replace("/bienvenida");
  }, [status, router]);

  const signUp = mode === "registro";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!backend || busy) return;
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Introduce un correo válido.");
    if (password.length < 8) return setError(t.auth.passwordHint);
    setBusy(true);
    try {
      if (signUp) {
        const r = await backend.auth.signUp(email, password);
        if (r.needsConfirmation) setNotice(t.auth.checkEmail);
      } else {
        await backend.auth.signIn(email, password);
      }
    } catch (err) {
      const code = err instanceof BackendError ? err.code : "generic";
      setError(code === "invalid_credentials" ? t.auth.invalid : errorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ paddingTop: "var(--safe-t)", paddingBottom: "var(--safe-b)" }}>
      <header className="flex items-center gap-2 px-3 pt-3">
        <IconButton label={t.common.back} onClick={() => router.push("/")}><ArrowLeft className="h-5 w-5" /></IconButton>
        <Logo height={24} />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="text-[30px] leading-tight">{signUp ? t.auth.signUpTitle : t.auth.signInTitle}</h1>
        {backend?.mode === "demo" && (
          <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-[13px] text-[#6b4a0f]">
            <Chip tone="sun" className="mb-1 bg-white/60">{t.demo.badge}</Chip><br />{t.demo.passwordNote}
          </p>
        )}

        {backend?.auth.googleEnabled && (
          <>
            <Button variant="secondary" size="lg" full className="mt-6" icon={<GoogleMark />}
              onClick={() => backend.auth.signInWithGoogle().catch(() => setError(t.errors.generic))}>
              {t.auth.google}
            </Button>
            <div className="my-5 flex items-center gap-3 text-[13px] text-ink-2"><span className="h-px flex-1 bg-line-strong" />{t.common.or}<span className="h-px flex-1 bg-line-strong" /></div>
          </>
        )}

        <form onSubmit={submit} className={backend?.auth.googleEnabled ? "space-y-4" : "mt-6 space-y-4"} noValidate>
          <Field label={t.auth.email} htmlFor="email">
            <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t.auth.password} htmlFor="password" hint={signUp ? t.auth.passwordHint : undefined}>
            <Input id="password" type="password" autoComplete={signUp ? "new-password" : "current-password"} value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          {error && <p role="alert" className="rounded-xl bg-pass-soft px-3 py-2 text-[14px] text-[#a3302b]">{error}</p>}
          {notice && <p role="status" className="flex gap-2 rounded-xl bg-connect-soft px-3 py-2 text-[14px] text-[#136b4a]"><Mail className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
          <Button type="submit" size="lg" full loading={busy}>{signUp ? t.auth.signUp : t.auth.signIn}</Button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-[14px]">
          <button className="font-semibold text-ink underline-offset-4 hover:underline" onClick={() => { setMode(signUp ? "entrar" : "registro"); setError(null); }}>
            {signUp ? t.auth.switchToSignIn : t.auth.switchToSignUp}
          </button>
          {!signUp && backend?.mode === "live" && (
            <button className="text-ink-2 underline-offset-4 hover:underline" onClick={async () => {
              if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Escribe tu correo arriba.");
              await backend.auth.resetPassword(email); setNotice(t.auth.resetSent);
            }}>{t.auth.forgot}</button>
          )}
        </div>
        <p className="mt-8 text-center text-[13px] text-ink-2">{t.auth.terms} <Link href="/normas" className="underline">Leer normas</Link></p>
      </main>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>;
}
