import { useState } from "react";
import { CalendarDays, Clock, Plane, UserMinus } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { useColabHistorico } from "../../../hooks/queries/admin/useColabHistorico.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateBR = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatMonthYear = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
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
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.3px",
        padding: "3px 9px",
        borderRadius: 20,
        background: m.bg,
        color: m.color,
        border: `1px solid ${m.border}`,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: m.dot,
          flexShrink: 0,
        }}
      />
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: `linear-gradient(100deg, color-mix(in srgb, ${accentColor} 7%, var(--surface2)) 0%, var(--surface2) 60%)`,
        border: `1px solid color-mix(in srgb, ${accentColor} ${dimmed ? "12%" : "22%"}, var(--border))`,
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(0,0,0,0.18)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Accent stripe */}
      <div
        style={{
          width: 3,
          alignSelf: "stretch",
          background: dimmed
            ? "color-mix(in srgb, var(--border) 80%, transparent)"
            : `linear-gradient(180deg, ${accentColor}, color-mix(in srgb, ${accentColor} 55%, transparent))`,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: dimmed ? "var(--muted)" : "var(--text)",
              marginBottom: 5,
              letterSpacing: "-0.1px",
            }}
          >
            {periodo}
          </div>
          {dias && (
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock size={11} style={{ flexShrink: 0 }} />
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

  let timeLabel = "";
  if (item.dia_todo) {
    timeLabel = "Dia todo";
  } else {
    const startTime = formatTimeBR(item.inicio);
    const endTime = fimD ? formatTimeBR(item.fim) : null;
    timeLabel = endTime ? `${startTime} às ${endTime}` : `${startTime} · sem previsão`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: `linear-gradient(100deg, color-mix(in srgb, #FFA032 7%, var(--surface2)) 0%, var(--surface2) 60%)`,
        border: `1px solid color-mix(in srgb, #FFA032 ${dimmed ? "12%" : "22%"}, var(--border))`,
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(0,0,0,0.18)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div
        style={{
          width: 3,
          alignSelf: "stretch",
          background: dimmed
            ? "color-mix(in srgb, var(--border) 80%, transparent)"
            : "linear-gradient(180deg, #FFA032, color-mix(in srgb, #FFA032 55%, transparent))",
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, padding: "13px 16px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: dimmed ? "var(--muted)" : "var(--text)",
              lineHeight: 1.4,
              minWidth: 0,
              wordBreak: "break-word",
            }}
          >
            {item.motivo || "—"}
          </div>
          <StatusBadge status={status} />
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <CalendarDays size={11} style={{ flexShrink: 0 }} />
            {formatDateBR(item.inicio)}
          </span>
          {timeLabel && (
            <span
              style={{
                fontSize: 12,
                color: "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock size={11} style={{ flexShrink: 0 }} />
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "44px 24px",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          opacity: 0.6,
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        height: 68,
        borderRadius: 12,
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
          animation: "shimmer 1.4s infinite",
        }}
      />
    </div>
  );
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
    <>
      {/* shimmer keyframe — injected once */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div
        className="modal-overlay"
        style={{ alignItems: "center" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            width: "min(660px, calc(100vw - 32px))",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "modalIn 0.25s cubic-bezier(.4,0,.2,1)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          }}
        >
          {/* ── Hero header ─────────────────────────────────────────────── */}
          <div
            style={{
              background:
                "linear-gradient(160deg, var(--surface) 0%, color-mix(in srgb, var(--accent) 9%, var(--surface)) 100%)",
              padding: "22px 22px 20px",
              position: "relative",
              flexShrink: 0,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {/* Decorative glow */}
            <div
              style={{
                position: "absolute",
                right: -30,
                top: -30,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Close */}
            <button
              className="modal-close"
              onClick={onClose}
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                zIndex: 1,
              }}
            >
              ×
            </button>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <Avatar col={colaborador} size={46} />
              <div>
                <div
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 700,
                    fontSize: 17,
                    color: "var(--text)",
                    lineHeight: 1.3,
                  }}
                >
                  {colaborador.nome}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {colaborador.cargo}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 8 }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    background:
                      activeTab === tab.id
                        ? `color-mix(in srgb, ${tab.color} 13%, var(--surface2))`
                        : "var(--surface2)",
                    border: `1px solid ${
                      activeTab === tab.id
                        ? `color-mix(in srgb, ${tab.color} 35%, var(--border))`
                        : "var(--border)"
                    }`,
                    borderRadius: 12,
                    padding: "10px 8px 9px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "background 0.18s, border-color 0.18s, transform 0.15s",
                    transform: activeTab === tab.id ? "translateY(-1px)" : "none",
                    boxShadow:
                      activeTab === tab.id
                        ? `0 4px 14px color-mix(in srgb, ${tab.color} 18%, transparent)`
                        : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: "'Sora', sans-serif",
                      color:
                        activeTab === tab.id ? tab.color : "var(--text)",
                      lineHeight: 1,
                      marginBottom: 5,
                    }}
                  >
                    {isLoading ? "—" : counts[tab.id]}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        activeTab === tab.id ? tab.color : "var(--muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      fontWeight: activeTab === tab.id ? 600 : 400,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab label bar ────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 20px 10px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
              background: "color-mix(in srgb, var(--surface2) 50%, var(--surface))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13,
                fontWeight: 600,
                color: activeTabMeta.color,
              }}
            >
              {activeTabMeta.icon}
              {activeTabMeta.label}
              {!isLoading && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: `color-mix(in srgb, ${activeTabMeta.color} 15%, transparent)`,
                    color: activeTabMeta.color,
                    padding: "1px 7px",
                    borderRadius: 20,
                    lineHeight: 1.7,
                  }}
                >
                  {counts[activeTab]}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {!isLoading && counts[activeTab] > 0
                ? `${counts[activeTab]} ${counts[activeTab] === 1 ? "registro" : "registros"}`
                : ""}
            </div>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 18px 18px",
            }}
          >
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {ausencias.map((item) => (
                          <AusenciaEntry key={item.id} item={item} />
                        ))}
                      </div>
                    )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
