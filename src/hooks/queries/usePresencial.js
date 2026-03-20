import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { PRESENCIAL_INIT } from "../../data/mockData.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors Layout.jsx)
// ---------------------------------------------------------------------------

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

const sortPresencialAgendas = (items) =>
  [...(items || [])].sort((a, b) => {
    const byDate = String(a?.dataIso || "").localeCompare(String(b?.dataIso || ""));
    if (byDate !== 0) return byDate;
    const byTime = String(a?.horaIso || "").localeCompare(String(b?.horaIso || ""));
    if (byTime !== 0) return byTime;
    return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
  });

// ---------------------------------------------------------------------------
// usePresencial
// ---------------------------------------------------------------------------

export function usePresencial(userId) {
  return useQuery({
    queryKey: ["presencial", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return PRESENCIAL_INIT;

      const { data: agendasRows, error: agendasError } = await supabase
        .from("presencial_agendas")
        .select(
          "id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at"
        )
        .order("data_presencial", { ascending: true })
        .order("created_at", { ascending: false });
      if (agendasError) throw agendasError;

      const agendaIds = (agendasRows || []).map((row) => row.id).filter(Boolean);

      const confirmacoesPromise =
        agendaIds.length > 0
          ? supabase
              .from("presencial_confirmacoes")
              .select(
                "id,agenda_id,status,observacao,created_at,colaborador:colaboradores!presencial_confirmacoes_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
              )
              .in("agenda_id", agendaIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null });

      const [confirmacoesResult, secretResult] = await Promise.all([
        confirmacoesPromise,
        supabase.rpc("get_my_amigo_secreto_results"),
      ]);
      if (confirmacoesResult.error) throw confirmacoesResult.error;
      if (secretResult.error) throw secretResult.error;

      const confirmacoesRows = confirmacoesResult.data || [];
      const secretRows = secretResult.data;

      const confirmacoesByAgenda = new Map();
      for (const row of confirmacoesRows) {
        const list = confirmacoesByAgenda.get(String(row.agenda_id)) || [];
        list.push(mapDbPresencialConfirmacaoToUi(row));
        confirmacoesByAgenda.set(String(row.agenda_id), list);
      }

      let secretResultsByAgenda = new Map();
      if (Array.isArray(secretRows)) {
        secretResultsByAgenda = new Map(
          secretRows.map((row) => [
            String(row.agenda_id),
            {
              id: row.tirou_colaborador_id,
              nome: row.nome,
              cargo: row.cargo,
              email: row.email,
              telefone: row.telefone,
              cor_avatar: row.cor_avatar,
              foto_url: row.foto_url,
              instagram: row.instagram,
              linkedin: row.linkedin,
              github: row.github,
            },
          ])
        );
      }

      const mapped = (agendasRows || []).map((row) => ({
        ...mapDbPresencialAgendaToUi(row, confirmacoesByAgenda.get(String(row.id)) || []),
        meuAmigoSecreto: secretResultsByAgenda.has(String(row.id))
          ? toAvatar(secretResultsByAgenda.get(String(row.id)))
          : null,
      }));

      return sortPresencialAgendas(mapped);
    },
    enabled: !!userId || !isSupabaseEnabled,
    staleTime: 45 * 1000,
  });
}
