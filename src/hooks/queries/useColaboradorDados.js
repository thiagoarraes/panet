import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { timeQuery } from "../../lib/queryTiming.js";
import { formatCpf, formatCnpj, formatTelefone } from "../../lib/documentos.js";

/**
 * snake_case (banco) -> camelCase (UI). Espelha o padrao de mapProfileToRow.
 * O banco guarda CPF/CNPJ/telefone so com digitos; reaplica a mascara aqui
 * para o form nao recarregar "11144477735" sem formatacao apos um reload.
 */
export const mapRhRowToForm = (row) => {
  if (!row) return null;
  return {
    nomeCompleto: row.nome_completo || "",
    dataNascimento: row.data_nascimento || "",
    dataAdmissao: row.data_admissao || "",
    rg: row.rg || "",
    cpf: row.cpf ? formatCpf(row.cpf) : "",
    cnpj: row.cnpj ? formatCnpj(row.cnpj) : "",
    emailPessoal: row.email_pessoal || "",
    emailPan: row.email_pan || "",
    bancoNome: row.banco_nome || "",
    bancoAgencia: row.banco_agencia || "",
    bancoConta: row.banco_conta || "",
    bancoPix: row.banco_pix || "",
    planoSaude: Boolean(row.plano_saude),
    planoSaudeQual: row.plano_saude_qual || "",
    tipoSanguineo: row.tipo_sanguineo || "",
    emergenciaNome: row.emergencia_nome || "",
    emergenciaTelefone: row.emergencia_telefone ? formatTelefone(row.emergencia_telefone) : "",
  };
};

/**
 * Dados sensiveis de RH de um colaborador. So dispara com `enabled: true` --
 * quem chama decide isso a partir de temModulo(perfil, "colaboradores"), entao
 * sem o modulo NENHUMA requisicao sai do browser (nao e so ocultacao de UI).
 *
 * maybeSingle() devolve null (nao erro) quando a RLS filtra tudo ou o
 * colaborador ainda nao tem registro em colaboradores_dados.
 *
 * staleTime 0 e gcTime curto de proposito: dado sensivel nao deve persistir
 * alem do necessario em memoria, e esta queryKey NAO entra no
 * PERSISTED_QUERY_ROOTS de queryPersistence.js (allowlist explicita) -- nunca
 * deve ir para o localStorage.
 */
export function useColaboradorDados(colaboradorId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["colaborador-dados", colaboradorId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return null;
      const { data, error } = await timeQuery("select colaboradores_dados", () =>
        supabase
          .from("colaboradores_dados")
          .select("*")
          .eq("colaborador_id", colaboradorId)
          .maybeSingle()
      );
      if (error) throw error;
      return mapRhRowToForm(data);
    },
    enabled: enabled && !!colaboradorId,
    staleTime: 0,
    gcTime: 60 * 1000,
  });
}
