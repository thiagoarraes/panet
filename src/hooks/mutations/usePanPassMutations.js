import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Erros das Edge Functions vêm no corpo da resposta; o supabase-js só entrega
// "non-2xx status code". Isto recupera a mensagem real para mostrar ao usuário.
async function invokeOuErro(nome, body) {
  if (!isSupabaseEnabled || !supabase) throw new Error("Supabase indisponível.");
  const { data, error } = await supabase.functions.invoke(nome, { body });
  if (error) {
    let msg = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.error) msg = corpo.error;
    } catch {
      // resposta sem JSON — mantém a mensagem original
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Revela senha / gera TOTP / busca o código no e-mail.
// Deliberadamente sem cache: o valor volta para o componente e morre lá.
export function useRevelarCredencial() {
  return useMutation({
    mutationFn: ({ servicoId, tipo }) =>
      invokeOuErro("panpass-reveal", { servico_id: servicoId, tipo }),
    gcTime: 0,
  });
}

export function useSalvarServicoPanPass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (servico) => invokeOuErro("panpass-admin", { acao: "upsert", servico }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panpass"] }),
    gcTime: 0,
  });
}

export function useExcluirServicoPanPass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => invokeOuErro("panpass-admin", { acao: "delete", id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["panpass"] }),
  });
}
