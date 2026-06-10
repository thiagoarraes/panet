import { useState } from "react";

// Modal de entrada: escolha de apelido + identificado/anonimo (por partida).
export function EntrarSalaModal({ titulo, nomePadrao, onConfirmar, onCancelar, confirmLabel = "Entrar" }) {
  const [apelido, setApelido] = useState(nomePadrao || "");
  const [anonimo, setAnonimo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const confirmar = async () => {
    const nick = apelido.trim();
    if (!nick) {
      setErro("Escolha um apelido.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await onConfirmar({ apelido: nick, anonimo });
    } catch (e) {
      setErro(e?.message || "Não foi possível entrar.");
      setEnviando(false);
    }
  };

  return (
    <div className="ade-modal-backdrop" onClick={onCancelar}>
      <div className="ade-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18 }}>{titulo}</h3>
        <div className="ade-field">
          <label htmlFor="ade-apelido">Apelido no jogo</label>
          <input
            id="ade-apelido"
            value={apelido}
            maxLength={20}
            placeholder="Como você quer aparecer"
            onChange={(e) => setApelido(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            autoFocus
          />
        </div>
        <label className="ade-toggle">
          <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />
          <span>
            Entrar anônimo
            <br />
            <span className="section-sub" style={{ fontSize: 12 }}>
              Esconde seu nome e foto — mostra só o apelido.
            </span>
          </span>
        </label>
        {erro && <p style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={enviando}>
            {enviando ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
