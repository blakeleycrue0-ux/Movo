"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { BackendError, type Bucket } from "@/lib/backend";

export interface QueryState<T> {
  data: T | undefined;
  error: BackendError | null;
  loading: boolean;
  refetch: () => Promise<void>;
  setData: (fn: (d: T | undefined) => T | undefined) => void;
}

/** Calls an API function and tracks loading/error. Refetches when `fn`/`args` change. */
export function useRpc<T>(fn: string | null, args: Record<string, unknown> = {}, opts: { refetchOnFocus?: boolean } = {}): QueryState<T> {
  const { backend } = useApp();
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<BackendError | null>(null);
  const [loading, setLoading] = useState(true);
  const key = fn ? `${fn}:${JSON.stringify(args)}` : null;
  const reqId = useRef(0);

  const run = useCallback(async () => {
    if (!backend || !fn) return;
    const id = ++reqId.current;
    setError(null);
    try {
      const r = await backend.call<T>(fn, args);
      if (id === reqId.current) setDataState(r);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof BackendError ? e : new BackendError("generic"));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, key]);

  useEffect(() => {
    setLoading(true);
    void run();
  }, [run]);

  useEffect(() => {
    if (!opts.refetchOnFocus) return;
    const onFocus = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [run, opts.refetchOnFocus]);

  const setData = useCallback((f: (d: T | undefined) => T | undefined) => setDataState((d) => f(d)), []);
  return { data, error, loading, refetch: run, setData };
}

/** Wraps a mutation with a busy flag that blocks double submission. */
export function useAction() {
  const { backend, toastError } = useApp();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(async <T,>(fn: string, args: Record<string, unknown> = {}, opts: { silent?: boolean } = {}): Promise<T | undefined> => {
    if (!backend || busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      return await backend.call<T>(fn, args);
    } catch (e) {
      if (!opts.silent) toastError(e);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [backend, toastError]);
  return { run, busy };
}

/** Resolves a stored file reference ("storage:…" or an attachment path) to a URL. */
export function useResolvedUrl(ref: string | null | undefined, bucket?: Bucket) {
  const { backend } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!ref || !backend || ref.startsWith("gen:")) { setUrl(null); return; }
    backend.storage.resolve(ref, bucket).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [ref, bucket, backend]);
  return url;
}

export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [q]);
  return match;
}
