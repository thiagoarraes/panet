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

export function useAdminAusencias({
  page = 1,
  pageSize = 20,
  search = "",
  statusFilter = "ativo",  // "ativo" | "passado" | "todos"
  mes = "",                // "YYYY-MM" ou ""
  colaboradorId = "",      // UUID ou ""
} = {}) {
  const safePage     = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term         = String(search || "").trim();
  const nowIso       = new Date().toISOString();
  const todayIso     = nowIso.split("T")[0];

  return useQuery({
    queryKey: [
      "admin", "ausencias",
      { page: safePage, pageSize: safePageSize, search: term, statusFilter, mes, colaboradorId },
    ],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to   = from + safePageSize - 1;

      // Ordem: ativos → mais antigo primeiro (os que começaram há mais tempo); passados → mais recente primeiro
      const ascending = statusFilter === "ativo";

      let rowsQ = supabase
        .from("ausencias")
        .select("id,motivo,inicio,fim,dia_todo,colaborador:colaboradores!ausencias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)")
        .order("inicio", { ascending });
      let countQ = supabase.from("ausencias").select("id", { count: "exact", head: true });

      // ── Filtro de status ─────────────────────────────────────────────────
      // "ativo"  → fim IS NULL OR fim >= agora  E  inicio::date >= hoje - 1 (evita abertas muito antigas)
      // "passado" → fim IS NOT NULL AND fim < agora  OU  (fim IS NULL AND inicio < hoje)
      if (statusFilter === "ativo") {
        rowsQ  = rowsQ.gte("inicio", `${todayIso}T00:00:00`);
        countQ = countQ.gte("inicio", `${todayIso}T00:00:00`);
      } else if (statusFilter === "passado") {
        rowsQ  = rowsQ.lt("inicio", `${todayIso}T00:00:00`);
        countQ = countQ.lt("inicio", `${todayIso}T00:00:00`);
      }

      // ── Filtro de mês ────────────────────────────────────────────────────
      if (mes) {
        const [yr, mo] = mes.split("-").map(Number);
        const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
        const lastDay  = new Date(yr, mo, 0).toISOString().split("T")[0];
        rowsQ  = rowsQ.gte("inicio", `${firstDay}T00:00:00`).lte("inicio", `${lastDay}T23:59:59`);
        countQ = countQ.gte("inicio", `${firstDay}T00:00:00`).lte("inicio", `${lastDay}T23:59:59`);
      }

      // ── Filtro de colaborador ────────────────────────────────────────────
      if (colaboradorId) {
        rowsQ  = rowsQ.eq("colaborador_id", colaboradorId);
        countQ = countQ.eq("colaborador_id", colaboradorId);
      }

      // ── Busca textual ────────────────────────────────────────────────────
      if (term && !colaboradorId) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols } = await supabase
          .from("colaboradores")
          .select("id")
          .ilike("nome", `%${escaped}%`)
          .limit(300);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          rowsQ  = rowsQ.in("colaborador_id", ids);
          countQ = countQ.in("colaborador_id", ids);
        } else {
          rowsQ  = rowsQ.ilike("motivo", `%${escaped}%`);
          countQ = countQ.ilike("motivo", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQ.range(from, to), countQ]);
      if (error) throw new Error(error.message);

      const rows = (data || []).map((item) => ({
        id: item.id,
        motivo: item.motivo,
        inicio: item.inicio,
        fim: item.fim || null,
        diaTodo: Boolean(item.dia_todo),
        colaborador: toAvatar(item.colaborador),
      }));
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
