import { useState } from "react";
import { LogOut, Play } from "lucide-react";
import { RODADAS_OPCOES, TEMPO_OPCOES } from "../../../lib/gartic.js";
import { JogadoresPanel } from "../adedonha/JogadoresPanel.jsx";

// Tela de configuracao do host (lobby da sala de gartic).
export function GarticConfig({ sala, jogadores, meuJogador, mut, onlineIds, onSair }) {
  const [config, setConfig] = useState(sala.config);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const setCampo = (campo, valor) => {
    const next = { ...config, [campo]: valor };
    setConfig(next);
    mut.salvarConfig({ salaId: sala.id, config: next }).catch(() => {});
  };

  const iniciar = async () => {
    if (jogadores.length < 2) {
      setErro("Precisa de pelo menos 2 jogadores para começar.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await mut.salvarConfig({ salaId: sala.id, config });
      await mut.iniciarJogo({ salaId: sala.id, jogadores });
    } catch (e) {
      setErro(e?.message || "Não foi possível iniciar.");
      setSalvando(false);
    }
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <h1 className="section-title">{sala.nome}</h1>
          <p className="section-sub">Configurações da sala</p>
        </div>
        <button className="btn-ghost" onClick={onSair}>
          <LogOut size={16} /> Encerrar sala
        </button>
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} mostrarPontos={false} onlineIds={onlineIds} />
        <div className="pan-card">
          <div className="card-body" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="ade-config-grid">
              <div className="ade-field">
                <label>Voltas (cada um desenha)</label>
                <select value={config.voltas} onChange={(e) => setCampo("voltas", Number(e.target.value))}>
                  {RODADAS_OPCOES.map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "volta" : "voltas"}</option>
                  ))}
                </select>
              </div>
              <div className="ade-field">
                <label>Tempo de desenho</label>
                <select value={config.tempo} onChange={(e) => setCampo("tempo", e.target.value)}>
                  {TEMPO_OPCOES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({t.segundos}s)</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="section-sub" style={{ fontSize: 13 }}>
              Cada jogador desenha {config.voltas}× — quem adivinha mais rápido pontua mais.
            </p>

            {erro && <p style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</p>}
            <button className="btn-primary" style={{ alignSelf: "flex-start" }} onClick={iniciar} disabled={salvando}>
              <Play size={16} /> {salvando ? "Iniciando..." : "Iniciar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
