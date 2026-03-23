import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnon;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnon);

if (!isSupabaseEnabled) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL e chave ausentes (VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY). " +
      "Aplicacao segue em modo local (sem auth e sem banco remoto)."
  );
}

// In production, tokens live only in memory — never in localStorage.
// The real persistence layer is handled by httpOnly cookies via /api/auth/*.
// In dev (vite dev), localStorage is kept so sessions survive hot reloads.
const memStore = {};
const inMemoryStorage = {
  getItem: (key) => memStore[key] ?? null,
  setItem: (key, value) => { memStore[key] = value; },
  removeItem: (key) => { delete memStore[key]; },
};

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnon, {
      auth: import.meta.env.PROD
        ? {
            storage: inMemoryStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          }
        : {},
    })
  : null;
