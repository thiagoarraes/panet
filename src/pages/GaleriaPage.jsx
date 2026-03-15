import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { GALERIA_EVENTOS } from "../data/mockData.js";

export function GaleriaPage({ eventos = GALERIA_EVENTOS }) {
  const [eventoAberto, setEventoAberto] = useState(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  const abrirEvento = (evento) => {
    setEventoAberto(evento);
    setFotoIdx(0);
  };
  const fechar = useCallback(() => setEventoAberto(null), []);
  const prev = useCallback(() => {
    if (!eventoAberto) return;
    setFotoIdx((i) => (i - 1 + eventoAberto.fotos.length) % eventoAberto.fotos.length);
  }, [eventoAberto]);
  const next = useCallback(() => {
    if (!eventoAberto) return;
    setFotoIdx((i) => (i + 1) % eventoAberto.fotos.length);
  }, [eventoAberto]);

  useEffect(() => {
    if (!eventoAberto) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [eventoAberto, fechar, next, prev]);

  return (
    <div className="fade-up">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ImageIcon size={20} /> Galeria de Eventos
          </div>
          <div className="section-sub">Momentos da Pan</div>
        </div>
      </div>
      <div className="galeria-grid stagger">
        {eventos.map((g) => (
          <div key={g.id} className="galeria-card" onClick={() => abrirEvento(g)}>
            <img src={g.capa} alt={g.evento} />
            <div className="galeria-overlay">
              <div className="galeria-title">{g.evento}</div>
              <div className="galeria-sub">{g.mes} · {g.fotos.length} fotos</div>
            </div>
          </div>
        ))}
      </div>

      {eventoAberto && (
        <div className="lightbox" onClick={fechar}>
          <button className="lightbox-close" onClick={fechar}>
            <X size={18} />
          </button>
          <button className="lightbox-prev lightbox-nav" onClick={(e) => { e.stopPropagation(); prev(); }}>
            <ChevronLeft size={20} />
          </button>
          <img
            key={fotoIdx}
            className="lightbox-img"
            src={eventoAberto.fotos[fotoIdx].src}
            alt={eventoAberto.fotos[fotoIdx].legenda}
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-next lightbox-nav" onClick={(e) => { e.stopPropagation(); next(); }}>
            <ChevronRight size={20} />
          </button>
          <div className="lightbox-caption">{eventoAberto.fotos[fotoIdx].legenda} - {fotoIdx + 1}/{eventoAberto.fotos.length}</div>
          <div className="lightbox-strip" onClick={(e) => e.stopPropagation()}>
            {eventoAberto.fotos.map((f, i) => (
              <img key={i} src={f.src} className={`lightbox-thumb ${i === fotoIdx ? "active" : ""}`} onClick={() => setFotoIdx(i)} alt="" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
