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

export function useColaboradores(userId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["colaboradores", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return COLABORADORES;
      const { data, error } = await supabase
        .from("colaboradores")
        .select(
          "id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github,aniversario"
        )
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => ({
        ...toAvatar(row),
        isMe: row.id === userId,
      }));
    },
    enabled: !!userId || !isSupabaseEnabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !userId) return;

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
  }, [userId, queryClient]);

  return query;
}
