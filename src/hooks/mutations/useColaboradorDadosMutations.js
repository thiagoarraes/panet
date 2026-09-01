import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { soDigitos } from "../../lib/documentos.js";

/** camelCase (form) -> snake_case (banco). CPF/CNPJ/telefone vao so com digitos. */
const mapFormToRhRow = (form) => ({
  nome_completo: form.nomeCompleto || null,
  data_nascimento: form.dataNascimento || null,
  data_admissao: form.dataAdmissao || null,
  rg: form.rg?.trim() || null,
  cpf: form.cpf ? soDigitos(form.cpf) : null,
  cnpj: form.cnpj ? soDigitos(form.cnpj) : null,
  email_pessoal: form.emailPessoal?.trim() || null,
  email_pan: form.emailPan?.trim() || null,
  banco_nome: form.bancoNome?.trim() || null,
  banco_agencia: form.bancoAgencia?.trim() || null,
  banco_conta: form.bancoConta?.trim() || null,
  banco_pix: form.bancoPix?.trim() || null,
  plano_saude: Boolean(form.planoSaude),
  plano_saude_qual: form.planoSaude ? form.planoSaudeQual?.trim() || null : null,
  tipo_sanguineo: form.tipoSanguineo || null,
  emergencia_nome: form.emergenciaNome?.trim() || null,
  emergencia_telefone: form.emergenciaTelefone ? soDigitos(form.emergenciaTelefone) : null,
});

/**
 * Grava os dados de RH de um colaborador. onConflict na PK (que e a propria FK)
 * faz o upsert funcionar tanto para o primeiro cadastro quanto para edicoes.
 *
 * Sem optimistic update: e um form que fecha no sucesso, nao um like -- a
 * complexidade do rollback nao compensaria aqui. Invalida so a query pontual
 * do colaborador; nenhum campo desta tabela alimenta card, listagem ou
 * dashboard.
 */
export function useSalvarColaboradorDados() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ colaboradorId, form }) => {
      if (!isSupabaseEnabled || !supabase) {
        throw new Error("Recurso indisponível neste ambiente.");
      }

      const { data, error } = await supabase
        .from("colaboradores_dados")
        .upsert(
          { colaborador_id: colaboradorId, ...mapFormToRhRow(form) },
          { onConflict: "colaborador_id" }
        )
        .select("*")
        .single();

      if (error) throw new Error(error.message || "Não foi possível salvar os dados.");
      return data;
    },
    onSuccess: (_data, { colaboradorId }) => {
      queryClient.invalidateQueries({ queryKey: ["colaborador-dados", colaboradorId] });
      // A lista de sugestoes de banco e derivada destas linhas: sem invalidar,
      // um banco digitado agora so apareceria para o proximo colaborador depois
      // do staleTime.
      queryClient.invalidateQueries({ queryKey: ["bancos-cadastrados"] });
    },
  });
}
