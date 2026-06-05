import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { COLABORADORES } from "../../data/mockData.js";

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

export function useColaboradores(userId, options = {}) {
  const queryClient = useQueryClient();
  const summaryOnly = Boolean(options?.summaryOnly);
  const queryEnabled = options?.enabled ?? true;
  const selectFields = summaryOnly
    ? "id,nome,cargo,perfil,cor_avatar,foto_url,aniversario"
    : "id,nome,cargo,perfil,email,telefone,cor_avatar,foto_url,instagram,linkedin,github,aniversario";

  const query = useQuery({
    queryKey: ["colaboradores", userId, summaryOnly ? "summary" : "full"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return COLABORADORES;
      const { data, error } = await supabase
        .from("colaboradores")
        .select(selectFields)
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []).map((row) => ({
        ...toAvatar(row),
        isMe: row.id === userId,
      }));
    },
    enabled: queryEnabled && (!!userId || !isSupabaseEnabled),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !userId) return;

    const channel = supabase
      .channel(`colaboradores-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "colaboradores" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
          queryClient.invalidateQueries({ queryKey: ["ferias"] });
          queryClient.invalidateQueries({ queryKey: ["aniversarios"] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, queryClient, queryEnabled]);

  return query;
}
