import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabaseAnon);

if (!isSupabaseEnabled) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes. " +
      "Aplicacao segue em modo local (sem auth e sem banco remoto)."
  );
}

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnon)
  : null;
