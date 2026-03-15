import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function GaleriaLightbox({ eventoAberto, fotoIdx, onClose, onPrev, onNext, onSetFotoIdx }) {
  useEffect(() => {
    if (!eventoAberto) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [eventoAberto, onClose, onNext, onPrev]);

  if (!eventoAberto) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        <X size={18} />
      </button>
      <button className="lightbox-prev lightbox-nav" onClick={(e) => { e.stopPropagation(); onPrev?.(); }}>
        <ChevronLeft size={20} />
      </button>
      <img
        key={fotoIdx}
        className="lightbox-img"
        src={eventoAberto.fotos[fotoIdx].src}
        alt={eventoAberto.fotos[fotoIdx].legenda}
        onClick={(e) => e.stopPropagation()}
      />
      <button className="lightbox-next lightbox-nav" onClick={(e) => { e.stopPropagation(); onNext?.(); }}>
        <ChevronRight size={20} />
      </button>
      <div className="lightbox-caption">
        <div>{eventoAberto.fotos[fotoIdx].legenda}</div>
        <div>{fotoIdx + 1}/{eventoAberto.fotos.length}</div>
      </div>
      <div className="lightbox-strip" onClick={(e) => e.stopPropagation()}>
        {eventoAberto.fotos.map((f, i) => (
          <img key={i} src={f.src} className={`lightbox-thumb ${i === fotoIdx ? "active" : ""}`} onClick={() => onSetFotoIdx?.(i)} alt="" />
        ))}
      </div>
    </div>
  );
}
