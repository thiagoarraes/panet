import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { FERIAS_INIT, DAYOFF_INIT } from "../../data/mockData.js";

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

const formatBrDate = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("pt-BR");
};

const mapDbFeriasToUi = (item) => ({
  id: item.id,
  inicio: formatBrDate(item.inicio),
  fim: formatBrDate(item.fim),
  status: item.status,
  tipo: item.tipo,
  colaborador: toAvatar(item.colaborador),
});

export function useFerias(userId, options = {}) {
  const summaryOnly = Boolean(options?.summaryOnly);
  const queryEnabled = options?.enabled ?? true;
  const colaboradorFields = summaryOnly
    ? "id,nome,cargo,cor_avatar,foto_url"
    : "id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github";

  return useQuery({
    queryKey: ["ferias", userId, summaryOnly ? "summary" : "full"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) {
        return { ferias: FERIAS_INIT, dayoff: DAYOFF_INIT };
      }
      const { data, error } = await supabase
        .from("ferias")
        .select(
          `id,inicio,fim,status,tipo,colaborador:colaboradores!ferias_colaborador_id_fkey(${colaboradorFields})`
        )
        .order("inicio", { ascending: true })
        .limit(500);
      if (error) throw error;
      const mapped = (data || []).map(mapDbFeriasToUi);
      return {
        ferias: mapped.filter((x) => x.tipo === "ferias"),
        dayoff: mapped.filter((x) => x.tipo === "dayoff"),
      };
    },
    staleTime: 2 * 60 * 1000,
    enabled: queryEnabled && (!!userId || !isSupabaseEnabled),
  });
}
