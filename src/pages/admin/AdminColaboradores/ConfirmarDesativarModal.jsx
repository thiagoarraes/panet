import { UserMinus, UserCheck } from "lucide-react";
import { Avatar } from "../../../components/Avatar";

export function ConfirmarDesativarModal({ colaborador, action = "desativar", loading, onClose, onConfirm }) {
  const isDesativar = action === "desativar";

  const accentColor = isDesativar ? "#f59e0b" : "var(--accent)";
  const accentAlpha = isDesativar ? "rgba(245,158,11,0.12)" : "color-mix(in srgb, var(--accent) 12%, transparent)";
  const accentBorder = isDesativar ? "rgba(245,158,11,0.3)" : "color-mix(in srgb, var(--accent) 30%, transparent)";

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div
        className="modal"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body" style={{ padding: 32, textAlign: "center" }}>
          {/* Icon */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: accentAlpha,
              border: `1.5px solid ${accentBorder}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              color: accentColor,
            }}
          >
            {isDesativar ? <UserMinus size={26} /> : <UserCheck size={26} />}
          </div>

          {/* Title */}
          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              marginBottom: 6,
            }}
          >
            {isDesativar ? "Tornar Ex Panner?" : "Reativar colaborador?"}
          </div>

          {/* Avatar + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "center",
              margin: "12px 0 16px",
              padding: "10px 16px",
              borderRadius: 10,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
            }}
          >
            <Avatar col={colaborador} size={32} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{colaborador.nome}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{colaborador.cargo}</div>
            </div>
          </div>

          {/* Description */}
          <div
            style={{
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.6,
              marginBottom: 24,
              padding: "0 4px",
            }}
          >
            {isDesativar ? (
              <>
                O acesso de <strong style={{ color: "var(--text)" }}>{colaborador.nome}</strong> à Panet será
                revogado imediatamente.
                <br />
                <span style={{ fontSize: 12, marginTop: 4, display: "inline-block" }}>
                  Os dados históricos serão preservados para consulta interna.
                </span>
              </>
            ) : (
              <>
                <strong style={{ color: "var(--text)" }}>{colaborador.nome}</strong> poderá acessar a Panet
                novamente com as credenciais existentes.
              </>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn-ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                background: isDesativar ? "#f59e0b" : "var(--accent)",
                color: isDesativar ? "#111" : "var(--bg)",
                border: "none",
                borderRadius: 8,
                padding: "10px 22px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
                opacity: loading ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading
                ? isDesativar ? "Desativando…" : "Reativando…"
                : isDesativar ? "Tornar Ex Panner" : "Reativar acesso"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
