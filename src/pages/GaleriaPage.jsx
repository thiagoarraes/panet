import { Suspense, lazy, useState, useEffect, useCallback, useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { SkeletonGaleriaCard } from "../components/Skeleton";
import { useGalerias } from "../hooks/queries/useGalerias.js";

const loadGaleriaLightbox = () => import("../components/GaleriaLightbox");
const GaleriaLightbox = lazy(() => loadGaleriaLightbox().then((m) => ({ default: m.GaleriaLightbox })));

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

export function GaleriaPage({ currentUserId }) {
  const galeriasQuery = useGalerias(currentUserId);
  const eventos = useMemo(() => galeriasQuery.data || [], [galeriasQuery.data]);
  const [eventoAberto, setEventoAberto] = useState(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  const abrirEvento = (evento, options = {}) => {
    loadGaleriaLightbox().catch(() => {});
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
        loadGaleriaLightbox().catch(() => {});
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
      {galeriasQuery.isError && (
        <div className="pan-card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar galeria</div>
            <div className="section-sub">{galeriasQuery.error?.message || "Não foi possível carregar os eventos de galeria."}</div>
          </div>
        </div>
      )}
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ImageIcon size={20} /> Galeria de fotos
          </div>
        </div>
      </div>
      {!galeriasQuery.isLoading && eventos.length === 0 && (
        <div className="empty-state">Nenhuma galeria criada ainda.</div>
      )}
      {galeriasQuery.isLoading && eventos.length === 0 ? (
        <div className="galeria-grid">
          {Array.from({ length: 6 }, (_, i) => <SkeletonGaleriaCard key={i} />)}
        </div>
      ) : (
      <div className="galeria-grid stagger">
        {eventos.map((g) => (
          <div key={g.id} className="galeria-card" onClick={() => abrirEvento(g, { syncUrl: true })}>
            <img src={g.capa} alt={g.evento} />
            <div className="galeria-overlay">
              <div className="galeria-title">{g.evento}</div>
              <div className="galeria-sub">{g.mes} · {Array.isArray(g.fotos) ? g.fotos.length : 0} fotos</div>
            </div>
          </div>
        ))}
      </div>
      )}

      {eventoAberto && (
        <Suspense fallback={null}>
          <GaleriaLightbox
            eventoAberto={eventoAberto}
            fotoIdx={fotoIdx}
            onClose={() => fechar({ syncUrl: true })}
            onPrev={prev}
            onNext={next}
            onSetFotoIdx={setFotoIdx}
          />
        </Suspense>
      )}
    </div>
  );
}
