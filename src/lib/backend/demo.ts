"use client";

/**
 * Demo backend — explicitly labelled, fictional, browser-only.
 *
 * Runs the real Movo migrations inside PGlite (Postgres compiled to WebAssembly), so every rule
 * (allowance, matching, permissions, caps, ranking) behaves exactly as in production. Data lives
 * in this browser's IndexedDB under a demo-only database name and never touches Supabase.
 *
 * Simulated behaviour (always labelled in the UI):
 *   - Some fictional people have already chosen "Conectar" on new demo accounts, so matches happen.
 *   - Fictional people send short canned replies to direct messages.
 *   - Connection requests sent to fictional people are accepted after a short delay.
 * Calls are never simulated.
 */
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Message } from "@/lib/types";
import { DEMO_SQL, DEMO_SQL_VERSION } from "@/lib/demo/sql.generated";
import { seedDemo, DEMO_EMAIL_DOMAIN, onDemoAccountCreated, simulatedReply } from "@/lib/demo/seed";
import { type Backend, type Bucket, BackendError, isValidFnName, toBackendError, type Session, type RealtimeHandlers } from "./types";

const SESSION_KEY = "movo-demo-session";
const DB_NAME = `idb://movo-demo-${DEMO_SQL_VERSION}`;

type Listener = (payload?: unknown) => void;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable: session lasts for this tab only */ }
}

