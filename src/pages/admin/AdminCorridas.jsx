import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Car, CheckCircle2, Loader2, AlertTriangle, Wallet, Route, MapPin, Briefcase, Plus, ChevronDown, Users } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useAdminCorridas } from "../../hooks/queries/admin/useAdminCorridas.js";
import { useCorridasClientes, normalizeEndereco } from "../../hooks/queries/admin/useCorridasClientes.js";
import { useDefinirClienteDestino } from "../../hooks/mutations/useCorridasMutations.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

const CorridaModal = lazy(() => import("./AdminCorridas/CorridaModal").then((m) => ({ default: m.CorridaModal })));

const PAGE_SIZE = 20;

const formatBrl = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");

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

// Select custom de colaborador com avatar (option nativa não renderiza imagem).
// A lista abre num portal com posição fixed para não ser cortada pelo overflow do card.
function ColaboradorSelect({ colaboradores, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const listaRef = useRef(null);
  const selecionado = colaboradores.find((c) => c.id === value) || null;

  const abrir = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const fechar = (event) => {
      if (triggerRef.current?.contains(event.target) || listaRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onScrollResize = () => setOpen(false);
    document.addEventListener("pointerdown", fechar);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open]);

  const escolher = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="corridas-colab-select">
      <button
        ref={triggerRef}
        type="button"
        className="form-input corridas-colab-trigger"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="corridas-colab-atual">
          {selecionado ? (
            <>
              <Avatar col={selecionado} size={22} />
              <span className="corridas-colab-nome">{selecionado.nome}</span>
            </>
          ) : (
            <>
              <span className="corridas-colab-todos-icone"><Users size={13} /></span>
              <span className="corridas-colab-nome">Todos os colaboradores</span>
            </>
          )}
        </span>
        <ChevronDown size={14} className={`corridas-colab-chevron ${open ? "is-open" : ""}`} />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={listaRef}
            className="corridas-colab-lista"
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className={`corridas-colab-opcao ${value === "" ? "active" : ""}`}
              onClick={() => escolher("")}
            >
              <span className="corridas-colab-todos-icone"><Users size={13} /></span>
              <span className="corridas-colab-nome">Todos os colaboradores</span>
            </button>
            {colaboradores.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={value === c.id}
                className={`corridas-colab-opcao ${value === c.id ? "active" : ""}`}
                onClick={() => escolher(c.id)}
              >
                <Avatar col={c} size={22} />
                <span className="corridas-colab-nome">{c.nome}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

// Mini modal para vincular um cliente a um destino.
function ClienteModal({ endereco, clienteAtual, onClose }) {
  const [nome, setNome] = useState(clienteAtual || "");
  const [erro, setErro] = useState("");
  const definirCliente = useDefinirClienteDestino();

  const handleSalvar = async () => {
    setErro("");
    try {
      await definirCliente.mutateAsync({ endereco, nome });
      onClose();
    } catch (err) {
      setErro(err?.message || "Não foi possível salvar.");
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="modal collab-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>
            <Briefcase size={16} /> Vincular cliente ao destino
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="corrida-cliente-endereco">
            <MapPin size={13} /> {endereco}
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Nome do cliente</label>
            <input
              className="form-input"
              placeholder="Ex: Cliente Acme"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSalvar()}
              autoFocus
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            Próximas corridas para este destino já vão mostrar o cliente automaticamente.
          </div>
          {erro && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>{erro}</div>}
          <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleSalvar} disabled={definirCliente.isPending || !nome.trim()}>
              {definirCliente.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCorridas({ currentUserId }) {
  const [mes, setMes] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selecionada, setSelecionada] = useState(null);
  const [clienteDestino, setClienteDestino] = useState(null); // endereço sendo vinculado

  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [mes, colaboradorId]);

  const { data, isLoading } = useAdminCorridas({ page: currentPage, pageSize: PAGE_SIZE, mes, colaboradorId });
  const clientesQuery = useCorridasClientes();
  const clientes = clientesQuery.data || new Map();
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
          <ColaboradorSelect colaboradores={colaboradores} value={colaboradorId} onChange={setColaboradorId} />
          <input
            type="month"
            className="form-input corridas-filtro-mes"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-label="Filtrar por mês"
          />
        </div>

        {/* ── Lista de trajetos ──────────────────────────────────────────── */}
        <div className="card-body corridas-lista">
          {rows.map((c) => {
            const cliente = c.destino ? clientes.get(normalizeEndereco(c.destino)) : null;
            return (
              <button key={c.id} type="button" className="corrida-item" onClick={() => setSelecionada(c)}>
                <div className="corrida-quem">
                  <Avatar col={c.colaborador} size={38} />
                  <div className="corrida-quem-texto">
                    <span className="corrida-quem-nome">{c.colaborador?.nome}</span>
                    <span className="corrida-quem-cargo">{c.colaborador?.cargo || "—"}</span>
                  </div>
                </div>

                <div className="corrida-destino-bloco">
                  <span className="corrida-destino-icone"><MapPin size={14} /></span>
                  <div className="corrida-destino-textos">
                    {cliente ? (
                      <span className="corrida-cliente-badge"><Briefcase size={11} /> {cliente}</span>
                    ) : (
                      c.destino && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="corrida-cliente-definir"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteDestino(c.destino);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              setClienteDestino(c.destino);
                            }
                          }}
                        >
                          <Plus size={11} /> Definir cliente
                        </span>
                      )
                    )}
                    <span className="corrida-destino-endereco" title={c.destino || ""}>
                      {c.destino || "Destino não identificado"}
                    </span>
                  </div>
                </div>

                <div className="corrida-motivo-bloco">
                  <span className="corrida-motivo-label">Motivo</span>
                  <span className="corrida-motivo" title={c.motivo}>{c.motivo}</span>
                </div>

                <div className="corrida-valor-bloco">
                  <span className="corrida-valor">{formatBrl(c.valor_total)}</span>
                  <StatusBadge status={c.status_extracao} />
                </div>
              </button>
            );
          })}

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
          <CorridaModal
            corrida={selecionada}
            cliente={selecionada.destino ? clientes.get(normalizeEndereco(selecionada.destino)) : null}
            onClose={() => setSelecionada(null)}
          />
        </Suspense>
      )}

      {clienteDestino && (
        <ClienteModal
          endereco={clienteDestino}
          clienteAtual={clientes.get(normalizeEndereco(clienteDestino)) || ""}
          onClose={() => setClienteDestino(null)}
        />
      )}
    </div>
  );
}
