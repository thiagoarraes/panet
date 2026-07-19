import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

const escapeIlikeTerm = (value) => String(value || "").replace(/[\\%_]/g, (char) => `\\${char}`);

const toAvatar = (profile) => {
  const initials = profile?.nome?.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    foto_url: profile.foto_url || "",
    fotoUrl: profile.foto_url || "",
    foto: initials || "U",
    cor: profile.cor_avatar || "#11E7E7",
  };
};

const getUnknownColaboradorFallback = (id) => ({ id, nome: "Colaborador", cargo: "", cor_avatar: "#11E7E7", foto_url: "" });

// Histórico de corridas para o painel admin, com filtros e paginação.
export function useAdminCorridas({
  page = 1,
  pageSize = 20,
  search = "",
  mes = "",            // "YYYY-MM" ou ""
  colaboradorId = "",  // UUID ou ""
  status = "",         // "" | "pendente" | "ok" | "erro"
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "corridas", { page: safePage, pageSize: safePageSize, search: term, mes, colaboradorId, status }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      const cols =
        "id,colaborador_id,motivo,recibo_path,recibo_mime,status_extracao,erro_extracao,origem,destino,horario,duracao_min,km,veiculo,motorista,valor_total,created_at";
      let rowsQ = supabase.from("corridas").select(cols).order("created_at", { ascending: false });
      let countQ = supabase.from("corridas").select("id", { count: "exact", head: true });

      if (status) {
        rowsQ = rowsQ.eq("status_extracao", status);
        countQ = countQ.eq("status_extracao", status);
      }

      if (mes) {
        const [yr, mo] = mes.split("-").map(Number);
        const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01T00:00:00`;
        const lastDay = new Date(yr, mo, 0, 23, 59, 59).toISOString();
        rowsQ = rowsQ.gte("created_at", firstDay).lte("created_at", lastDay);
        countQ = countQ.gte("created_at", firstDay).lte("created_at", lastDay);
      }

      if (colaboradorId) {
        rowsQ = rowsQ.eq("colaborador_id", colaboradorId);
        countQ = countQ.eq("colaborador_id", colaboradorId);
      }

      // Busca textual: por motivo/origem/destino, ou por nome do colaborador.
      if (term && !colaboradorId) {
        const escaped = escapeIlikeTerm(term);
        const { data: matchCols } = await supabase
          .from("colaboradores")
          .select("id")
          .ilike("nome", `%${escaped}%`)
          .limit(300);
        const ids = (matchCols || []).map((r) => r.id);
        const parts = [
          `motivo.ilike.%${escaped}%`,
          `origem.ilike.%${escaped}%`,
          `destino.ilike.%${escaped}%`,
        ];
        if (ids.length > 0) parts.push(`colaborador_id.in.(${ids.map((id) => `"${id}"`).join(",")})`);
        const expr = parts.join(",");
        rowsQ = rowsQ.or(expr);
        countQ = countQ.or(expr);
      }

      // Totais do período filtrado via RPC (agregados PostgREST desabilitados no projeto).
      let aggIni = null;
      let aggFim = null;
      if (mes) {
        const [yr, mo] = mes.split("-").map(Number);
        aggIni = `${yr}-${String(mo).padStart(2, "0")}-01T00:00:00`;
        aggFim = new Date(yr, mo, 0, 23, 59, 59).toISOString();
      }
      const aggQ = supabase.rpc("corridas_totais", {
        p_status: status || null,
        p_colaborador: colaboradorId || null,
        p_ini: aggIni,
        p_fim: aggFim,
      });

      const [{ data, error }, { count }, aggResult] = await Promise.all([rowsQ.range(from, to), countQ, aggQ]);
      if (error) throw new Error(error.message);
      const agg = aggResult?.error ? null : aggResult?.data?.[0] || null;

      const missingIds = Array.from(new Set((data || []).map((r) => String(r.colaborador_id || "")).filter(Boolean)));
      const lookup = new Map();
      if (missingIds.length > 0) {
        const { data: profs } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,cor_avatar,foto_url")
          .in("id", missingIds);
        (profs || []).forEach((p) => lookup.set(String(p.id), p));
      }

      const rows = (data || []).map((row) => ({
        ...row,
        colaborador: toAvatar(lookup.get(String(row.colaborador_id || "")) || getUnknownColaboradorFallback(row.colaborador_id)),
      }));
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const toNum = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
      return { rows, count: safeCount, totals: agg ? { valor: toNum(agg.valor), km: toNum(agg.km), minutos: toNum(agg.minutos) } : null };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
