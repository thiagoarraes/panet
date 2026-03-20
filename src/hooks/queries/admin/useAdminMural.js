import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeIlikeTerm = (value) => String(value || "").replace(/[\\%_]/g, (char) => `\\${char}`);

const toAvatar = (profile) => {
  const initials = profile?.nome?.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
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
    redes: { instagram: profile.instagram || "", linkedin: profile.linkedin || "", github: profile.github || "" },
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
// useAdminMural
// ---------------------------------------------------------------------------

export function useAdminMural({ page = 1, pageSize = 20, search = "" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "mural", { page: safePage, pageSize: safePageSize, search: term }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let rowsQuery = supabase
        .from("mural")
        .select("id,texto,created_at,colaborador_id")
        .order("created_at", { ascending: false })
        .range(from, to);
      let countQuery = supabase.from("mural").select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols, error: colsError } = await supabase
          .from("colaboradores")
          .select("id")
          .ilike("nome", `%${escaped}%`)
          .limit(300);
        if (colsError) throw new Error(colsError.message);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          rowsQuery = rowsQuery.in("colaborador_id", ids);
          countQuery = countQuery.in("colaborador_id", ids);
        } else {
          rowsQuery = rowsQuery.ilike("texto", `%${escaped}%`);
          countQuery = countQuery.ilike("texto", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const missingIds = Array.from(new Set((data || []).map((row) => String(row.colaborador_id || "")).filter(Boolean)));
      const lookup = new Map();
      if (missingIds.length > 0) {
        const { data: missingCols } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        (missingCols || []).forEach((row) => lookup.set(String(row.id), row));
      }

      const rows = (data || []).map((row) =>
        mapDbMuralToUi({
          ...row,
          colaborador: lookup.get(String(row.colaborador_id || "")) || toDbLikeColaboradorFromUi({ id: row.colaborador_id, nome: "Colaborador" }),
        })
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
