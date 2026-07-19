import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Car, Search, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useAdminCorridas } from "../../hooks/queries/admin/useAdminCorridas.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

const CorridaModal = lazy(() => import("./AdminCorridas/CorridaModal").then((m) => ({ default: m.CorridaModal })));

const PAGE_SIZE = 20;

const STATUS_OPCOES = [
  { id: "", label: "Todos" },
  { id: "ok", label: "Extraídas" },
  { id: "pendente", label: "Processando" },
  { id: "erro", label: "Com erro" },
];

const formatBrl = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const formatDuracao = (min) => (typeof min === "number" ? `${min} min` : "—");
const formatKm = (km) => (typeof km === "number" ? `${km} km` : "—");

const StatusBadge = ({ status }) => {
  if (status === "ok") return <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><CheckCircle2 size={12} /> OK</span>;
  if (status === "erro") return <span style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><AlertTriangle size={12} /> Erro</span>;
  return <span style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><Loader2 size={12} className="spin" /> Processando</span>;
};

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
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, totalPages);

  const colaboradores = useMemo(() => {
    const list = Array.isArray(colaboradoresQuery.data) ? colaboradoresQuery.data : [];
    return [...list].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }, [colaboradoresQuery.data]);

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Car size={14} /> Corridas Uber
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="form-input"
              style={{ maxWidth: 240, paddingLeft: 28 }}
              placeholder="Buscar por nome, motivo, local"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 150 }}>
            {STATUS_OPCOES.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input type="month" className="form-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ maxWidth: 160 }} />
          <select className="form-input" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todos os colaboradores</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-body" style={{ overflowX: "auto" }}>
        <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 6px" }}>Colaborador</th>
              <th style={{ padding: "8px 6px" }}>Trajeto</th>
              <th style={{ padding: "8px 6px" }}>Horário</th>
              <th style={{ padding: "8px 6px" }}>Duração</th>
              <th style={{ padding: "8px 6px" }}>Km</th>
              <th style={{ padding: "8px 6px" }}>Veículo</th>
              <th style={{ padding: "8px 6px" }}>Motorista</th>
              <th style={{ padding: "8px 6px" }}>Valor</th>
              <th style={{ padding: "8px 6px" }}>Motivo</th>
              <th style={{ padding: "8px 6px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelecionada(c)}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
              >
                <td style={{ padding: "8px 6px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Avatar col={c.colaborador} size={26} /> {c.colaborador?.nome}
                  </span>
                </td>
                <td style={{ padding: "8px 6px", maxWidth: 220 }}>{c.origem || "?"} → {c.destino || "?"}</td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>{formatDateTime(c.horario)}</td>
                <td style={{ padding: "8px 6px" }}>{formatDuracao(c.duracao_min)}</td>
                <td style={{ padding: "8px 6px" }}>{formatKm(c.km)}</td>
                <td style={{ padding: "8px 6px" }}>{c.veiculo || "—"}</td>
                <td style={{ padding: "8px 6px" }}>{c.motorista || "—"}</td>
                <td style={{ padding: "8px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{formatBrl(c.valor_total)}</td>
                <td style={{ padding: "8px 6px", maxWidth: 200 }}>{c.motivo}</td>
                <td style={{ padding: "8px 6px" }}><StatusBadge status={c.status_extracao} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state" style={{ padding: 20 }}>
                    {isLoading ? "Carregando..." : "Nenhuma corrida registrada."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalItems > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {uiPage} de {totalPages} · {totalItems} corrida(s)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>Anterior</button>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={uiPage >= totalPages}>Próxima</button>
          </div>
        </div>
      )}

      {selecionada && (
        <Suspense fallback={null}>
          <CorridaModal corrida={selecionada} onClose={() => setSelecionada(null)} />
        </Suspense>
      )}
    </div>
  );
}
