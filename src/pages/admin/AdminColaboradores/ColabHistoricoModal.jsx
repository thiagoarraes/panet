import { useState } from "react";
import { Modal } from "@heroui/react";
import { CalendarDays, Clock, Plane, UserMinus } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { useColabHistorico } from "../../../hooks/queries/admin/useColabHistorico.js";
import "../../../styles/colab-historico.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateBR = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};


const formatTimeBR = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const getDiffDays = (inicio, fim) => {
  if (!inicio) return null;
  const fimReal = fim || inicio;
  const a = new Date(inicio.includes("T") ? inicio : `${inicio}T00:00:00`);
  const b = new Date(fimReal.includes("T") ? fimReal : `${fimReal}T00:00:00`);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};

const endOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const getItemStatus = (inicio, fim) => {
  const now     = new Date();
  const inicioD = new Date(inicio.includes("T") ? inicio : `${inicio}T12:00:00`);

  // Se não tem fim definido, o registro expira ao final do dia de início
  // (mesma lógica de getAusenciaEffectiveEnd em ausencias.js)
  const fimD = fim
    ? new Date(fim.includes("T") ? fim : `${fim}T23:59:59`)
    : endOfDay(inicioD);

  if (inicioD > now) return "agendado";
  if (fimD < now)    return "encerrado";
  return "em_andamento";
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_META = {
  encerrado: {
    label: "Encerrado",
    bg: "rgba(255,255,255,0.06)",
    color: "var(--muted)",
    border: "rgba(255,255,255,0.08)",
    dot: "#7a9ab8",
  },
  em_andamento: {
    label: "Em andamento",
    bg: "rgba(46,213,115,0.10)",
    color: "#2ED573",
    border: "rgba(46,213,115,0.25)",
    dot: "#2ED573",
  },
  agendado: {
    label: "Agendado",
    bg: "rgba(91,141,239,0.10)",
    color: "#5B8DEF",
    border: "rgba(91,141,239,0.25)",
    dot: "#5B8DEF",
  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.encerrado;
  // As cores do status sao dado (STATUS_META), nao layout: entram como custom
  // properties e a regra de estilo fica no CSS.
  return (
    <span
      className="hist-badge"
      style={{
        "--hist-badge-bg": m.bg,
        "--hist-badge-color": m.color,
        "--hist-badge-border": m.border,
        "--hist-badge-dot": m.dot,
      }}
    >
      <span className="hist-badge-dot" />
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Entry cards
// ---------------------------------------------------------------------------

function FeriasEntry({ item, accentColor }) {
  const status = getItemStatus(item.inicio, item.fim);
  const dias = getDiffDays(item.inicio, item.fim);
  const inicio = formatDateBR(item.inicio);
  const fim = item.fim ? formatDateBR(item.fim) : null;
  const periodo = fim && fim !== inicio ? `${inicio} → ${fim}` : inicio;
  const dimmed = status === "encerrado";

  return (
    <div
      className={`hist-entry${dimmed ? " is-dimmed" : ""}`}
      style={{ "--hist-accent": accentColor }}
    >
      <div className="hist-entry-stripe" />

      <div className="hist-entry-body hist-entry-body--row">
        <div className="hist-entry-col">
          <div className="hist-entry-title hist-entry-title--periodo">{periodo}</div>
          {dias && (
            <div className="hist-meta">
              <Clock size={11} />
              {dias} {dias === 1 ? "dia" : "dias"}
            </div>
          )}
        </div>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function AusenciaEntry({ item }) {
  const status = getItemStatus(item.inicio, item.fim);
  const fimD = item.fim ? new Date(item.fim) : null;
  const dimmed = status === "encerrado";

  let timeLabel;
  if (item.dia_todo) {
    timeLabel = "Dia todo";
  } else {
    const startTime = formatTimeBR(item.inicio);
    const endTime = fimD ? formatTimeBR(item.fim) : null;
    timeLabel = endTime ? `${startTime} às ${endTime}` : `${startTime} · sem previsão`;
  }

  return (
    <div
      className={`hist-entry${dimmed ? " is-dimmed" : ""}`}
      style={{ "--hist-accent": "#FFA032" }}
    >
      <div className="hist-entry-stripe" />

      <div className="hist-entry-body">
        <div className="hist-entry-head">
          <div className="hist-entry-title hist-entry-title--motivo">
            {item.motivo || "—"}
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="hist-entry-metas">
          <span className="hist-meta">
            <CalendarDays size={11} />
            {formatDateBR(item.inicio)}
          </span>
          {timeLabel && (
            <span className="hist-meta">
              <Clock size={11} />
              {timeLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ icon, message }) {
  return (
    <div className="hist-empty">
      <div className="hist-empty-icon">{icon}</div>
      <span className="hist-empty-msg">{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------

// O brilho do shimmer virou ::after no CSS, junto com a keyframe -- antes uma
// <style> inline reinjetava a keyframe a cada abertura do modal.
function SkeletonCard() {
  return <div className="hist-skeleton" />;
}

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

const TABS = [
  { id: "ferias",    label: "Férias",    icon: <Plane size={13} />,     color: "#5B8DEF" },
  { id: "dayoff",    label: "Day Off",   icon: <CalendarDays size={13} />, color: "#E84B7A" },
  { id: "ausencias", label: "Ausências", icon: <UserMinus size={13} />,  color: "#FFA032" },
];

// ---------------------------------------------------------------------------
// Modal principal
// ---------------------------------------------------------------------------

export function ColabHistoricoModal({ colaborador, onClose }) {
  const [activeTab, setActiveTab] = useState("ferias");
  const { data, isLoading } = useColabHistorico(colaborador?.id);

  const ferias    = data?.ferias    || [];
  const dayoff    = data?.dayoff    || [];
  const ausencias = data?.ausencias || [];
  const counts    = { ferias: ferias.length, dayoff: dayoff.length, ausencias: ausencias.length };

  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog aria-label="Histórico do colaborador" className="hist-dialog">
          {/* ── Hero header ─────────────────────────────────────────────── */}
          <div className="hist-hero">
            <button className="modal-close hist-close" onClick={onClose}>
              ×
            </button>

            {/* Avatar + nome */}
            <div className="hist-identity">
              <Avatar col={colaborador} size={46} />
              <div>
                <div className="hist-name">{colaborador.nome}</div>
                <div className="hist-cargo">{colaborador.cargo}</div>
              </div>
            </div>

            {/* Contagem por aba */}
            <div className="hist-stats">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`hist-stat${activeTab === tab.id ? " is-active" : ""}`}
                  style={{ "--hist-accent": tab.color }}
                >
                  <div className="hist-stat-num">
                    {isLoading ? "—" : counts[tab.id]}
                  </div>
                  <div className="hist-stat-label">
                    {tab.icon}
                    {tab.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab label bar ────────────────────────────────────────────── */}
          <div className="hist-tabbar" style={{ "--hist-accent": activeTabMeta.color }}>
            <div className="hist-tabbar-label">
              {activeTabMeta.icon}
              {activeTabMeta.label}
              {!isLoading && (
                <span className="hist-tabbar-count">{counts[activeTab]}</span>
              )}
            </div>
            <div className="hist-tabbar-total">
              {!isLoading && counts[activeTab] > 0
                ? `${counts[activeTab]} ${counts[activeTab] === 1 ? "registro" : "registros"}`
                : ""}
            </div>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <div className="hist-content">
            {isLoading ? (
              <div className="hist-list">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <>
                {activeTab === "ferias" && (
                  ferias.length === 0
                    ? <EmptyState icon={<Plane size={26} />} message="Nenhuma férias registrada." />
                    : (
                      <div className="hist-list">
                        {ferias.map((item) => (
                          <FeriasEntry key={item.id} item={item} accentColor="#5B8DEF" />
                        ))}
                      </div>
                    )
                )}

                {activeTab === "dayoff" && (
                  dayoff.length === 0
                    ? <EmptyState icon={<CalendarDays size={26} />} message="Nenhum day off registrado." />
                    : (
                      <div className="hist-list">
                        {dayoff.map((item) => (
                          <FeriasEntry key={item.id} item={item} accentColor="#E84B7A" />
                        ))}
                      </div>
                    )
                )}

                {activeTab === "ausencias" && (
                  ausencias.length === 0
                    ? <EmptyState icon={<UserMinus size={26} />} message="Nenhuma ausência registrada." />
                    : (
                      <div className="hist-list">
                        {ausencias.map((item) => (
                          <AusenciaEntry key={item.id} item={item} />
                        ))}
                      </div>
                    )
                )}
              </>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
