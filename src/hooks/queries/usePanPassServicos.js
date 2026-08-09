import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Serviços que o colaborador logado pode acessar.
// O select cobre só as colunas não-secretas — as cifradas não têm GRANT para
// `authenticated`, então pedi-las aqui resultaria em erro de permissão.
export function usePanPassServicos() {
  return useQuery({
    queryKey: ["panpass", "servicos"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const { data, error } = await supabase
        .from("panpass_servicos")
        .select("id,nome,categoria,url_login,logo_url,usuario,mfa_tipo")
        .order("nome", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isSupabaseEnabled,
    staleTime: 5 * 60 * 1000,
  });
}
