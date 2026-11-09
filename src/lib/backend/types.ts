import type { Message } from "@/lib/types";

export type BackendMode = "live" | "demo";

export interface Session {
  userId: string;
  email: string | null;
  accessToken?: string;
}

/** Error thrown by backend calls. `code` maps to i18n `errors.<code>`. */
export class BackendError extends Error {
  code: string;
  detail?: unknown;
  constructor(code: string, detail?: unknown, message?: string) {
    super(message ?? code);
    this.code = code;
    this.detail = detail;
  }
}

export type Bucket = "avatars" | "group-images" | "project-media" | "attachments";

export interface RealtimeHandlers {
  onMessage?: (m: Message) => void;
  onChange?: () => void;
  onStatus?: (connected: boolean) => void;
}

export interface Backend {
  mode: BackendMode;
  /** Calls a public SQL function with a single jsonb argument. */
  call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;

  auth: {
    googleEnabled: boolean;
    getSession(): Promise<Session | null>;
    onChange(cb: (s: Session | null) => void): () => void;
    signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
    signIn(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    resetPassword(email: string): Promise<void>;
    signOut(): Promise<void>;
  };

  storage: {
    /** Uploads and returns a reference string stored in the DB (e.g. "storage:avatars/uid/x.jpg"). */
    upload(bucket: Bucket, path: string, file: Blob): Promise<string>;
    /** Resolves a stored reference (or attachment path) to a displayable URL. */
    resolve(ref: string, bucket?: Bucket): Promise<string | null>;
  };

  realtime: {
    conversation(conversationId: string, h: RealtimeHandlers): () => void;
    inbox(h: RealtimeHandlers): () => void;
  };

  /** Demo only: ids of fictional users (for labelling simulated activity). */
  isSimulatedUser?(id: string | null | undefined): boolean;
  resetDemo?(): Promise<void>;
}

/** Normalises database / network errors into BackendError codes. */
export function toBackendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const anyE = e as { message?: string; details?: string; detail?: string; code?: string; name?: string } | undefined;
  const msg = anyE?.message ?? String(e);
  if (/Failed to fetch|NetworkError|network|fetch failed|Load failed/i.test(msg)) return new BackendError("network");
  if (/permission denied|JWT|not_authenticated/i.test(msg)) {
    return new BackendError(/not_authenticated|JWT/i.test(msg) ? "not_authenticated" : "forbidden");
  }
  const code = msg.trim().split(/\s|:/)[0];
  let detail: unknown = anyE?.details ?? anyE?.detail;
  if (typeof detail === "string") {
    try { detail = JSON.parse(detail); } catch { /* keep string */ }
  }
  return new BackendError(/^[a-z_]+$/.test(code) ? code : "generic", detail, msg);
}

export function isValidFnName(fn: string) {
  return /^[a-z_]{2,48}$/.test(fn);
}
