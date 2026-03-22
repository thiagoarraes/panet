import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

const sanitizeQuestion = (value) => String(value || "").trim();
const sanitizeOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option, index) => ({
      id: option?.id ? String(option.id) : "",
      text: String(option?.text || option?.texto || "").trim(),
      order: index + 1,
    }))
    .filter((option) => option.text.length > 0);

const assertValidPollPayload = ({ question, options }) => {
  if (!question) throw new Error("Informe a pergunta da enquete.");
  if (options.length < 2) throw new Error("A enquete precisa ter pelo menos 2 opções.");
  if (options.length > 6) throw new Error("A enquete aceita no máximo 6 opções.");

  const normalizedUnique = new Set(options.map((item) => item.text.toLowerCase()));
  if (normalizedUnique.size !== options.length) {
    throw new Error("As opções precisam ser diferentes entre si.");
  }
};

const invalidateEnquetes = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
};

export function useCreateEnquete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question, options, endsAt, showPartial = true, createdBy }) => {
      if (!isSupabaseEnabled || !supabase) return null;

      const normalizedQuestion = sanitizeQuestion(question);
      const normalizedOptions = sanitizeOptions(options);
      assertValidPollPayload({ question: normalizedQuestion, options: normalizedOptions });

      const { data: created, error: createError } = await supabase
        .from("enquetes")
        .insert({
          pergunta: normalizedQuestion,
          mostrar_resultado_parcial: Boolean(showPartial),
          encerra_em: endsAt || null,
          encerrada_em: null,
          created_by: createdBy || null,
        })
        .select("id")
        .single();

      if (createError) throw new Error(createError.message);
      if (!created?.id) throw new Error("Nao foi possivel criar a enquete.");

      const optionsPayload = normalizedOptions.map((item) => ({
        enquete_id: created.id,
        texto: item.text,
        ordem: item.order,
      }));

      const { error: optionError } = await supabase.from("enquete_opcoes").insert(optionsPayload);
      if (optionError) throw new Error(optionError.message);

      return created.id;
    },
    onSuccess: () => invalidateEnquetes(queryClient),
  });
}

export function useUpdateEnquete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, question, options, endsAt, showPartial = true, optionsLocked = false }) => {
      if (!isSupabaseEnabled || !supabase) return;
      if (!id) throw new Error("Enquete invalida.");

      const normalizedQuestion = sanitizeQuestion(question);
      const normalizedOptions = sanitizeOptions(options);
      assertValidPollPayload({ question: normalizedQuestion, options: normalizedOptions });

      const { error: updateError } = await supabase
        .from("enquetes")
        .update({
          pergunta: normalizedQuestion,
          mostrar_resultado_parcial: Boolean(showPartial),
          encerra_em: endsAt || null,
        })
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);
      if (optionsLocked) return;

      const { data: existingRows, error: existingError } = await supabase
        .from("enquete_opcoes")
        .select("id")
        .eq("enquete_id", id);
      if (existingError) throw new Error(existingError.message);

      const upsertPayload = normalizedOptions.map((item) => {
        const basePayload = {
          enquete_id: id,
          texto: item.text,
          ordem: item.order,
        };
        if (item.id) {
          return {
            id: item.id,
            ...basePayload,
          };
        }
        return basePayload;
      });

      const { error: upsertError } = await supabase
        .from("enquete_opcoes")
        .upsert(upsertPayload, { onConflict: "id" });
      if (upsertError) throw new Error(upsertError.message);

      const submittedExistingIds = new Set(
        normalizedOptions
          .map((item) => item.id)
          .filter(Boolean)
      );
      const removableIds = (existingRows || [])
        .map((row) => String(row.id || ""))
        .filter((optionId) => optionId && !submittedExistingIds.has(optionId));

      if (removableIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("enquete_opcoes")
          .delete()
          .in("id", removableIds);
        if (deleteError) throw new Error(deleteError.message);
      }
    },
    onSuccess: () => invalidateEnquetes(queryClient),
  });
}

export function useEncerrarEnqueteAgora() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enqueteId) => {
      if (!isSupabaseEnabled || !supabase) return;
      if (!enqueteId) throw new Error("Enquete invalida.");
      const { error } = await supabase
        .from("enquetes")
        .update({ encerrada_em: new Date().toISOString() })
        .eq("id", enqueteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateEnquetes(queryClient),
  });
}

export function useDeleteEnquete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enqueteId) => {
      if (!isSupabaseEnabled || !supabase) return;
      if (!enqueteId) throw new Error("Enquete invalida.");
      const { error } = await supabase.from("enquetes").delete().eq("id", enqueteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateEnquetes(queryClient),
  });
}

export function useVoteEnquete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enqueteId, optionId, colaboradorId }) => {
      if (!isSupabaseEnabled || !supabase) return;
      if (!enqueteId || !optionId || !colaboradorId) {
        throw new Error("Dados insuficientes para registrar voto.");
      }

      const { error } = await supabase.from("enquete_votos").insert({
        enquete_id: enqueteId,
        enquete_opcao_id: optionId,
        colaborador_id: colaboradorId,
      });

      if (!error) return;

      const errorCode = String(error.code || "");
      const message = String(error.message || "");
      if (errorCode === "23505" || message.includes("enquete_votos_unique_enquete_colaborador")) {
        throw new Error("Voce ja votou nesta enquete.");
      }
      if (message.toLowerCase().includes("row-level security")) {
        throw new Error("A enquete foi encerrada e nao aceita novos votos.");
      }
      throw new Error(message || "Nao foi possivel registrar voto.");
    },
    onSuccess: () => invalidateEnquetes(queryClient),
  });
}
