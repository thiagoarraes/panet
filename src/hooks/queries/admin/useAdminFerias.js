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

const formatBrDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "");

const mapDbFeriasToUi = (item) => ({
  id: item.id,
  inicio: formatBrDate(item.inicio),
  fim: formatBrDate(item.fim),
  status: item.status,
  tipo: item.tipo,
  motivoReal: item.motivo_real || "",
  colaborador: toAvatar(item.colaborador),
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

// ---------------------------------------------------------------------------
// useAdminFerias
// ---------------------------------------------------------------------------

export function useAdminFerias({ page = 1, pageSize = 20, search = "", tipo = "ferias" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();
  const safeTipo = tipo === "dayoff" ? "dayoff" : "ferias";

  return useQuery({
    queryKey: ["admin", "ferias", { page: safePage, pageSize: safePageSize, search: term, tipo: safeTipo }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let rowsQuery = supabase
        .from("ferias")
        .select("id,inicio,fim,status,tipo,motivo_real,colaborador_id")
        .eq("tipo", safeTipo)
        .order("inicio", { ascending: true });

      let countQuery = supabase.from("ferias").select("id", { count: "exact", head: true }).eq("tipo", safeTipo);

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols, error: colsError } = await supabase
          .from("colaboradores")
          .select("id")
          .or(`nome.ilike.%${escaped}%,cargo.ilike.%${escaped}%`)
          .limit(300);
        if (colsError) throw new Error(colsError.message);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          if (safeTipo === "dayoff") {
            const serializedIds = ids.map((id) => `"${id}"`).join(",");
            const expression = `colaborador_id.in.(${serializedIds}),motivo_real.ilike.%${escaped}%`;
            rowsQuery = rowsQuery.or(expression);
            countQuery = countQuery.or(expression);
          } else {
            rowsQuery = rowsQuery.in("colaborador_id", ids);
            countQuery = countQuery.in("colaborador_id", ids);
          }
        } else {
          if (safeTipo === "dayoff") {
            rowsQuery = rowsQuery.ilike("motivo_real", `%${escaped}%`);
            countQuery = countQuery.ilike("motivo_real", `%${escaped}%`);
          } else {
            rowsQuery = rowsQuery.ilike("status", `%${escaped}%`);
            countQuery = countQuery.ilike("status", `%${escaped}%`);
          }
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery.range(from, to), countQuery]);
      if (error) throw new Error(error.message);

      const missingIds = Array.from(new Set((data || []).map((row) => String(row.colaborador_id || "")).filter(Boolean)));
      const lookup = new Map();
      if (missingIds.length > 0) {
        const { data: cols } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        (cols || []).forEach((row) => lookup.set(String(row.id), row));
      }

      const rows = (data || []).map((row) =>
        mapDbFeriasToUi({
          ...row,
          colaborador: lookup.get(String(row.colaborador_id || "")) || getUnknownColaboradorFallback(row.colaborador_id),
        })
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
