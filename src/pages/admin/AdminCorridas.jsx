import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Car, Search, CheckCircle2, Loader2, AlertTriangle, Wallet, Route, Clock3, Gauge, CarFront, UserRound } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useAdminCorridas } from "../../hooks/queries/admin/useAdminCorridas.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

const CorridaModal = lazy(() => import("./AdminCorridas/CorridaModal").then((m) => ({ default: m.CorridaModal })));

const PAGE_SIZE = 20;

const STATUS_OPCOES = [
  { id: "", label: "Todas" },
  { id: "ok", label: "Extraídas" },
  { id: "pendente", label: "Processando" },
  { id: "erro", label: "Com erro" },
];

const formatBrl = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const StatusBadge = ({ status }) => {
  if (status === "ok") {
    return (
      <span className="corrida-status is-ok">
        <CheckCircle2 size={11} /> Extraída
      </span>
    );
  }
  if (status === "erro") {
    return (
      <span className="corrida-status is-erro">
        <AlertTriangle size={11} /> Erro na leitura
      </span>
    );
  }
  return (
    <span className="corrida-status is-pendente">
      <Loader2 size={11} className="spin" /> Processando
    </span>
  );
};

const MetaChip = ({ Icon, children }) => (
  <span className="corrida-meta-chip">
    <Icon size={11} />
    {children}
  </span>
);

export function AdminCorridas({ currentUserId }) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [mes, setMes] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selecionada, setSelecionada] = useState(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [status, mes, colaboradorId]);

  const { data, isLoading } = useAdminCorridas({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm, status, mes, colaboradorId });
  const colaboradoresQuery = useColaboradores(currentUserId);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);
  const totalItems = data?.count || 0;
  const totals = data?.totals || null;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, totalPages);

  const colaboradores = useMemo(() => {
    const list = Array.isArray(colaboradoresQuery.data) ? colaboradoresQuery.data : [];
    return [...list].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }, [colaboradoresQuery.data]);

  return (
    <div className="corridas-admin fade-up">
      {/* ── Resumo do período ─────────────────────────────────────────────── */}
      <div className="corridas-stats">
        <div className="corridas-stat">
          <span className="corridas-stat-icon"><Wallet size={16} /></span>
          <div>
            <div className="corridas-stat-value">{totals && typeof totals.valor === "number" ? formatBrl(totals.valor) : "—"}</div>
            <div className="corridas-stat-label">Total investido</div>
          </div>
        </div>
        <div className="corridas-stat">
          <span className="corridas-stat-icon"><Car size={16} /></span>
          <div>
            <div className="corridas-stat-value">{totalItems}</div>
            <div className="corridas-stat-label">Corrida(s) no período</div>
          </div>
        </div>
        <div className="corridas-stat">
          <span className="corridas-stat-icon"><Route size={16} /></span>
          <div>
            <div className="corridas-stat-value">{totals && typeof totals.km === "number" ? `${Number(totals.km.toFixed(1))} km` : "—"}</div>
            <div className="corridas-stat-label">Distância percorrida</div>
          </div>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header corridas-filtros">
          <div className="filter-tabs" style={{ margin: 0 }}>
            {STATUS_OPCOES.map((o) => (
              <button key={o.id} className={`filter-tab ${status === o.id ? "active" : ""}`} onClick={() => setStatus(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="corridas-filtros-campos">
            <div className="corridas-busca">
              <Search size={13} />
              <input
                className="form-input"
                placeholder="Nome, motivo ou endereço"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <input type="month" className="form-input" value={mes} onChange={(e) => setMes(e.target.value)} />
            <select className="form-input" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
              <option value="">Todos os colaboradores</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Lista de trajetos ──────────────────────────────────────────── */}
        <div className="card-body corridas-lista">
          {rows.map((c) => (
            <button key={c.id} type="button" className="corrida-item" onClick={() => setSelecionada(c)}>
              <div className="corrida-quem">
                <Avatar col={c.colaborador} size={38} />
                <div className="corrida-quem-texto">
                  <span className="corrida-quem-nome">{c.colaborador?.nome}</span>
                  <span className="corrida-quem-cargo">{c.colaborador?.cargo || "—"}</span>
                </div>
              </div>

              <div className="corrida-rota">
                <span className="corrida-rota-linha" aria-hidden="true">
                  <i className="dot-origem" />
                  <i className="tracado" />
                  <i className="dot-destino" />
                </span>
                <div className="corrida-rota-textos">
                  <span className="corrida-rota-endereco">{c.origem || "Origem não identificada"}</span>
                  <span className="corrida-rota-endereco is-destino">{c.destino || "Destino não identificado"}</span>
                </div>
              </div>

              <div className="corrida-detalhes">
                <div className="corrida-meta">
                  <MetaChip Icon={Clock3}>{formatDateTime(c.horario)}{typeof c.duracao_min === "number" ? ` · ${c.duracao_min} min` : ""}</MetaChip>
                  {typeof c.km === "number" && <MetaChip Icon={Gauge}>{c.km} km</MetaChip>}
                  {c.veiculo && <MetaChip Icon={CarFront}>{c.veiculo}</MetaChip>}
                  {c.motorista && <MetaChip Icon={UserRound}>{c.motorista}</MetaChip>}
                </div>
                <div className="corrida-motivo" title={c.motivo}>{c.motivo}</div>
              </div>

              <div className="corrida-valor-bloco">
                <span className="corrida-valor">{formatBrl(c.valor_total)}</span>
                <StatusBadge status={c.status_extracao} />
              </div>
            </button>
          ))}

          {rows.length === 0 && (
            <div className="corridas-vazio">
              <span className="corridas-vazio-icone"><Car size={22} /></span>
              {isLoading ? "Carregando corridas..." : "Nenhuma corrida no período. Ajuste os filtros ou aguarde novos envios."}
            </div>
          )}
        </div>

        {totalItems > PAGE_SIZE && (
          <div className="corridas-paginacao">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Página {uiPage} de {totalPages} · {totalItems} corrida(s)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>Anterior</button>
              <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={uiPage >= totalPages}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      {selecionada && (
        <Suspense fallback={null}>
          <CorridaModal corrida={selecionada} onClose={() => setSelecionada(null)} />
        </Suspense>
      )}
    </div>
  );
}
