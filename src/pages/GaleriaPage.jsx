import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { GALERIA_EVENTOS } from "../data/mockData.js";

const slugifyGaleria = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getGaleriaPath = (evento) => `/galerias/${encodeURIComponent(slugifyGaleria(evento?.evento || ""))}`;

const getSlugFromPath = (pathname) => {
  if (!String(pathname || "").startsWith("/galerias/")) return "";
  const raw = String(pathname).slice("/galerias/".length);
  return decodeURIComponent(raw.split("/")[0] || "").trim();
};

export function GaleriaPage({ eventos = GALERIA_EVENTOS }) {
  const [eventoAberto, setEventoAberto] = useState(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  const abrirEvento = (evento, options = {}) => {
    const shouldSyncUrl = options.syncUrl !== false;
    setEventoAberto(evento);
    setFotoIdx(0);
    if (shouldSyncUrl && typeof window !== "undefined") {
      const targetPath = getGaleriaPath(evento);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, "", targetPath);
      }
    }
  };

  const fechar = useCallback((options = {}) => {
    const shouldSyncUrl = options.syncUrl !== false;
    setEventoAberto(null);
    setFotoIdx(0);
    if (shouldSyncUrl && typeof window !== "undefined" && window.location.pathname !== "/galerias") {
      window.history.replaceState({}, "", "/galerias");
    }
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromPath = () => {
      const slug = getSlugFromPath(window.location.pathname);
      if (!slug) {
        setEventoAberto(null);
        setFotoIdx(0);
        return;
      }

      const match = eventos.find((evento) => slugifyGaleria(evento?.evento || "") === slug);
      if (match) {
        setEventoAberto(match);
        setFotoIdx(0);
      } else {
        setEventoAberto(null);
        setFotoIdx(0);
      }
    };

    syncFromPath();
    const onPopState = () => syncFromPath();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [eventos]);

  return (
    <div className="fade-up">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ImageIcon size={20} /> Galeria de fotos
          </div>
        </div>
      </div>
      <div className="galeria-grid stagger">
        {eventos.map((g) => (
          <div key={g.id} className="galeria-card" onClick={() => abrirEvento(g, { syncUrl: true })}>
            <img src={g.capa} alt={g.evento} />
            <div className="galeria-overlay">
              <div className="galeria-title">{g.evento}</div>
              <div className="galeria-sub">{g.mes} · {g.fotos.length} fotos</div>
            </div>
          </div>
        ))}
      </div>

      {eventoAberto && (
        <div className="lightbox" onClick={() => fechar({ syncUrl: true })}>
          <button className="lightbox-close" onClick={() => fechar({ syncUrl: true })}>
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
          <div className="lightbox-caption">
            <div>{eventoAberto.fotos[fotoIdx].legenda}</div>
            <div>{fotoIdx + 1}/{eventoAberto.fotos.length}</div>
          </div>
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
