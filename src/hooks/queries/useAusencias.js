import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

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

export function useAusencias(userId) {
  return useQuery({
    queryKey: ["ausencias", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const { data, error } = await supabase
        .from("ausencias")
        .select(
          "id,motivo,inicio,fim,estimativa,colaborador:colaboradores!ausencias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
        )
        .order("inicio", { ascending: false });
      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.id,
        motivo: item.motivo,
        inicio: item.inicio,
        fim: item.fim,
        estimativa: item.estimativa,
        colaborador: toAvatar(item.colaborador),
      }));
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!userId || !isSupabaseEnabled,
  });
}
