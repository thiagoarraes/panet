import { useState } from "react";
import { LogOut, Play, Plus, RotateCcw } from "lucide-react";
import {
  ALFABETO_COMPLETO,
  CONFIG_PADRAO,
  MODO_STOP_OPCOES,
  RODADAS_OPCOES,
  TEMPO_OPCOES,
} from "../../../lib/adedonha.js";
import { JogadoresPanel } from "./JogadoresPanel.jsx";

// Tela de configuracao do host (lobby da sala). Inspirada na tela do StopotS.
export function SalaConfig({ sala, jogadores, meuJogador, mut, onlineIds, onSair }) {
  const [config, setConfig] = useState(sala.config);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const persistir = (next) => {
    mut.salvarConfig({ salaId: sala.id, config: next }).catch(() => {});
  };

  const setCampo = (campo, valor) => {
    const next = { ...config, [campo]: valor };
    setConfig(next);
    persistir(next);
  };

  const addCategoria = () => {
    const nome = novaCategoria.trim();
    if (!nome || config.categorias.includes(nome)) return;
    const next = { ...config, categorias: [...config.categorias, nome] };
    setConfig(next);
    setNovaCategoria("");
    persistir(next);
  };

  const removerCategoria = (nome) => {
    const next = { ...config, categorias: config.categorias.filter((c) => c !== nome) };
    setConfig(next);
    persistir(next);
  };

  const toggleLetra = (letra) => {
    const tem = config.letras.includes(letra);
    const letras = tem ? config.letras.filter((l) => l !== letra) : [...config.letras, letra];
    if (letras.length === 0) return;
    const next = { ...config, letras };
    setConfig(next);
    persistir(next);
  };

  const resetar = () => {
    setConfig(CONFIG_PADRAO);
    persistir(CONFIG_PADRAO);
  };

  const iniciar = async () => {
    if (config.categorias.length === 0) {
      setErro("Adicione ao menos uma categoria.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await mut.salvarConfig({ salaId: sala.id, config });
      await mut.iniciarJogo({ salaId: sala.id, config });
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
                <label htmlFor="sala-config-rodadas">Rodadas</label>
                <select id="sala-config-rodadas" value={config.rodadas} onChange={(e) => setCampo("rodadas", Number(e.target.value))}>
                  {RODADAS_OPCOES.map((n) => (
                    <option key={n} value={n}>{n} rodadas</option>
                  ))}
                </select>
              </div>
              <div className="ade-field">
                <label htmlFor="sala-config-modo-stop">Modo STOP</label>
                <select id="sala-config-modo-stop" value={config.modoStop} onChange={(e) => setCampo("modoStop", e.target.value)}>
                  {MODO_STOP_OPCOES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="ade-field">
                <label htmlFor="sala-config-tempo">Tempo</label>
                <select id="sala-config-tempo" value={config.tempo} onChange={(e) => setCampo("tempo", e.target.value)}>
                  {TEMPO_OPCOES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({t.segundos}s)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ade-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Categorias ({config.categorias.length})</label>
                <button type="button" className="ade-reset-btn" onClick={resetar}>
                  <RotateCcw size={14} /> Padrão
                </button>
              </div>
              <div className="ade-chips" style={{ marginBottom: 8 }}>
                {config.categorias.map((cat) => (
                  <span key={cat} className="ade-chip">
                    {cat}
                    <button type="button" onClick={() => removerCategoria(cat)} aria-label={`Remover ${cat}`}>×</button>
                  </span>
                ))}
              </div>
              <div className="ade-add-row">
                <input
                  value={novaCategoria}
                  placeholder="Nova categoria"
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategoria()}
                />
                <button
                  type="button"
                  className="ade-add-btn"
                  onClick={addCategoria}
                  disabled={!novaCategoria.trim()}
                  aria-label="Adicionar categoria"
                >
                  <Plus size={18} /> Adicionar
                </button>
              </div>
            </div>

            <div className="ade-field">
              <label>Letras ({config.letras.length})</label>
              <div className="ade-letras">
                {ALFABETO_COMPLETO.map((letra) => (
                  <button
                    key={letra}
                    type="button"
                    className={`ade-letra ${config.letras.includes(letra) ? "on" : ""}`}
                    onClick={() => toggleLetra(letra)}
                  >
                    {letra}
                  </button>
                ))}
              </div>
            </div>

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
