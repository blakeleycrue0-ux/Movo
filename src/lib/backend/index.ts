"use client";

import { env } from "@/config/env";
import type { Backend } from "./types";

let instance: Backend | null = null;

export async function getBackend(): Promise<Backend> {
  if (instance) return instance;
  if (env.mode === "live") {
    const { createSupabaseBackend } = await import("./supabase");
    instance = createSupabaseBackend();
  } else {
    const { createDemoBackend } = await import("./demo");
    instance = createDemoBackend();
  }
  return instance;
}

export * from "./types";
