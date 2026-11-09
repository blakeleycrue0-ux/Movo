"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBackend, type Backend, type Session, BackendError } from "@/lib/backend";
import type { Me } from "@/lib/types";
import { errorMessage, t } from "@/i18n";

export type AppStatus = "booting" | "signedOut" | "onboarding" | "ready" | "error";

interface Toast {
  id: number;
  text: string;
  tone: "neutral" | "success" | "error";
  action?: { label: string; onClick: () => void };
}

interface AppCtx {
  backend: Backend | null;
  status: AppStatus;
  session: Session | null;
  me: Me | null;
  online: boolean;
  unread: number;
  refreshMe: () => Promise<Me | null>;
  refreshUnread: () => void;
  toast: (text: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  toastError: (e: unknown) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  bootError: string | null;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<AppStatus>("booting");
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [online, setOnline] = useState(true);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "neutral", action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), action ? 6000 : 3800);
  }, []);
  const toastError = useCallback((e: unknown) => {
    toast(errorMessage(e instanceof BackendError ? e.code : "generic"), "error");
  }, [toast]);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const loadMe = useCallback(async (b: Backend, s: Session | null) => {
    if (!s) {
      setMe(null);
      setStatus("signedOut");
      return null;
    }
    try {
      const m = await b.call<Me>("me");
      setMe(m);
      setStatus(m.onboarding_completed ? "ready" : "onboarding");
      return m;
    } catch (e) {
      if (e instanceof BackendError && e.code === "not_authenticated") {
        setStatus("signedOut");
        return null;
      }
      setBootError(errorMessage(e instanceof BackendError ? e.code : "generic"));
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const b = await getBackend();
        if (cancelled) return;
        setBackend(b);
        const s = await b.auth.getSession();
        setSession(s);
        await loadMe(b, s);
        off = b.auth.onChange((ns) => {
          setSession(ns);
          void loadMe(b, ns);
        });
      } catch (e) {
        console.error(e);
        setBootError(t.errors.generic);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [loadMe]);

  // Online / offline
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const goOnline = () => { update(); toast(t.common.backOnline, "success"); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", update);
    };
  }, [toast]);

  const refreshUnread = useCallback(() => {
    if (!backend || status !== "ready") return;
    backend.call<{ unread: number; muted: boolean }[]>("list_conversations")
      .then((list) => setUnread(list.filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0)))
      .catch(() => {});
  }, [backend, status]);

  useEffect(() => {
    if (!backend || status !== "ready") return;
    refreshUnread();
    const off = backend.realtime.inbox({ onChange: refreshUnread });
    const iv = setInterval(refreshUnread, 30000);
    return () => { off(); clearInterval(iv); };
  }, [backend, status, refreshUnread]);

  const refreshMe = useCallback(async () => (backend ? loadMe(backend, session) : null), [backend, session, loadMe]);

  const value = useMemo<AppCtx>(() => ({
    backend, status, session, me, online, unread, refreshMe, refreshUnread, toast, toastError, toasts, dismissToast, bootError,
  }), [backend, status, session, me, online, unread, refreshMe, refreshUnread, toast, toastError, toasts, dismissToast, bootError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
