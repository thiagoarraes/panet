import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase.js";

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
    perfil: profile.perfil || "colaborador",
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
  visibilidadeRestrita: false,
  selectedColaboradorIds: [],
  colaboradoresSelecionados: [],
  minhaSugestaoAmigoSecreto: "",
  meuAmigoSecretoSugestao: "",
  confirmacoes,
});

const AGENDA_SELECT_FIELDS =
  "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at";

const normalizeAudienceIds = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

const normalizeAgendaPayload = (payload) => ({
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
  selectedColaboradorIds: normalizeAudienceIds(payload?.selectedColaboradorIds),
});

const syncAgendaAudience = async (agendaId, selectedColaboradorIds) => {
  const normalizedIds = normalizeAudienceIds(selectedColaboradorIds);

  if (!agendaId || !isSupabaseEnabled || !supabase) return normalizedIds;

  const { data: existingRows, error: existingError } = await supabase
    .from("presencial_agenda_convidados")
    .select("colaborador_id")
    .eq("agenda_id", agendaId);

  if (existingError) throw new Error(existingError.message);

  const currentIds = (existingRows || []).map((row) => String(row.colaborador_id || "")).filter(Boolean);
  const currentSet = new Set(currentIds);
  const nextSet = new Set(normalizedIds);
  const idsToInsert = normalizedIds.filter((id) => !currentSet.has(id));
  const idsToRemove = currentIds.filter((id) => !nextSet.has(id));

  if (normalizedIds.length === 0) {
    if (currentIds.length > 0) {
      const { error: deleteAudienceError } = await supabase
        .from("presencial_agenda_convidados")
        .delete()
        .eq("agenda_id", agendaId);
      if (deleteAudienceError) throw new Error(deleteAudienceError.message);
    }
    return normalizedIds;
  }

  if (idsToInsert.length > 0) {
    const { error: insertAudienceError } = await supabase.from("presencial_agenda_convidados").insert(
      idsToInsert.map((colaboradorId) => ({
        agenda_id: agendaId,
        colaborador_id: colaboradorId,
      }))
    );
    if (insertAudienceError) throw new Error(insertAudienceError.message);
  }

  if (idsToRemove.length > 0) {
    const { error: deleteAudienceError } = await supabase
      .from("presencial_agenda_convidados")
      .delete()
      .eq("agenda_id", agendaId)
      .in("colaborador_id", idsToRemove);
    if (deleteAudienceError) throw new Error(deleteAudienceError.message);

    const { error: deleteConfirmacoesError } = await supabase
      .from("presencial_confirmacoes")
      .delete()
      .eq("agenda_id", agendaId)
      .in("colaborador_id", idsToRemove);
    if (deleteConfirmacoesError) throw new Error(deleteConfirmacoesError.message);

    const { error: deleteSuggestionsError } = await supabase
      .from("presencial_amigo_secreto_sugestoes")
      .delete()
      .eq("agenda_id", agendaId)
      .in("colaborador_id", idsToRemove);
    if (deleteSuggestionsError) throw new Error(deleteSuggestionsError.message);
  }

  return normalizedIds;
};

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
      const normalized = normalizeAgendaPayload(payload);

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
        .select(AGENDA_SELECT_FIELDS)
        .single();
      if (error) throw new Error(error.message);

      try {
        await syncAgendaAudience(data.id, normalized.selectedColaboradorIds);
      } catch (syncError) {
        if (normalized.selectedColaboradorIds.length > 0) {
          await supabase.from("presencial_agendas").delete().eq("id", data.id);
        }
        throw syncError;
      }

      return {
        ...mapDbPresencialAgendaToUi(data, []),
        visibilidadeRestrita: normalized.selectedColaboradorIds.length > 0,
        selectedColaboradorIds: normalized.selectedColaboradorIds,
      };
    },
    onSettled: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useUpdatePresencialAgenda
// ---------------------------------------------------------------------------

export function useUpdatePresencialAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      const normalized = normalizeAgendaPayload(payload);

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
        .select(AGENDA_SELECT_FIELDS)
        .eq("id", id);
      if (error) throw new Error(error.message);

      await syncAgendaAudience(id, normalized.selectedColaboradorIds);

      const row = Array.isArray(data) ? data[0] : data;
      return {
        ...mapDbPresencialAgendaToUi(row, []),
        visibilidadeRestrita: normalized.selectedColaboradorIds.length > 0,
        selectedColaboradorIds: normalized.selectedColaboradorIds,
      };
    },
    onSettled: () => invalidatePresencial(queryClient),
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
    onSettled: () => invalidatePresencial(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useRespondPresencial — optimistic update
// ---------------------------------------------------------------------------

async function addEventToCalendar({ supabaseUrl, agendaDetails }) {
  try {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return null;

    const response = await fetch(`${supabaseUrl}/functions/v1/add-calendar-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        titulo: agendaDetails.titulo,
        dataIso: agendaDetails.dataIso,
        horaIso: agendaDetails.horaIso || "",
        local: agendaDetails.local || "",
        observacao: agendaDetails.observacao || "",
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.eventId || null;
  } catch {
    // silencioso — não bloqueia a confirmação de presença
    return null;
  }
}

async function removeEventFromCalendar({ supabaseUrl, eventId }) {
  try {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) return;

    await fetch(`${supabaseUrl}/functions/v1/remove-calendar-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ eventId }),
    });
  } catch {
    // silencioso — não bloqueia a remoção de presença
  }
}

