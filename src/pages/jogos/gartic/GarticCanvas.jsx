import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Trash2 } from "lucide-react";
import { useCanvasBroadcast } from "../../../hooks/queries/useCanvasBroadcast.js";
import { PanTooltip } from "../../../components/ui/PanTooltip";

// Resolucao interna fixa do canvas (4:3). As coordenadas trafegam normalizadas
// (0..1), entao cada cliente renderiza no seu proprio tamanho sem distorcer.
const CW = 800;
const CH = 600;
const FUNDO = "#ffffff";

const CORES = [
  "#1f2933", "#e11d48", "#f97316", "#eab308", "#22c55e",
  "#0ea5e9", "#6366f1", "#a855f7", "#92400e", "#ec4899",
];
const ESPESSURAS = [4, 9, 18];

// Canvas do gartic. O desenhista desenha e emite os tracos via broadcast efemero;
// espectadores recebem e renderizam. Nada e persistido no banco.
export function GarticCanvas({ salaId, isDesenhista, enabled = true }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const desenhandoRef = useRef(false);
  const ultimoRef = useRef(null);

  const [cor, setCor] = useState(CORES[0]);
  const [espessura, setEspessura] = useState(ESPESSURAS[1]);
  const [borracha, setBorracha] = useState(false);

  // Desenha um segmento (coords normalizadas) no contexto local.
  const desenharSegmento = (from, to, corSeg, larguraSeg, apaga) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = apaga ? FUNDO : corSeg;
    ctx.lineWidth = larguraSeg * (apaga ? 2.2 : 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x * CW, from.y * CH);
    ctx.lineTo(to.x * CW, to.y * CH);
    ctx.stroke();
  };

  const limparCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = FUNDO;
    ctx.fillRect(0, 0, CW, CH);
  };

  // Pinta um snapshot (dataURL) recebido por sync — usado por quem entra no meio.
  const aplicarSnapshot = (dataUrl) => {
    const ctx = ctxRef.current;
    if (!ctx || !dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, CW, CH);
    img.src = dataUrl;
  };

  const { emitStroke, emitClear, emitSync, emitSyncRequest } = useCanvasBroadcast({
    salaId,
    enabled,
    onStroke: (p) => desenharSegmento(p.from, p.to, p.cor, p.largura, p.apaga),
    onClear: limparCanvas,
    onSync: (p) => {
      // Só espectador aplica snapshot (o desenhista é a fonte da verdade).
      if (!isDesenhista) aplicarSnapshot(p?.dataUrl);
    },
    onSyncRequest: () => {
      // Desenhista responde a quem entrou com o estado atual do canvas.
      if (isDesenhista) emitirSnapshot();
    },
  });

  // Snapshot JPEG leve do canvas (efemero, via broadcast — nunca vai ao banco).
  const emitirSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    emitSync({ dataUrl: canvas.toDataURL("image/jpeg", 0.5) });
  }, [emitSync]);

  // Inicializa o contexto e pinta o fundo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CW;
    canvas.height = CH;
    ctxRef.current = canvas.getContext("2d");
    limparCanvas();
  }, []);

  // Sincroniza o canvas com quem entra no meio do desenho. Desenhista publica um
  // snapshot periódico; espectador pede o estado atual logo após montar.
  useEffect(() => {
    if (!enabled) return undefined;
    if (isDesenhista) {
      const id = setInterval(emitirSnapshot, 4000);
      return () => clearInterval(id);
    }
    const t = setTimeout(() => emitSyncRequest(), 800);
    return () => clearTimeout(t);
  }, [enabled, isDesenhista, emitirSnapshot, emitSyncRequest]);

  const pontoNormalizado = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (e) => {
    if (!isDesenhista) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    desenhandoRef.current = true;
    ultimoRef.current = pontoNormalizado(e);
  };

  const onPointerMove = (e) => {
    if (!isDesenhista || !desenhandoRef.current) return;
    const atual = pontoNormalizado(e);
    const from = ultimoRef.current;
    ultimoRef.current = atual;
    desenharSegmento(from, atual, cor, espessura, borracha);
    emitStroke({ from, to: atual, cor, largura: espessura, apaga: borracha });
  };

  const onPointerUp = (e) => {
    if (!isDesenhista) return;
    desenhandoRef.current = false;
    ultimoRef.current = null;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
  };

  const limparTudo = () => {
    limparCanvas();
    emitClear();
  };

  return (
    <div className="gartic-canvas-box">
      <canvas
        ref={canvasRef}
        className={`gartic-canvas ${isDesenhista ? "is-drawing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {isDesenhista && (
        <div className="gartic-toolbar">
          <div className="gartic-cores">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                className={`gartic-cor ${cor === c && !borracha ? "on" : ""}`}
                style={{ background: c }}
                onClick={() => { setCor(c); setBorracha(false); }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
          <div className="gartic-tools">
            {ESPESSURAS.map((w) => (
              <button
                key={w}
                type="button"
                className={`gartic-espessura ${espessura === w ? "on" : ""}`}
                onClick={() => setEspessura(w)}
                aria-label={`Espessura ${w}`}
              >
                <span style={{ width: w, height: w }} />
              </button>
            ))}
            <PanTooltip texto="Borracha">
              <button
                type="button"
                className={`gartic-tool ${borracha ? "on" : ""}`}
                onClick={() => setBorracha((b) => !b)}
                aria-label="Borracha"
              >
                <Eraser size={16} />
              </button>
            </PanTooltip>
            <PanTooltip texto="Lápis">
              <button
                type="button"
                className={`gartic-tool ${!borracha ? "on" : ""}`}
                onClick={() => setBorracha(false)}
                aria-label="Lápis"
              >
                <Pencil size={16} />
              </button>
            </PanTooltip>
            <PanTooltip texto="Limpar tudo">
              <button
                type="button"
                className="gartic-tool"
                onClick={limparTudo}
                aria-label="Limpar"
              >
                <Trash2 size={16} />
              </button>
            </PanTooltip>
          </div>
        </div>
      )}
    </div>
  );
}
