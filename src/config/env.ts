/**
 * Public runtime configuration. Only NEXT_PUBLIC_* values are read here; secrets never reach the browser.
 *
 * Mode selection:
 *   - Live mode when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
 *     (and NEXT_PUBLIC_FORCE_DEMO is not "true").
 *   - Otherwise the explicitly labelled demo mode runs in the browser with fictional data.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
const forceDemo = process.env.NEXT_PUBLIC_FORCE_DEMO === "true";

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  mode: (supabaseUrl && supabaseAnonKey && !forceDemo ? "live" : "demo") as "live" | "demo",
  googleAuthEnabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
  /** Calls are enabled only when a LiveKit URL is configured (server also needs key/secret). */
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || null,
};
