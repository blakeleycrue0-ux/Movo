"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Message } from "@/lib/types";
import { type Backend, type Bucket, BackendError, isValidFnName, toBackendError, type Session } from "./types";

const PUBLIC_BUCKETS: Bucket[] = ["avatars", "group-images", "project-media"];

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });

  const toSession = (s: { user: { id: string; email?: string | null }; access_token: string } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? null, accessToken: s.access_token } : null;

  const signedCache = new Map<string, { url: string; exp: number }>();

  return {
    mode: "live",

    async call<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!isValidFnName(fn)) throw new BackendError("invalid_target");
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new BackendError("network");
      try {
        const { data, error } = await sb.rpc(fn, { p: args });
        if (error) throw error;
        return data as T;
      } catch (e) {
        throw toBackendError(e);
      }
    },

    auth: {
      googleEnabled: env.googleAuthEnabled,
      async getSession() {
        const { data } = await sb.auth.getSession();
        return toSession(data.session);
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toSession(s)));
        return () => data.subscription.unsubscribe();
      },
      async signUp(email, password) {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw new BackendError(/registered/i.test(error.message) ? "invalid_credentials" : "generic", undefined, error.message);
        return { needsConfirmation: !data.session };
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new BackendError("invalid_credentials", undefined, error.message);
      },
      async signInWithGoogle() {
        const { error } = await sb.auth.signInWithOAuth({
          provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw new BackendError("generic", undefined, error.message);
      },
      async resetPassword(email) {
        await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
      },
      async signOut() {
        await sb.auth.signOut();
      },
    },

    storage: {
      async upload(bucket, path, file) {
        const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
        if (error) throw new BackendError("upload_failed", undefined, error.message);
        return bucket === "attachments" ? path : `storage:${bucket}/${path}`;
      },
      async resolve(ref, bucket) {
        if (!ref) return null;
        let b: Bucket; let path: string;
        if (ref.startsWith("storage:")) {
          const rest = ref.slice("storage:".length);
          b = rest.slice(0, rest.indexOf("/")) as Bucket;
          path = rest.slice(rest.indexOf("/") + 1);
        } else if (bucket) {
          b = bucket; path = ref;
        } else {
          return null;
        }
        if (PUBLIC_BUCKETS.includes(b)) return sb.storage.from(b).getPublicUrl(path).data.publicUrl;
        const key = `${b}/${path}`;
        const hit = signedCache.get(key);
        if (hit && hit.exp > Date.now()) return hit.url;
        const { data, error } = await sb.storage.from(b).createSignedUrl(path, 3600);
        if (error || !data) return null;
        signedCache.set(key, { url: data.signedUrl, exp: Date.now() + 3300_000 });
        return data.signedUrl;
      },
    },

    realtime: {
      conversation(conversationId, h) {
        const ch = sb
          .channel(`conv:${conversationId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
            (payload) => {
              // Rows arrive already filtered by RLS; refetch to get the shaped message.
              if (payload.eventType === "INSERT" && h.onMessage) h.onMessage(payload.new as unknown as Message);
              h.onChange?.();
            })
          .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => h.onChange?.())
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` },
            () => h.onChange?.())
          .subscribe((status) => h.onStatus?.(status === "SUBSCRIBED"));
        return () => { void sb.removeChannel(ch); };
      },
      inbox(h) {
        const ch = sb
          .channel(`inbox:${Math.random().toString(36).slice(2)}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => h.onChange?.())
          .subscribe((status) => h.onStatus?.(status === "SUBSCRIBED"));
        return () => { void sb.removeChannel(ch); };
      },
    },
  };
}
