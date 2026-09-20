import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Publishable primeiro; a anon legada e so fallback ate a migracao de chaves
// terminar. Mesma ordem em middleware.js e api/auth/* -- de proposito.
const supabaseAnon =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
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

// Detecta sessão zumbi: token que o app acha válido mas o Supabase já rejeita.
// PostgREST devolve 401 (não 403) em /rest/v1 quando a requisição chega sem role
// "authenticated" — token expirado que não foi renovado. Avisamos o AuthContext
// pra deslogar com uma mensagem clara em vez de deixar o usuário preso num erro genérico.
async function fetchWithSessionExpiryDetection(input, init) {
  const response = await fetch(input, init);
  if (response.status === 401 && String(input).includes("/rest/v1/")) {
    window.dispatchEvent(new Event("panet:session-expired"));
  }
  return response;
}

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
      global: { fetch: fetchWithSessionExpiryDetection },
    })
  : null;