export function createDemoBackend(): Backend {
  let dbPromise: Promise<PGlite> | null = null;
  let simulated = new Set<string>();
  let session: Session | null = typeof window !== "undefined" ? readSession() : null;
  const authListeners = new Set<(s: Session | null) => void>();
  const channels = new Map<string, Set<Listener>>();
  const fileCache = new Map<string, string>();

  const emit = (channel: string, payload?: unknown) => channels.get(channel)?.forEach((l) => l(payload));
  const on = (channel: string, l: Listener) => {
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel)!.add(l);
    return () => channels.get(channel)?.delete(l);
  };

  async function openDb(name: string) {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create(name);
    const ready = await db.query<{ ok: boolean }>("select to_regclass('demo.meta') is not null as ok");
    if (!ready.rows[0].ok) {
      await db.exec(DEMO_SQL);
      await db.exec(`
        create schema demo;
        create table demo.meta (key text primary key, value text);
        create table demo.files (path text primary key, mime text not null, data text not null, created_at timestamptz default now());
      `);
      await seedDemo(db, asUserOn(db));
      await db.query("insert into demo.meta values ('seeded_at', now()::text)");
    }
    const sim = await db.query<{ id: string }>("select id from auth.users where email like $1", [`%@${DEMO_EMAIL_DOMAIN}`]);
    simulated = new Set(sim.rows.map((r) => r.id));
    return db;
  }

  function getDb() {
    if (!dbPromise) {
      dbPromise = openDb(DB_NAME).catch(async (e) => {
        console.warn("Persistent demo database unavailable, using in-memory database", e);
        return openDb("memory://movo-demo");
      });
    }
    return dbPromise;
  }

  /** Executes an API function as a given user, inside a transaction with RLS role and claims. */
  function asUserOn(db: PGlite) {
    return async function asUser<T>(uid: string, fn: string, args: Record<string, unknown> = {}): Promise<T> {
      if (!isValidFnName(fn)) throw new BackendError("invalid_target");
      return db.transaction(async (tx: Transaction) => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
        const r = await tx.query<{ r: T }>(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args)]);
        return r.rows[0].r;
      });
    };
  }

  async function asUser<T>(uid: string, fn: string, args: Record<string, unknown> = {}) {
    const db = await getDb();
    try {
      return await asUserOn(db)<T>(uid, fn, args);
    } catch (e) {
      throw toBackendError(e);
    }
  }

  function setSession(s: Session | null) {
    session = s;
    writeSession(s);
    authListeners.forEach((l) => l(s));
  }

  // --- Simulated reactions (labelled in UI) -------------------------------------------------
  async function afterCall(fn: string, args: Record<string, unknown>, result: unknown) {
    if (!session) return;
    const me = session.userId;
    const db = await getDb();
    if (fn === "send_message") {
      const convId = args.conversation_id as string;
      emit(`conv:${convId}`);
      emit("inbox");
      const c = await db.query<{ kind: string; user_a: string; user_b: string }>(
        "select kind, user_a, user_b from public.conversations where id = $1", [convId]);
      const conv = c.rows[0];
      if (!conv || conv.kind !== "direct") return;
      const other = conv.user_a === me ? conv.user_b : conv.user_a;
      if (!simulated.has(other)) return;
      const count = await db.query<{ n: number }>(
        "select count(*)::int n from public.messages where conversation_id = $1 and sender_id = $2", [convId, other]);
      if (count.rows[0].n >= 4) return; // keep simulated chatter short
      const body = simulatedReply(count.rows[0].n, String(args.body ?? ""));
      setTimeout(async () => {
        try {
          await asUser(other, "send_message", { conversation_id: convId, client_id: crypto.randomUUID(), body });
          emit(`conv:${convId}`);
          emit("inbox");
        } catch { /* conversation may have been closed (block/remove) */ }
      }, 1400 + Math.random() * 1600);
    }
    if (fn === "send_connection_request") {
      const target = args.user_id as string;
      const r = result as { status: string; request_id?: string };
      if (simulated.has(target) && r.status === "request_sent" && r.request_id) {
        setTimeout(async () => {
          try {
            await asUser(target, "respond_connection_request", { request_id: r.request_id, accept: true });
            emit("inbox");
            emit("connections");
          } catch { /* cancelled meanwhile */ }
        }, 2500);
      }
    }
    if (["toggle_reaction", "delete_message", "mark_read"].includes(fn) && args.conversation_id) emit(`conv:${args.conversation_id}`);
    if (fn === "toggle_reaction" || fn === "delete_message") emit("conv:*");
  }

  return {
    mode: "demo",

    async call<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!session) throw new BackendError("not_authenticated");
      const result = await asUser<T>(session.userId, fn, args);
      void afterCall(fn, args, result);
      return result;
    },

    auth: {
      googleEnabled: false,
      async getSession() {
        if (!session) return null;
        const db = await getDb();
        const r = await db.query("select 1 from auth.users where id = $1", [session.userId]);
        if (r.rows.length === 0) { setSession(null); return null; }
        return session;
      },
      onChange(cb) {
        authListeners.add(cb);
        return () => authListeners.delete(cb);
      },
      async signUp(email, password) {
        const db = await getDb();
        const e = email.trim().toLowerCase();
        if (e.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) throw new BackendError("invalid_credentials");
        const exists = await db.query("select 1 from auth.users where email = $1", [e]);
        if (exists.rows.length) throw new BackendError("email_taken");
        const r = await db.query<{ id: string }>(
          "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
          [e, JSON.stringify({ demo_pw: await sha256(password) })]);
        const uid = r.rows[0].id;
        await onDemoAccountCreated(db, uid);
        setSession({ userId: uid, email: e });
        return { needsConfirmation: false };
      },
      async signIn(email, password) {
        const db = await getDb();
        const r = await db.query<{ id: string; meta: { demo_pw?: string } }>(
          "select id, raw_user_meta_data meta from auth.users where email = $1", [email.trim().toLowerCase()]);
        const row = r.rows[0];
        if (!row || row.meta.demo_pw !== (await sha256(password))) throw new BackendError("invalid_credentials");
        setSession({ userId: row.id, email: email.trim().toLowerCase() });
      },
      async signInWithGoogle() {
        throw new BackendError("generic", undefined, "Google sign-in is not available in demo mode");
      },
      async resetPassword() { /* no email in demo */ },
      async signOut() {
        setSession(null);
      },
    },

    storage: {
      async upload(bucket: Bucket, path: string, file: Blob) {
        if (file.size > 3 * 1024 * 1024) throw new BackendError("attachment_too_large");
        const data = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(file);
        });
        const db = await getDb();
        const key = `${bucket}/${path}`;
        await db.query("insert into demo.files (path, mime, data) values ($1, $2, $3) on conflict (path) do update set data = excluded.data",
          [key, file.type || "application/octet-stream", data]);
        fileCache.set(key, data);
        return bucket === "attachments" ? path : `storage:${bucket}/${path}`;
      },
      async resolve(ref: string, bucket?: Bucket) {
        if (!ref) return null;
        const key = ref.startsWith("storage:") ? ref.slice(8) : bucket ? `${bucket}/${ref}` : null;
        if (!key) return null;
        if (fileCache.has(key)) return fileCache.get(key)!;
        const db = await getDb();
        const r = await db.query<{ data: string }>("select data from demo.files where path = $1", [key]);
        const v = r.rows[0]?.data ?? null;
        if (v) fileCache.set(key, v);
        return v;
      },
    },

    realtime: {
      conversation(conversationId: string, h: RealtimeHandlers) {
        h.onStatus?.(true);
        const off1 = on(`conv:${conversationId}`, (m) => { if (m) h.onMessage?.(m as Message); h.onChange?.(); });
        const off2 = on("conv:*", () => h.onChange?.());
        return () => { off1(); off2(); };
      },
      inbox(h: RealtimeHandlers) {
        h.onStatus?.(true);
        const off1 = on("inbox", () => h.onChange?.());
        const off2 = on("connections", () => h.onChange?.());
        return () => { off1(); off2(); };
      },
    },

    isSimulatedUser(id) {
      return !!id && simulated.has(id);
    },

    async resetDemo() {
      setSession(null);
      try {
        const db = await getDb();
        await db.close();
      } catch { /* ignore */ }
      dbPromise = null;
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(`/pglite/movo-demo-${DEMO_SQL_VERSION}`);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    },
  };
}
