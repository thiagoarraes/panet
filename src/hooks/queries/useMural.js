import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { MURAL_INIT } from "../../data/mockData.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors Layout.jsx)
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

const toDbLikeColaboradorFromUi = (item) => ({
  id: item?.id,
  nome: item?.nome || "",
  cargo: item?.cargo || "",
  email: item?.email || "",
  telefone: item?.telefone || "",
  cor_avatar: item?.cor_avatar || item?.cor || "#11E7E7",
  foto_url: item?.foto_url || item?.fotoUrl || "",
  instagram: item?.instagram || item?.redes?.instagram || "",
  linkedin: item?.linkedin || item?.redes?.linkedin || "",
  github: item?.github || item?.redes?.github || "",
});

const getUnknownColaboradorFallback = (id) => ({
  id,
  nome: "Colaborador",
  cargo: "",
  email: "",
  telefone: "",
  cor_avatar: "#11E7E7",
  foto_url: "",
  instagram: "",
  linkedin: "",
  github: "",
});

const mapDbMuralToUi = (item) => {
  const date = new Date(item.created_at);
  const hoje = new Date();
  const label =
    date.toDateString() === hoje.toDateString()
      ? "Hoje"
      : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1).toDateString() === date.toDateString()
        ? "Ontem"
        : date.toLocaleDateString("pt-BR");
  return {
    id: item.id,
    texto: item.texto,
    hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    data: label,
    colaborador: toAvatar(item.colaborador),
  };
};

// ---------------------------------------------------------------------------
// useMural
// ---------------------------------------------------------------------------

export function useMural(userId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mural", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return MURAL_INIT;

      const { data, error } = await supabase
        .from("mural")
        .select("id,texto,created_at,colaborador_id")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;

      // Build local lookup from React Query cache first
      const cachedColaboradores = queryClient.getQueryData(["colaboradores", userId]) || [];
      const localLookup = new Map(
        cachedColaboradores.map((col) => [String(col.id), toDbLikeColaboradorFromUi(col)])
      );

      // Find missing colaborador ids
      const missingIds = Array.from(
        new Set(
          (data || [])
            .map((row) => String(row.colaborador_id || ""))
            .filter((id) => id && !localLookup.has(id))
        )
      );

      if (missingIds.length > 0) {
        const { data: missingCols, error: missingColsError } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        if (!missingColsError) {
          (missingCols || []).forEach((row) => {
            localLookup.set(String(row.id), row);
          });
        }
      }

      return (data || []).map((row) =>
        mapDbMuralToUi({
          ...row,
          colaborador:
            localLookup.get(String(row.colaborador_id || "")) ||
            toDbLikeColaboradorFromUi({ id: row.colaborador_id, nome: "Colaborador" }),
        })
      );
    },
    enabled: !!userId || !isSupabaseEnabled,
    staleTime: 30 * 1000,
  });

  // ---------------------------------------------------------------------------
  // Realtime subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !userId) return;

    const resolveColaborador = async (colaboradorId) => {
      // Try React Query cache first
      const cachedColaboradores = queryClient.getQueryData(["colaboradores", userId]) || [];
      const local = cachedColaboradores.find((col) => String(col.id) === String(colaboradorId));
      if (local) return toDbLikeColaboradorFromUi(local);

      // Fall back to DB fetch
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
        .eq("id", colaboradorId)
        .maybeSingle();
      if (error || !data) return getUnknownColaboradorFallback(colaboradorId);
      return data;
    };

    const channel = supabase
      .channel(`mural-live-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mural" }, async (payload) => {
        const row = payload?.new || {};
        if (!row?.id) return;
        const col = await resolveColaborador(row.colaborador_id);
        const uiMsg = mapDbMuralToUi({
          id: row.id,
          texto: row.texto,
          created_at: row.created_at,
          colaborador: col,
        });
        queryClient.setQueryData(["mural", userId], (prev) => {
          const list = Array.isArray(prev) ? prev : [];
          // Remove any message with the same real id (avoid duplication)
          const withoutSameId = list.filter((item) => String(item.id) !== String(row.id));
          // Replace optimistic message if present (same colaborador + same texto)
          const optimisticIdx = withoutSameId.findIndex(
            (item) =>
              String(item.id).startsWith("optimistic-") &&
              String(item.colaborador?.id) === String(row.colaborador_id) &&
              String(item.texto || "").trim() === String(row.texto || "").trim()
          );
          if (optimisticIdx >= 0) {
            withoutSameId.splice(optimisticIdx, 1);
          }
          return [uiMsg, ...withoutSameId].slice(0, 200);
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mural" }, async (payload) => {
        const row = payload?.new || {};
        if (!row?.id) return;
        const col = await resolveColaborador(row.colaborador_id);
        const uiMsg = mapDbMuralToUi({
          id: row.id,
          texto: row.texto,
          created_at: row.created_at,
          colaborador: col,
        });
        queryClient.setQueryData(["mural", userId], (prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const idx = list.findIndex((item) => String(item.id) === String(row.id));
          if (idx >= 0) {
            const updated = [...list];
            updated[idx] = uiMsg;
            return updated;
          }
          return [uiMsg, ...list].slice(0, 200);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mural" }, (payload) => {
        const oldRow = payload?.old || {};
        if (!oldRow?.id) return;
        queryClient.setQueryData(["mural", userId], (prev) =>
          (prev || []).filter((item) => String(item.id) !== String(oldRow.id))
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, queryClient]);

  return query;
}
