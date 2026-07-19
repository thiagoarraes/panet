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

// Update manual dos campos de uma corrida (uso admin, fallback quando a IA falha).
export function useAtualizarCorrida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, campos }) => {
      if (!isSupabaseEnabled || !supabase || !id) throw new Error("Serviço indisponível.");
      const { error } = await supabase.from("corridas").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corridas"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "corridas"] });
    },
  });
}
