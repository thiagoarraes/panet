import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapePostgrestOrTerm = (value) =>
  String(value || "")
    .replace(/[,*().]/g, " ")
    .trim();

const toAvatar = (profile) => {
  const initials = profile?.nome?.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    perfil: profile.perfil || "colaborador",
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

const mapDbPresencialConfirmacaoToUi = (item) => ({
  id: item.id,
  status: item.status || "confirmado",
  observacao: item.observacao || "",
  createdAt: item.created_at || null,
  colaborador: toAvatar(item.colaborador),
});

const mapDbPresencialAgendaToUi = (item, confirmacoes = [], colaboradoresSelecionados = []) => ({
  id: item.id,
  titulo: item.titulo || "Dia presencial",
  dataIso: item.data_presencial,
  horaIso: String(item.hora_presencial || "").slice(0, 5),
  amigoSecretoAtivo: Boolean(item.amigo_secreto_ativo),
  amigoSecretoRegras: item.amigo_secreto_regras || "",
  amigoSecretoSorteadoAt: item.amigo_secreto_sorteado_at || null,
  local: item.local || "Escritorio Pan",
  mapsUrl: item.maps_url || "",
  vagas: Number(item.vagas || 0),
  observacao: item.observacao || "",
  status: item.status || "aberto",
  createdAt: item.created_at || null,
  visibilidadeRestrita: colaboradoresSelecionados.length > 0,
  selectedColaboradorIds: colaboradoresSelecionados.map((colaborador) => colaborador.id),
  colaboradoresSelecionados,
  confirmacoes,
});

// ---------------------------------------------------------------------------
// useAdminPresencial
// ---------------------------------------------------------------------------

export function useAdminPresencial({ page = 1, pageSize = 20, search = "", filtro = "ativos" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();
  const safeFiltro = filtro === "passados" ? "passados" : "ativos";

  return useQuery({
    queryKey: ["admin", "presencial", { page: safePage, pageSize: safePageSize, search: term, filtro: safeFiltro }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { rows: [], count: 0 };

      // Auto-close any event whose date has already passed (best-effort; errors ignored).
      await supabase.rpc("auto_close_past_presencial_agendas").catch(() => {});

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      // Usa data LOCAL (não UTC) para evitar que eventos de hoje sumam do filtro
      // "ativos" após as 21h no Brasil (quando UTC já virou para o dia seguinte).
      const _now = new Date();
      const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

      // Passados: date < today OR already closed/cancelled — most recent first.
      // Ativos:   date >= today AND not cancelled — soonest first.
      const ascending = safeFiltro === "ativos";

      let rowsQuery = supabase
        .from("presencial_agendas")
        .select(
          "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at"
        )
        .order("data_presencial", { ascending })
        .range(from, to);
      let countQuery = supabase.from("presencial_agendas").select("id", { count: "exact", head: true });

      if (safeFiltro === "ativos") {
        // Future + today, excluding cancelled
        rowsQuery = rowsQuery.gte("data_presencial", today).neq("status", "cancelado");
        countQuery = countQuery.gte("data_presencial", today).neq("status", "cancelado");
      } else {
        // Past by date OR already closed/cancelled (covers manually-closed future events too)
        const pastFilter = `data_presencial.lt.${today},status.in.(encerrado,cancelado)`;
        rowsQuery = rowsQuery.or(pastFilter);
        countQuery = countQuery.or(pastFilter);
      }

      if (term) {
        const escaped = escapePostgrestOrTerm(term);
        const expression = `titulo.ilike.*${escaped}*,local.ilike.*${escaped}*,observacao.ilike.*${escaped}*`;
        rowsQuery = rowsQuery.or(expression);
        countQuery = countQuery.or(expression);
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const agendaIds = (data || []).map((row) => row.id).filter(Boolean);
      let confirmacoesRows = [];
      let audienceRows = [];
      if (agendaIds.length > 0) {
        const [{ data: confirmacoesData, error: confirmacoesError }, { data: audienceData, error: audienceError }] =
          await Promise.all([
            supabase
              .from("presencial_confirmacoes")
              .select(
                "id,agenda_id,status,observacao,created_at,colaborador:colaboradores!presencial_confirmacoes_colaborador_id_fkey(id,nome,cargo,perfil,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
              )
              .in("agenda_id", agendaIds)
              .order("created_at", { ascending: true }),
            supabase
              .from("presencial_agenda_convidados")
              .select(
                "agenda_id,colaborador:colaboradores!presencial_agenda_convidados_colaborador_id_fkey(id,nome,cargo,perfil,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
              )
              .in("agenda_id", agendaIds),
          ]);

        if (confirmacoesError) throw new Error(confirmacoesError.message);
        if (audienceError) throw new Error(audienceError.message);

        confirmacoesRows = confirmacoesData || [];
        audienceRows = audienceData || [];
      }

      const confirmacoesByAgenda = new Map();
      for (const row of confirmacoesRows) {
        const list = confirmacoesByAgenda.get(String(row.agenda_id)) || [];
        list.push(mapDbPresencialConfirmacaoToUi(row));
        confirmacoesByAgenda.set(String(row.agenda_id), list);
      }

      const audienceByAgenda = new Map();
      for (const row of audienceRows) {
        if (!row?.colaborador?.id) continue;
        const list = audienceByAgenda.get(String(row.agenda_id)) || [];
        list.push(toAvatar(row.colaborador));
        audienceByAgenda.set(String(row.agenda_id), list);
      }

      const mappedRows = (data || []).map((row) => {
        const agendaId = String(row.id);
        const colaboradoresSelecionados = audienceByAgenda.get(agendaId) || [];
        const selectedIds = new Set(colaboradoresSelecionados.map((colaborador) => String(colaborador.id)));
        const confirmacoes =
          colaboradoresSelecionados.length > 0
            ? (confirmacoesByAgenda.get(agendaId) || []).filter((item) =>
                selectedIds.has(String(item.colaborador?.id || ""))
              )
            : confirmacoesByAgenda.get(agendaId) || [];

        return mapDbPresencialAgendaToUi(row, confirmacoes, colaboradoresSelecionados);
      });
      const safeCount = Number.isFinite(count) ? Number(count) : from + mappedRows.length;
      return { rows: mappedRows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
