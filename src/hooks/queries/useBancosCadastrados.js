import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { timeQuery } from "../../lib/queryTiming.js";

/**
 * Nomes de banco ja usados em algum colaborador, para o form sugerir em vez de
 * obrigar a redigitar "Banco do Brasil" a cada cadastro.
 *
 * Nao ha tabela de bancos: a lista e derivada das proprias linhas de RH, entao
 * um banco novo passa a ser sugerido assim que for salvo uma vez -- sem cadastro
 * previo e sem tela de manutencao para o RH.
 *
 * `select("banco_nome")` traz uma coluna de nomes de banco e nada mais: sem
 * CPF, sem conta, sem vinculo com pessoa. Ainda assim passa pela mesma policy
 * de select da tabela, entao so quem tem o modulo `colaboradores` recebe algo
 * (e quem chama passa `enabled` com essa checagem).
 */
export function useBancosCadastrados({ enabled = true } = {}) {
  return useQuery({
    queryKey: ["bancos-cadastrados"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const { data, error } = await timeQuery("select bancos distintos", () =>
        supabase.from("colaboradores_dados").select("banco_nome").not("banco_nome", "is", null)
      );
      if (error) throw error;

      // PostgREST nao expoe DISTINCT; a deduplicacao sai daqui mesmo. Case
      // insensitive para "Itau" e "itau" nao virarem duas opcoes na lista.
      const porChave = new Map();
      for (const { banco_nome: nome } of data || []) {
        const limpo = String(nome || "").trim();
        if (limpo) porChave.set(limpo.toLowerCase(), limpo);
      }
      return [...porChave.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
