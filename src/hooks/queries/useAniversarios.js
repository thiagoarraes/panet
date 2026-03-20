import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { ANIVERSARIANTES_INIT } from "../../data/mockData.js";

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

const daysUntilBirthday = (isoDate) => {
  const now = new Date();
  const target = new Date(`${isoDate}T12:00:00`);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const next =
    thisYearTarget < todayNoon
      ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate(), 12, 0, 0)
      : thisYearTarget;
  const diffMs = next.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const mapColaboradorBirthdayToUi = (item) => {
  const date = new Date(`${item.aniversario}T12:00:00`);
  return {
    id: item.id,
    colaborador: toAvatar(item),
    data: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    diasRestantes: daysUntilBirthday(item.aniversario),
    reacoes: [],
  };
};

export function useAniversarios(userId) {
  return useQuery({
    queryKey: ["aniversarios", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return ANIVERSARIANTES_INIT;
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase.rpc("get_aniversariantes_with_reacoes", { p_ano: currentYear });
      if (error) throw error;
      const mapped = (data || []).map((item) => ({
        ...mapColaboradorBirthdayToUi(item),
        reacoes: Array.isArray(item.reacoes) ? item.reacoes : [],
      }));
      mapped.sort((a, b) => a.diasRestantes - b.diasRestantes);
      return mapped;
    },
    enabled: !!userId || !isSupabaseEnabled,
    staleTime: 6 * 60 * 60 * 1000,
  });
}
