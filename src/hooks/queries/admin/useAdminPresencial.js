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

const mapDbPresencialAgendaToUi = (item, confirmacoes = []) => ({
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
  confirmacoes,
});

// ---------------------------------------------------------------------------
// useAdminPresencial
// ---------------------------------------------------------------------------

export function useAdminPresencial({ page = 1, pageSize = 20, search = "" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "presencial", { page: safePage, pageSize: safePageSize, search: term }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let rowsQuery = supabase
        .from("presencial_agendas")
        .select(
          "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at"
        )
        .order("data_presencial", { ascending: true })
        .range(from, to);
      let countQuery = supabase.from("presencial_agendas").select("id", { count: "exact", head: true });

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
      if (agendaIds.length > 0) {
        const { data: rows, error: confirmacoesError } = await supabase
          .from("presencial_confirmacoes")
          .select(
            "id,agenda_id,status,observacao,created_at,colaborador:colaboradores!presencial_confirmacoes_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
          )
          .in("agenda_id", agendaIds)
          .order("created_at", { ascending: true });
        if (confirmacoesError) throw new Error(confirmacoesError.message);
        confirmacoesRows = rows || [];
      }

      const confirmacoesByAgenda = new Map();
      for (const row of confirmacoesRows) {
        const list = confirmacoesByAgenda.get(String(row.agenda_id)) || [];
        list.push(mapDbPresencialConfirmacaoToUi(row));
        confirmacoesByAgenda.set(String(row.agenda_id), list);
      }

      const mappedRows = (data || []).map((row) =>
        mapDbPresencialAgendaToUi(row, confirmacoesByAgenda.get(String(row.id)) || [])
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + mappedRows.length;
      return { rows: mappedRows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
