import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Modal } from "@heroui/react";
import { Car, CheckCircle2, Loader2, AlertTriangle, Wallet, MapPin, Briefcase, ChevronDown, Users, Calendar, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useAdminCorridas } from "../../hooks/queries/admin/useAdminCorridas.js";
import { useCorridasClientes, normalizeEndereco } from "../../hooks/queries/admin/useCorridasClientes.js";
import { useDefinirClienteDestino } from "../../hooks/mutations/useCorridasMutations.js";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

const CorridaModal = lazy(() => import("./AdminCorridas/CorridaModal").then((m) => ({ default: m.CorridaModal })));

const PAGE_SIZE = 20;

const formatBrl = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");

const formatDia = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—");
const formatHora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

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
    const onResize = () => setOpen(false);
    const onScroll = (event) => {
      // Rolar dentro da própria lista não deve fechar o dropdown.
      if (listaRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", fechar);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
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

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Filtro de mês custom (input type=month não deixa customizar o popup do browser).
function MesSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [ano, setAno] = useState(() => (value ? Number(value.split("-")[0]) : new Date().getFullYear()));
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  const selAno = value ? Number(value.split("-")[0]) : null;
  const selMes = value ? Number(value.split("-")[1]) - 1 : null;
  const label = value ? `${MESES_LONGO[selMes]} de ${selAno}` : "Todos os meses";

  const abrir = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setAno(value ? Number(value.split("-")[0]) : new Date().getFullYear());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const fechar = (event) => {
      if (triggerRef.current?.contains(event.target) || popRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onScroll = (event) => {
      if (popRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", fechar);
    window.addEventListener("resize", () => setOpen(false));
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const escolher = (mesIdx) => {
    onChange(`${ano}-${String(mesIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div className="corridas-mes-select">
      <button
        ref={triggerRef}
        type="button"
        className="form-input corridas-mes-trigger"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="corridas-mes-atual">
          <span className="corridas-mes-icone"><Calendar size={13} /></span>
          <span className="corridas-mes-textos">
            <span className="corridas-mes-caption">Mês</span>
            <span className="corridas-mes-valor">{label}</span>
          </span>
        </span>
        <ChevronDown size={14} className={`corridas-colab-chevron ${open ? "is-open" : ""}`} />
      </button>

      {open && pos &&
        createPortal(
          <div ref={popRef} className="corridas-mes-pop" role="dialog" style={{ top: pos.top, right: pos.right }}>
            <div className="corridas-mes-pop-head">
              <button type="button" className="corridas-mes-nav" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior">
                <ChevronLeft size={16} />
              </button>
              <span className="corridas-mes-ano">{ano}</span>
              <button type="button" className="corridas-mes-nav" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="corridas-mes-grid">
              {MESES_ABREV.map((m, i) => {
                const ativo = selAno === ano && selMes === i;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`corridas-mes-cel ${ativo ? "active" : ""}`}
                    onClick={() => escolher(i)}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="corridas-mes-limpar"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              disabled={!value}
            >
              Limpar filtro
            </button>
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
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog style={{ maxWidth: 420, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}
            >
              <Briefcase size={16} /> Vincular cliente ao destino
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
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
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button onPress={handleSalvar} isDisabled={definirCliente.isPending || !nome.trim()}>
              {definirCliente.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
            <div className="corridas-stat-label">Total gasto</div>
          </div>
        </div>
        <div className="corridas-stat">
          <span className="corridas-stat-icon"><Car size={16} /></span>
          <div>
            <div className="corridas-stat-value">{totalItems}</div>
            <div className="corridas-stat-label">Corridas</div>
          </div>
        </div>
        <div className="corridas-stat">
          <span className="corridas-stat-icon"><Clock3 size={16} /></span>
          <div>
            <div className="corridas-stat-value">{totals && typeof totals.minutos === "number" ? `${Math.round(totals.minutos)} min` : "—"}</div>
            <div className="corridas-stat-label">Minutos gastos</div>
          </div>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="pan-card">
        <div className="card-header corridas-filtros">
          <ColaboradorSelect colaboradores={colaboradores} value={colaboradorId} onChange={setColaboradorId} />
          <MesSelect value={mes} onChange={setMes} />
        </div>

        {/* ── Lista de trajetos ──────────────────────────────────────────── */}
        <div className="card-body corridas-lista">
          {rows.map((c) => {
            return (
              <button key={c.id} type="button" className="corrida-item" onClick={() => setSelecionada(c)}>
                <div className="corrida-quem">
                  <Avatar col={c.colaborador} size={42} />
                  <div className="corrida-quem-texto">
                    <span className="corrida-quem-nome">{c.colaborador?.nome}</span>
                    <span className="corrida-quem-cargo">{c.colaborador?.cargo || "—"}</span>
                  </div>
                </div>

                <div className="corrida-datahora">
                  <span className="corrida-datahora-icone"><Clock3 size={15} /></span>
                  <div className="corrida-datahora-textos">
                    <span className="corrida-datahora-dia">{formatDia(c.horario || c.created_at)}</span>
                    <span className="corrida-datahora-hora">{formatHora(c.horario || c.created_at)}</span>
                  </div>
                </div>

                <div className="corrida-valor-bloco">
                  {c.status_extracao === "ok" ? (
                    <>
                      <span className="corrida-valor-icone"><Wallet size={15} /></span>
                      <span className="corrida-valor">{formatBrl(c.valor_total)}</span>
                    </>
                  ) : (
                    <StatusBadge status={c.status_extracao} />
                  )}
                </div>

                <span className="corrida-vermais">
                  Ver mais <ChevronRight size={15} />
                </span>
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
            onDefinirCliente={selecionada.destino ? () => setClienteDestino(selecionada.destino) : null}
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
