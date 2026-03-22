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

export function useAusencias(userId, options = {}) {
  const queryEnabled = options?.enabled ?? true;
  const summaryOnly = Boolean(options?.summaryOnly);

  return useQuery({
    queryKey: ["ausencias", userId, summaryOnly ? "summary" : "full"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      const { data, error } = await supabase.rpc("get_public_ausencias");
      if (error) throw error;
      return (data || []).map((item) => ({
        id: item.id,
        motivo: "",
        inicio: item.inicio,
        fim: item.fim,
        diaTodo: Boolean(item.dia_todo),
        colaborador: toAvatar({
          id: item.colaborador_id,
          nome: item.nome,
          cargo: item.cargo,
          cor_avatar: item.cor_avatar,
          foto_url: item.foto_url,
        }),
      }));
    },
    staleTime: 2 * 60 * 1000,
    enabled: queryEnabled && (!!userId || !isSupabaseEnabled),
  });
}
