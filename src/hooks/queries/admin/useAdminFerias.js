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

export function useAdminFerias({
  page = 1,
  pageSize = 20,
  search = "",
  tipo = "ferias",
  statusFilter = "ativo",  // "ativo" | "passado" | "todos"
  mes = "",                // "YYYY-MM" ou ""
  colaboradorId = "",      // UUID ou ""
} = {}) {
  const safePage    = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term        = String(search || "").trim();
  const safeTipo    = tipo === "dayoff" ? "dayoff" : "ferias";
  const todayIso    = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [
      "admin", "ferias",
      { page: safePage, pageSize: safePageSize, search: term, tipo: safeTipo, statusFilter, mes, colaboradorId },
    ],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to   = from + safePageSize - 1;

      // Ordem: ativos → mais próximo primeiro; passados/todos → mais recente primeiro
      const ascending = statusFilter === "ativo";

      let rowsQ  = supabase.from("ferias").select("id,inicio,fim,status,tipo,motivo_real,colaborador_id").eq("tipo", safeTipo).order("inicio", { ascending });
      let countQ = supabase.from("ferias").select("id", { count: "exact", head: true }).eq("tipo", safeTipo);

      // ── Filtro de status (data) ──────────────────────────────────────────
      if (statusFilter === "ativo") {
        rowsQ  = rowsQ.gte("fim", todayIso);
        countQ = countQ.gte("fim", todayIso);
      } else if (statusFilter === "passado") {
        rowsQ  = rowsQ.lt("fim", todayIso);
        countQ = countQ.lt("fim", todayIso);
      }

      // ── Filtro de mês ────────────────────────────────────────────────────
      if (mes) {
        const [yr, mo] = mes.split("-").map(Number);
        const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
        const lastDay  = new Date(yr, mo, 0).toISOString().split("T")[0];
        rowsQ  = rowsQ.gte("inicio", firstDay).lte("inicio", lastDay);
        countQ = countQ.gte("inicio", firstDay).lte("inicio", lastDay);
      }

      // ── Filtro de colaborador ────────────────────────────────────────────
      if (colaboradorId) {
        rowsQ  = rowsQ.eq("colaborador_id", colaboradorId);
        countQ = countQ.eq("colaborador_id", colaboradorId);
      }

      // ── Busca textual (só quando colaboradorId não está fixo) ────────────
      if (term && !colaboradorId) {
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
            rowsQ  = rowsQ.or(expression);
            countQ = countQ.or(expression);
          } else {
            rowsQ  = rowsQ.in("colaborador_id", ids);
            countQ = countQ.in("colaborador_id", ids);
          }
        } else if (safeTipo === "dayoff") {
          rowsQ  = rowsQ.ilike("motivo_real", `%${escaped}%`);
          countQ = countQ.ilike("motivo_real", `%${escaped}%`);
        } else {
          rowsQ  = rowsQ.ilike("status", `%${escaped}%`);
          countQ = countQ.ilike("status", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQ.range(from, to), countQ]);
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
