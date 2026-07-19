import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Envia recibo (imagem ou PDF) + motivo, cria a corrida e dispara a extração por IA.
export function useEnviarCorrida(currentUserId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, motivo }) => {
      if (!isSupabaseEnabled || !supabase) throw new Error("Serviço indisponível.");
      if (!currentUserId) throw new Error("Sessão inválida.");
      if (!(file instanceof File)) throw new Error("Selecione o recibo da corrida.");
      if (!ALLOWED_MIMES.includes(file.type)) {
        throw new Error("Formato inválido. Envie uma imagem (JPG, PNG, WEBP) ou PDF.");
      }
      if (file.size > MAX_FILE_BYTES) throw new Error("Arquivo muito grande (máx. 10MB).");
      const motivoLimpo = String(motivo || "").trim();
      if (!motivoLimpo) throw new Error("Descreva o motivo da corrida.");

      const ext = EXT_BY_MIME[file.type] || "bin";
      const reciboPath = `${currentUserId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("recibos")
        .upload(reciboPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: corrida, error: insertError } = await supabase
        .from("corridas")
        .insert({
          colaborador_id: currentUserId,
          motivo: motivoLimpo,
          recibo_path: reciboPath,
          recibo_mime: file.type,
        })
        .select("id")
        .single();
      if (insertError) {
        // Best-effort: remove o arquivo órfão se o insert falhar.
        await supabase.storage.from("recibos").remove([reciboPath]).catch(() => {});
        throw new Error(insertError.message);
      }

      // Dispara a extração; não bloqueia o sucesso do envio se a função falhar
      // (o status fica "pendente"/"erro" e o admin pode reprocessar/editar).
      supabase.functions.invoke("extract-recibo", { body: { corrida_id: corrida.id } }).catch(() => {});

      return corrida;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corridas"] });
    },
  });
}

// Vincula (ou atualiza) um cliente a um endereço de destino. Admin only (RLS).
export function useDefinirClienteDestino() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ endereco, nome }) => {
      if (!isSupabaseEnabled || !supabase) throw new Error("Serviço indisponível.");
      const enderecoLimpo = String(endereco || "").trim();
      const nomeLimpo = String(nome || "").trim();
      if (!enderecoLimpo) throw new Error("Endereço de destino inválido.");
      if (!nomeLimpo) throw new Error("Informe o nome do cliente.");

      // Upsert manual: o índice único é por expressão (lower/btrim), não por coluna.
      const { data: existente } = await supabase
        .from("corridas_clientes")
        .select("id")
        .ilike("endereco", enderecoLimpo)
        .maybeSingle();

      const { error } = existente
        ? await supabase.from("corridas_clientes").update({ nome: nomeLimpo }).eq("id", existente.id)
        : await supabase.from("corridas_clientes").insert({ endereco: enderecoLimpo, nome: nomeLimpo });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "corridas-clientes"] });
    },
  });
}
