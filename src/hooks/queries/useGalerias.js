import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { GALERIA_EVENTOS } from "../../data/mockData.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors Layout.jsx)
// ---------------------------------------------------------------------------

const mapDbGaleriaToUi = (eventosRows, fotosRows = null) => {
  const fotosByEvento = new Map();

  if (Array.isArray(fotosRows)) {
    for (const foto of fotosRows || []) {
      const arr = fotosByEvento.get(foto.evento_id) || [];
      arr.push({
        id: foto.id,
        src: foto.foto_url,
        legenda: foto.legenda || "",
        ordem: foto.ordem || 0,
      });
      fotosByEvento.set(foto.evento_id, arr);
    }
  }

  return (eventosRows || []).map((evento) => {
    const nestedFotos = Array.isArray(evento?.galeria_fotos)
      ? evento.galeria_fotos.map((foto) => ({
          id: foto.id,
          src: foto.foto_url,
          legenda: foto.legenda || "",
          ordem: foto.ordem || 0,
        }))
      : [];
    const fromMap = fotosByEvento.get(evento.id) || [];
    const fotos = [...fromMap, ...nestedFotos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return {
      id: evento.id,
      evento: evento.titulo,
      mes: evento.mes_ano || "",
      capa: evento.capa_url || fotos[0]?.src || "https://picsum.photos/seed/galeria-empty/600/450",
      fotos,
    };
  });
};

// ---------------------------------------------------------------------------
// useGalerias
// ---------------------------------------------------------------------------

export function useGalerias(userId) {
  return useQuery({
    queryKey: ["galerias", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return GALERIA_EVENTOS;

      // Primary: try nested join query
      const { data: eventos, error: eventosError } = await supabase
        .from("galeria_eventos")
        .select(
          "id,titulo,mes_ano,capa_url,created_at,galeria_fotos(id,evento_id,foto_url,legenda,ordem,created_at)"
        )
        .order("created_at", { ascending: false })
        .order("ordem", { foreignTable: "galeria_fotos", ascending: true });

      if (!eventosError) {
        return mapDbGaleriaToUi(eventos);
      }

      // Fallback: if embedded relation fails, load separately
      console.warn("Fallback useGalerias sem embed de fotos:", eventosError?.message);
      const { data: eventosOnly, error: eventosOnlyError } = await supabase
        .from("galeria_eventos")
        .select("id,titulo,mes_ano,capa_url,created_at")
        .order("created_at", { ascending: false });
      if (eventosOnlyError) throw eventosOnlyError;

      let fotosRows = [];
      const eventoIds = (eventosOnly || []).map((row) => row.id).filter(Boolean);
      if (eventoIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("galeria_fotos")
          .select("id,evento_id,foto_url,legenda,ordem,created_at")
          .in("evento_id", eventoIds)
          .order("ordem", { ascending: true });
        if (!fotosError) fotosRows = fotos || [];
      }

      return mapDbGaleriaToUi(eventosOnly || [], fotosRows);
    },
    enabled: !!userId || !isSupabaseEnabled,
    staleTime: 90 * 1000,
  });
}
