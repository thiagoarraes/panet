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

// ---------------------------------------------------------------------------
// useAdminAusencias
// ---------------------------------------------------------------------------

export function useAdminAusencias({ page = 1, pageSize = 20, search = "" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "ausencias", { page: safePage, pageSize: safePageSize, search: term }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let rowsQuery = supabase
        .from("ausencias")
        .select(
          "id,motivo,inicio,fim,estimativa,colaborador:colaboradores!ausencias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
        )
        .order("inicio", { ascending: false });
      let countQuery = supabase.from("ausencias").select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols } = await supabase.from("colaboradores").select("id").ilike("nome", `%${escaped}%`).limit(300);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          rowsQuery = rowsQuery.in("colaborador_id", ids);
          countQuery = countQuery.in("colaborador_id", ids);
        } else {
          rowsQuery = rowsQuery.ilike("motivo", `%${escaped}%`);
          countQuery = countQuery.ilike("motivo", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery.range(from, to), countQuery]);
      if (error) throw new Error(error.message);

      const rows = (data || []).map((item) => ({
        id: item.id,
        motivo: item.motivo,
        inicio: item.inicio,
        fim: item.fim || null,
        estimativa: item.estimativa || null,
        colaborador: toAvatar(item.colaborador),
      }));
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
