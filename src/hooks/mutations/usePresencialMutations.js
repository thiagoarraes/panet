import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toAvatar = (profile) => {
  const initials = profile?.nome
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    email: profile.email,
    telefone: profile.telefone,
    aniversario: profile.aniversario || null,
    fotoUrl: profile.foto_url || "",
    foto_url: profile.foto_url || "",
    foto: initials || "U",
    cor: profile.cor_avatar || "#11E7E7",
    redes: {
      instagram: profile.instagram || "",
      linkedin: profile.linkedin || "",
      github: profile.github || "",
    },
  };
};

const mapDbPresencialConfirmacaoToUi = (item) => ({
  id: item.id,
  status: item.status || "confirmado",
  observacao: item.observacao || "",
  createdAt: item.created_at || null,
  colaborador: toAvatar(item.colaborador),
});

const mapDbPresencialAgendaToUi = (item, confirmacoes = []) => ({
  id: item.id,
  titulo: item.titulo || "Dia presencial",
  dataIso: item.data_presencial,
  horaIso: String(item.hora_presencial || "").slice(0, 5),
  amigoSecretoAtivo: Boolean(item.amigo_secreto_ativo),
  amigoSecretoRegras: item.amigo_secreto_regras || "",
  amigoSecretoSorteadoAt: item.amigo_secreto_sorteado_at || null,
  local: item.local || "Escritorio Pan",
  mapsUrl: item.maps_url || "",
  vagas: Number(item.vagas || 0),
  observacao: item.observacao || "",
  status: item.status || "aberto",
  createdAt: item.created_at || null,
  confirmacoes,
});

const invalidatePresencial = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["presencial"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "presencial"] });
};

// ---------------------------------------------------------------------------
// useCreatePresencialAgenda
// ---------------------------------------------------------------------------

export function useCreatePresencialAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const normalized = {
        titulo: payload?.titulo || "Dia presencial",
        dataIso: payload?.dataIso || "",
        horaIso: String(payload?.horaIso || "").slice(0, 5),
        amigoSecretoAtivo: Boolean(payload?.amigoSecretoAtivo),
        amigoSecretoRegras: payload?.amigoSecretoRegras || "",
        local: payload?.local || "Escritorio Pan",
        mapsUrl: payload?.mapsUrl || "",
        vagas: Number(payload?.vagas || 0),
        observacao: payload?.observacao || "",
        status: payload?.status || "aberto",
      };

      if (!isSupabaseEnabled || !supabase) {
        return { id: `presencial-${Date.now()}`, ...normalized, confirmacoes: [] };
      }

      const { data, error } = await supabase
        .from("presencial_agendas")
        .insert({
          titulo: normalized.titulo,
          data_presencial: normalized.dataIso,
          hora_presencial: normalized.horaIso || null,
          amigo_secreto_ativo: normalized.amigoSecretoAtivo,
          amigo_secreto_regras: normalized.amigoSecretoRegras || null,
          local: normalized.local || null,
          maps_url: normalized.mapsUrl || null,
          vagas: normalized.vagas,
          observacao: normalized.observacao || null,
          status: normalized.status,
        })
        .select(
          "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at"
        )
        .single();
      if (error) throw new Error(error.message);
      return mapDbPresencialAgendaToUi(data, []);
    },
    onSuccess: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useUpdatePresencialAgenda
// ---------------------------------------------------------------------------

export function useUpdatePresencialAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const normalized = {
        titulo: payload?.titulo || "Dia presencial",
        dataIso: payload?.dataIso || "",
        horaIso: String(payload?.horaIso || "").slice(0, 5),
        amigoSecretoAtivo: Boolean(payload?.amigoSecretoAtivo),
        amigoSecretoRegras: payload?.amigoSecretoRegras || "",
        local: payload?.local || "Escritorio Pan",
        mapsUrl: payload?.mapsUrl || "",
        vagas: Number(payload?.vagas || 0),
        observacao: payload?.observacao || "",
        status: payload?.status || "aberto",
      };

      if (!isSupabaseEnabled || !supabase) return normalized;

      const { data, error } = await supabase
        .from("presencial_agendas")
        .update({
          titulo: normalized.titulo,
          data_presencial: normalized.dataIso,
          hora_presencial: normalized.horaIso || null,
          amigo_secreto_ativo: normalized.amigoSecretoAtivo,
          amigo_secreto_regras: normalized.amigoSecretoRegras || null,
          local: normalized.local || null,
          maps_url: normalized.mapsUrl || null,
          vagas: normalized.vagas,
          observacao: normalized.observacao || null,
          status: normalized.status,
        })
        .select(
          "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at"
        )
        .eq("id", id);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return mapDbPresencialAgendaToUi(row, []);
    },
    onSuccess: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useDeletePresencialAgenda
