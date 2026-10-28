import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { secureStore } from "./api";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/** In-memory cache so getItem stays sync for supabase-js; disk is the Credential Manager. */
let memorySession: string | null | undefined;

const keyringStorage: SupportedStorage = {
  getItem: (key) => {
    if (key !== "sb-session") return null;
    return memorySession ?? null;
  },
  setItem: (key, value) => {
    if (key !== "sb-session") return;
    memorySession = value;
    return secureStore.set(value);
  },
  removeItem: (key) => {
    if (key !== "sb-session") return;
    memorySession = null;
    return secureStore.clear();
  },
};

let client: ReturnType<typeof createClient> | null = null;
let hydrated = false;

/** Loads the session from the Credential Manager once before any auth call. */
export async function hydrateSecureSession() {
  if (hydrated || !isSupabaseConfigured()) return;
  try {
    memorySession = await secureStore.get();
  } catch {
    memorySession = null;
  }
  hydrated = true;
}

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Sincronização na nuvem não está configurada neste build.");
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storage: keyringStorage,
        storageKey: "sb-session",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return client;
}
