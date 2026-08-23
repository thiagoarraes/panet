export function SenhaModal({ senhaGerada, senhaCopiada, onCopiar, onClose }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="pan-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            Senha temporária gerada
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            Informe esta senha temporária ao colaborador. No próximo login, ele será obrigado a trocar para uma
            senha permanente.
          </div>
          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{senhaGerada.email}</div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18 }}>{senhaGerada.senha}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="btn-ghost" onClick={onCopiar}>
              {senhaCopiada ? "Copiado!" : "Copiar senha"}
            </button>
            <button className="btn-primary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
