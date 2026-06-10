import { LogOut } from "lucide-react";
import { JogadoresPanel } from "./JogadoresPanel.jsx";

// Tela de espera para jogadores nao-host: aguardando o host iniciar.
export function SalaEspera({ sala, jogadores, meuJogador, onSair }) {
  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <h1 className="section-title">{sala.nome}</h1>
          <p className="section-sub">Sala criada por {sala.hostNome || "colaborador"}</p>
        </div>
        <button className="btn-ghost" onClick={onSair}>
          <LogOut size={16} /> Sair
        </button>
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} mostrarPontos={false} />
        <div className="card">
          <div className="card-body" style={{ padding: 32, textAlign: "center" }}>
            <h3 style={{ marginBottom: 8 }}>Aguardando o host iniciar…</h3>
            <p className="section-sub">
              {sala.config.rodadas} rodadas · {sala.config.categorias.length} categorias
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