// ---------------------------------------------------------------------------

export function useDeletePresencialAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("presencial_agendas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useRespondPresencial — optimistic update
// ---------------------------------------------------------------------------

export function useRespondPresencial(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agendaId, status, currentProfile }) => {
      const effectiveUserId = currentProfile?.id || userId;
      if (!effectiveUserId || !agendaId) return;

      if (!isSupabaseEnabled || !supabase) return;

      if (!status) {
        // Remove response
        const { error } = await supabase
          .from("presencial_confirmacoes")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("colaborador_id", effectiveUserId);
        if (error) throw new Error(error.message);
      } else {
        // Upsert response
        const { error } = await supabase.from("presencial_confirmacoes").upsert(
          {
            agenda_id: agendaId,
            colaborador_id: effectiveUserId,
            status,
          },
          {
            onConflict: "agenda_id,colaborador_id",
            ignoreDuplicates: false,
          }
        );
        if (error) throw new Error(error.message);
      }
    },

    onMutate: async ({ agendaId, status, currentProfile }) => {
      await queryClient.cancelQueries({ queryKey: ["presencial", userId] });
      const previous = queryClient.getQueryData(["presencial", userId]);

      queryClient.setQueryData(["presencial", userId], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((agenda) => {
          if (String(agenda.id) !== String(agendaId)) return agenda;
          const effectiveUserId = currentProfile?.id || userId;
          let confirmacoes = [...(agenda.confirmacoes || [])];

          if (!status) {
            // Remove my response
            confirmacoes = confirmacoes.filter(
              (c) => String(c.colaborador?.id) !== String(effectiveUserId)
            );
          } else {
            const myIdx = confirmacoes.findIndex(
              (c) => String(c.colaborador?.id) === String(effectiveUserId)
            );
            if (myIdx >= 0) {
              confirmacoes[myIdx] = { ...confirmacoes[myIdx], status };
            } else {
              confirmacoes.push({
                id: `optimistic-${Date.now()}`,
                status,
                observacao: "",
                createdAt: new Date().toISOString(),
                colaborador: currentProfile
                  ? toAvatar(currentProfile)
                  : { id: effectiveUserId, nome: "Eu", foto: "E", cor: "#11E7E7" },
              });
            }
          }
          return { ...agenda, confirmacoes };
        });
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["presencial", userId], context.previous);
      }
    },

    onSettled: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useToggleSecretSanta — optimistic update
// ---------------------------------------------------------------------------

export function useToggleSecretSanta(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agendaId, shouldParticipate, currentProfile }) => {
      const effectiveUserId = currentProfile?.id || userId;
      if (!effectiveUserId || !agendaId) return;
      if (!isSupabaseEnabled || !supabase) return;

      const nextStatus = shouldParticipate ? "talvez" : "confirmado";
      const { error } = await supabase.from("presencial_confirmacoes").upsert(
        {
          agenda_id: agendaId,
          colaborador_id: effectiveUserId,
          status: nextStatus,
        },
        {
          onConflict: "agenda_id,colaborador_id",
          ignoreDuplicates: false,
        }
      );
      if (error) throw new Error(error.message);
    },

    onMutate: async ({ agendaId, shouldParticipate, currentProfile }) => {
      await queryClient.cancelQueries({ queryKey: ["presencial", userId] });
      const previous = queryClient.getQueryData(["presencial", userId]);

      queryClient.setQueryData(["presencial", userId], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((agenda) => {
          if (String(agenda.id) !== String(agendaId)) return agenda;
          const effectiveUserId = currentProfile?.id || userId;
          const nextStatus = shouldParticipate ? "talvez" : "confirmado";
          const confirmacoes = (agenda.confirmacoes || []).map((c) =>
            String(c.colaborador?.id) === String(effectiveUserId)
              ? { ...c, status: nextStatus }
              : c
          );
          return { ...agenda, confirmacoes };
        });
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["presencial", userId], context.previous);
      }
    },

    onSettled: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useRunSecretSanta
// ---------------------------------------------------------------------------

export function useRunSecretSanta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agendaId) => {
      if (!agendaId) return;
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.rpc("run_amigo_secreto_draw", { p_agenda_id: agendaId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePresencial(queryClient),
  });
}
