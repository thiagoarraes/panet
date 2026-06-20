import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { normalizarConfig } from "../../lib/adedonha.js";

const iniciais = (nome) =>
  String(nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";

// Jogador para o avatar stack, respeitando o anonimato.
const mapJogadorMini = (j) => {
  const col = j.colaborador || {};
  const identificado = !j.anonimo;
  return {
    id: j.id,
    nome: identificado ? col.nome || j.apelido : j.apelido,
    fotoUrl: identificado ? col.foto_url || "" : "",
    foto_url: identificado ? col.foto_url || "" : "",
    cor: identificado ? col.cor_avatar || "#11E7E7" : "#7c83ff",
    foto: identificado ? iniciais(col.nome) : "🎭",
  };
};

const mapSala = (row) => {
  const jogadores = (row.jogadores || []).map(mapJogadorMini);
  return {
    id: row.id,
    nome: row.nome,
    jogo: row.jogo,
    status: row.status,
    fase: row.fase,
    hostId: row.host_id,
    hostNome: row.host?.nome || "",
    config: normalizarConfig(row.config),
    jogadores,
    totalJogadores: jogadores.length,
    createdAt: row.created_at,
  };
};

// Lista de salas abertas (aguardando/jogando) com nome do host e nº de jogadores.
// `jogo` filtra por tipo de jogo (ex.: 'adedonha' | 'gartic'); omitido lista todos.
export function useJogoSalas(options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;
  const jogo = options?.jogo || null;

  const query = useQuery({
    queryKey: ["jogo-salas", jogo],
    enabled: queryEnabled && isSupabaseEnabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];
      let q = supabase
        .from("jogo_salas")
        .select(
          "id,nome,jogo,status,fase,host_id,config,created_at,host:colaboradores!host_id(nome),jogadores:jogo_jogadores(id,apelido,anonimo,colaborador:colaboradores!colaborador_id(nome,foto_url,cor_avatar))"
        )
        .neq("status", "encerrada");
      if (jogo) q = q.eq("jogo", jogo);
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data || []).map(mapSala);
    },
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase) return;
    const channel = supabase
      .channel("jogo-salas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_salas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["jogo-salas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_jogadores" }, () => {
        queryClient.invalidateQueries({ queryKey: ["jogo-salas"] });
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [queryClient, queryEnabled]);

  return query;
}