export function useRespondPresencial(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agendaId, status, currentProfile, agendaDetails }) => {
      const effectiveUserId = currentProfile?.id || userId;
      if (!effectiveUserId || !agendaId) return;

      if (!isSupabaseEnabled || !supabase) return;

      if (!status) {
        // Fetch calendar event ID before deleting the row
        const { data: confirmacao } = await supabase
          .from("presencial_confirmacoes")
          .select("google_calendar_event_id")
          .eq("agenda_id", agendaId)
          .eq("colaborador_id", effectiveUserId)
          .maybeSingle();

        const { error } = await supabase
          .from("presencial_confirmacoes")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("colaborador_id", effectiveUserId);
        if (error) throw new Error(error.message);

        if (confirmacao?.google_calendar_event_id) {
          await removeEventFromCalendar({ supabaseUrl: SUPABASE_URL, eventId: confirmacao.google_calendar_event_id });
        }
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

        if (status === "confirmado" && agendaDetails) {
          const eventId = await addEventToCalendar({ supabaseUrl: SUPABASE_URL, agendaDetails });
          if (eventId) {
            await supabase
              .from("presencial_confirmacoes")
              .update({ google_calendar_event_id: eventId })
              .eq("agenda_id", agendaId)
              .eq("colaborador_id", effectiveUserId);
          }
        }
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
    mutationFn: async ({ agendaId, shouldParticipate, currentProfile, suggestion }) => {
      const effectiveUserId = currentProfile?.id || userId;
      if (!effectiveUserId || !agendaId) return;
      if (!isSupabaseEnabled || !supabase) return;

      const nextStatus = shouldParticipate ? "talvez" : "confirmado";
      const normalizedSuggestion = String(suggestion || "").trim();

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

      if (shouldParticipate && normalizedSuggestion) {
        const { error: suggestionError } = await supabase
          .from("presencial_amigo_secreto_sugestoes")
          .upsert(
            {
              agenda_id: agendaId,
              colaborador_id: effectiveUserId,
              sugestao: normalizedSuggestion,
            },
            {
              onConflict: "agenda_id,colaborador_id",
              ignoreDuplicates: false,
            }
          );
        if (suggestionError) throw new Error(suggestionError.message);
      } else {
        const { error: deleteSuggestionError } = await supabase
          .from("presencial_amigo_secreto_sugestoes")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("colaborador_id", effectiveUserId);
        if (deleteSuggestionError) throw new Error(deleteSuggestionError.message);
      }
    },

    onMutate: async ({ agendaId, shouldParticipate, currentProfile, suggestion }) => {
      await queryClient.cancelQueries({ queryKey: ["presencial", userId] });
      const previous = queryClient.getQueryData(["presencial", userId]);

      queryClient.setQueryData(["presencial", userId], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((agenda) => {
          if (String(agenda.id) !== String(agendaId)) return agenda;
          const effectiveUserId = currentProfile?.id || userId;
          const nextStatus = shouldParticipate ? "talvez" : "confirmado";
          const normalizedSuggestion = shouldParticipate ? String(suggestion || "").trim() : "";
          const confirmacoes = (agenda.confirmacoes || []).map((c) =>
            String(c.colaborador?.id) === String(effectiveUserId)
              ? { ...c, status: nextStatus }
              : c
          );
          return {
            ...agenda,
            confirmacoes,
            minhaSugestaoAmigoSecreto: normalizedSuggestion,
          };
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
      const { data, error } = await supabase.rpc("run_amigo_secreto_draw", { p_agenda_id: agendaId });
      if (error) throw new Error(error.message);
      return Number(data || 0);
    },
    onMutate: async (agendaId) => {
      const optimisticTimestamp = new Date().toISOString();

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["presencial"] }),
        queryClient.cancelQueries({ queryKey: ["admin", "presencial"] }),
      ]);

      const previousPresencial = queryClient.getQueriesData({ queryKey: ["presencial"] });
      const previousAdminPresencial = queryClient.getQueriesData({ queryKey: ["admin", "presencial"] });

      queryClient.setQueriesData({ queryKey: ["presencial"] }, (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((agenda) =>
          String(agenda?.id) === String(agendaId)
            ? { ...agenda, amigoSecretoSorteadoAt: optimisticTimestamp }
            : agenda
        );
      });

      queryClient.setQueriesData({ queryKey: ["admin", "presencial"] }, (prev) => {
        if (!prev || !Array.isArray(prev?.rows)) return prev;
        return {
          ...prev,
          rows: prev.rows.map((agenda) =>
            String(agenda?.id) === String(agendaId)
              ? { ...agenda, amigoSecretoSorteadoAt: optimisticTimestamp }
              : agenda
          ),
        };
      });

      return {
        previousPresencial,
        previousAdminPresencial,
      };
    },
    onError: (_err, _agendaId, context) => {
      for (const [queryKey, data] of context?.previousPresencial || []) {
        queryClient.setQueryData(queryKey, data);
      }
      for (const [queryKey, data] of context?.previousAdminPresencial || []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: () => invalidatePresencial(queryClient),
  });
}
