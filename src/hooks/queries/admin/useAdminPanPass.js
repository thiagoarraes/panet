import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

// Lista para gestão: admin enxerga também os serviços inativos (policy própria).
// Continua sem acesso às colunas cifradas — nem o admin lê senha pelo client.
export function useAdminPanPassServicos() {
  return useQuery({
    queryKey: ["panpass", "admin", "servicos"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const { data, error } = await supabase
        .from("panpass_servicos")
        .select("id,nome,categoria,url_login,logo_url,usuario,mfa_tipo,ativo,created_at")
        .order("nome", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isSupabaseEnabled,
    staleTime: 30 * 1000,
  });
}

// Auditoria: quem pediu qual credencial e quando.
export function useAdminPanPassAcessos({ dias = 30, limit = 300 } = {}) {
  return useQuery({
    queryKey: ["panpass", "admin", "acessos", { dias, limit }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("panpass_acessos")
        .select(
          "id,acao,sucesso,detalhe,ip,created_at,servico:panpass_servicos(nome),colaborador:colaboradores(nome)",
        )
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isSupabaseEnabled,
    staleTime: 15 * 1000,
  });
}
