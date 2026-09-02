import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock, Download, Globe2, KeyRound, Plus, Search, ShieldCheck } from "lucide-react";
import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";
import { Avatar } from "../../../components/Avatar";
import { useAdminPanPassAcessos, useAdminPanPassServicos } from "../../../hooks/queries/admin/useAdminPanPass";
import { useColaboradores } from "../../../hooks/queries/useColaboradores";
import "../../../styles/panpass.css";
import {
  VAZIO, ACAO, ACAO_VERBO, formatarData,
  StatTile, FiltroColaborador, ServicoModal, ConfirmarExclusao, ServicoCard
} from "./components.jsx";

export function AdminPanPass({ currentUserId }) {
  const servicosQuery = useAdminPanPassServicos();
  const acessosQuery = useAdminPanPassAcessos();
  const colaboradoresQuery = useColaboradores(currentUserId, { summaryOnly: true });
  const [modal, setModal] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroColaboradorId, setFiltroColaboradorId] = useState(null);
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  const [buscaAuditoria, setBuscaAuditoria] = useState("");
  // Instante fixo da montagem: a janela de "7 dias" não pode mudar a cada render.
  const [montadoEm] = useState(() => Date.now());

  // Os `|| []` viram useMemo próprios: sem isso a identidade muda a cada render
  // e invalida os useMemo abaixo.
  const servicosTodos = useMemo(() => servicosQuery.data || [], [servicosQuery.data]);
  const acessos = useMemo(() => acessosQuery.data || [], [acessosQuery.data]);
  const colaboradores = useMemo(() => colaboradoresQuery.data || [], [colaboradoresQuery.data]);
  const colaboradoresPorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );

  const servicos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicosTodos;
    return servicosTodos.filter((s) =>
      `${s.nome} ${s.categoria || ""} ${s.usuario}`.toLowerCase().includes(termo),
    );
  }, [servicosTodos, busca]);

  const acessosFiltrados = useMemo(() => {
    // Até inclui o dia inteiro: comparação por string yyyy-mm-dd evita fuso
    // horário estragar o "hoje" do filtro.
    const dataDe = filtroDataDe || null;
    const dataAte = filtroDataAte || null;
    const termo = buscaAuditoria.trim().toLowerCase();
    return acessos.filter((a) => {
      if (filtroColaboradorId && a.colaborador_id !== filtroColaboradorId) return false;
      const dia = a.created_at.slice(0, 10);
      if (dataDe && dia < dataDe) return false;
      if (dataAte && dia > dataAte) return false;
      if (termo) {
        const alvo = `${a.colaborador?.nome || ""} ${a.servico?.nome || ""} ${a.ip || ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [acessos, filtroColaboradorId, filtroDataDe, filtroDataAte, buscaAuditoria]);

  const stats = useMemo(() => {
    const seteDias = montadoEm - 7 * 24 * 60 * 60 * 1000;
    return {
      ativos: servicosTodos.filter((s) => s.ativo).length,
      total: servicosTodos.length,
      recentes: acessos.filter((a) => new Date(a.created_at).getTime() >= seteDias).length,
      falhas: acessos.filter((a) => !a.sucesso).length,
    };
  }, [servicosTodos, acessos, montadoEm]);

  const baixarCsv = () => {
    const linhas = [
      ["Data", "Colaborador", "Servico", "Acao", "Sucesso", "IP"].join(";"),
      ...acessosFiltrados.map((a) =>
        [
          formatarData(a.created_at),
          a.colaborador?.nome || "-",
          a.servico?.nome || "-",
          ACAO[a.acao]?.label || a.acao,
          a.sucesso ? "sim" : "nao",
          a.ip || "-",
        ].join(";"),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `panpass-acessos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-up pp-admin">
      <header className="pp-hero">
        <div className="pp-hero-texto">
          <span className="pp-hero-selo"><ShieldCheck size={12} /> Cofre auditado</span>
          <h2 className="pp-hero-titulo">PanPass</h2>
          <p className="pp-hero-sub">
            Credenciais dos serviços contratados. As senhas ficam cifradas no banco e só
            saem por função autenticada — cada consulta vira registro.
          </p>
        </div>
        <div className="pp-stats">
          <StatTile Icon={KeyRound} valor={stats.ativos} rotulo="serviços ativos" />
          <StatTile Icon={Activity} valor={stats.recentes} rotulo="consultas em 7 dias" />
          <StatTile
            Icon={AlertTriangle}
            valor={stats.falhas}
            rotulo="tentativas negadas"
            tom={stats.falhas > 0 ? "alerta" : null}
          />
        </div>
      </header>

      <section className="pp-secao">
        <div className="pp-secao-cabeca">
          <div>
            <h3 className="pp-secao-titulo">Serviços</h3>
            <span className="pp-secao-sub">
              {stats.total} {stats.total === 1 ? "cadastrado" : "cadastrados"}
            </span>
          </div>
          <div className="pp-secao-acoes">
            <div className="pp-busca">
              <Search size={14} />
              <input
                placeholder="Buscar serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <button className="btn-primary pp-btn-novo" onClick={() => setModal(VAZIO)}>
              <Plus size={14} /> Novo serviço
            </button>
          </div>
        </div>

        {servicos.length === 0 ? (
          <div className="pp-vazio">
            <span className="pp-vazio-icone"><KeyRound size={20} /></span>
            <div className="pp-vazio-titulo">
              {busca ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
            </div>
            <div className="pp-vazio-sub">
              {busca
                ? "Tente outro termo de busca."
                : "Cadastre o primeiro serviço para a equipe parar de pedir senha no chat."}
            </div>
          </div>
        ) : (
          <div className="pp-servicos-grid">
            {servicos.map((s) => (
              <ServicoCard
                key={s.id}
                servico={s}
                onEditar={(sv) =>
                  setModal({ ...VAZIO, ...sv, senha: "", restrito_a: sv.restrito_a || [] })
                }
                onExcluir={setExcluindo}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pp-secao">
        <div className="pp-secao-cabeca">
          <div>
            <h3 className="pp-secao-titulo">Auditoria</h3>
            <span className="pp-secao-sub">
              últimos 30 dias · {acessosFiltrados.length} {acessosFiltrados.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="pp-secao-acoes">
            <div className="pp-busca">
              <Search size={14} />
              <input
                placeholder="Buscar por nome, serviço ou IP..."
                value={buscaAuditoria}
                onChange={(e) => setBuscaAuditoria(e.target.value)}
              />
            </div>
            <div className="pp-filtro-data">
              <div className="form-group">
                <label className="form-label">DE</label>
                <PanDatePicker
                  value={filtroDataDe}
                  onChange={setFiltroDataDe}
                  maxValue={filtroDataAte}
                />
              </div>
              <div className="form-group">
                <label className="form-label">ATÉ</label>
                <PanDatePicker
                  value={filtroDataAte}
                  onChange={setFiltroDataAte}
                  minValue={filtroDataDe}
                />
              </div>
            </div>
            <FiltroColaborador
              colaboradores={colaboradores}
              selecionadoId={filtroColaboradorId}
              onChange={setFiltroColaboradorId}
            />
            <button className="btn-ghost pp-btn-csv" onClick={baixarCsv} disabled={acessosFiltrados.length === 0}>
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {acessosFiltrados.length === 0 ? (
          <div className="pp-vazio">
            <span className="pp-vazio-icone"><Activity size={20} /></span>
            <div className="pp-vazio-titulo">Nenhum acesso registrado</div>
            <div className="pp-vazio-sub">Toda consulta de credencial aparece aqui, com autor, horário e IP.</div>
          </div>
        ) : (
          <ul className="pp-log">
            {acessosFiltrados.map((a) => {
              const verbo = ACAO_VERBO[a.acao] || "acessou";
              const colaboradorAvatar = colaboradoresPorId.get(a.colaborador_id) || {
                nome: a.colaborador?.nome,
              };
              return (
                <li key={a.id} className={`pp-log-item ${a.sucesso ? "" : "is-falha"}`}>
                  <Avatar col={colaboradorAvatar} size={34} />
                  <div className="pp-log-corpo">
                    <div className="pp-log-linha">
                      <strong>{a.colaborador?.nome || "Colaborador removido"}</strong>
                      <span className="pp-log-conector">{a.sucesso ? verbo : `tentou ${verbo}`}</span>
                      <strong className="pp-log-servico">{a.servico?.nome || "serviço removido"}</strong>
                    </div>
                    {!a.sucesso && (
                      <div className="pp-log-detalhe">
                        <AlertTriangle size={11} /> Negado — {a.detalhe || "sem detalhe"}
                      </div>
                    )}
                  </div>
                  <div className="pp-log-meta">
                    <span className="pp-log-quando">
                      <Clock size={11} />
                      {formatarData(a.created_at)}
                    </span>
                    {a.ip && (
                      <span className="pp-log-ip">
                        <Globe2 size={10} />
                        {a.ip}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal && (
        <ServicoModal inicial={modal} colaboradores={colaboradores} onFechar={() => setModal(null)} />
      )}
      {excluindo && (
        <ConfirmarExclusao servico={excluindo} onFechar={() => setExcluindo(null)} />
      )}
    </div>
  );
}
