import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";
import { createSignedUrlMap, resolveSignedMediaUrl } from "../../../lib/storageMedia.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapePostgrestOrTerm = (value) =>
  String(value || "")
    .replace(/[,*().]/g, " ")
    .trim();

const mapDbGaleriaToUi = (eventosRows, fotosRows = null, signedUrlMap = new Map()) => {
  const fotosByEvento = new Map();
  if (Array.isArray(fotosRows)) {
    for (const foto of fotosRows || []) {
      const arr = fotosByEvento.get(foto.evento_id) || [];
      arr.push({
        id: foto.id,
        src: resolveSignedMediaUrl("galeria", foto.foto_url, signedUrlMap, ""),
        legenda: foto.legenda || "",
        ordem: foto.ordem || 0,
      });
      fotosByEvento.set(foto.evento_id, arr);
    }
  }
  return (eventosRows || []).map((evento) => {
    const fromMap = fotosByEvento.get(evento.id) || [];
    const fotos = fromMap.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return {
      id: evento.id,
      evento: evento.titulo,
      mes: evento.mes_ano || "",
      capa:
        resolveSignedMediaUrl("galeria", evento.capa_url, signedUrlMap, "") ||
        fotos[0]?.src ||
        "https://picsum.photos/seed/galeria-empty/600/450",
      fotos,
    };
  });
};

// ---------------------------------------------------------------------------
// useAdminGaleria
// ---------------------------------------------------------------------------

export function useAdminGaleria({ page = 1, pageSize = 20, search = "" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "galerias", { page: safePage, pageSize: safePageSize, search: term }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

      let rowsQuery = supabase
        .from("galeria_eventos")
        .select("id,titulo,mes_ano,capa_url,created_at")
        .order("created_at", { ascending: false })
        .range(from, to);
      let countQuery = supabase.from("galeria_eventos").select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapePostgrestOrTerm(term);
        const expression = `titulo.ilike.*${escaped}*,mes_ano.ilike.*${escaped}*`;
        rowsQuery = rowsQuery.or(expression);
        countQuery = countQuery.or(expression);
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const eventoIds = (data || []).map((row) => row.id).filter(Boolean);
      let fotosRows = [];
      if (eventoIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("galeria_fotos")
          .select("id,evento_id,foto_url,legenda,ordem")
          .in("evento_id", eventoIds)
          .order("ordem", { ascending: true });
        if (fotosError) throw new Error(fotosError.message);
        fotosRows = fotos || [];
      }

      const signedUrlMap = await createSignedUrlMap("galeria", [
        ...(data || []).map((evento) => evento.capa_url),
        ...(fotosRows || []).map((foto) => foto.foto_url),
      ]);
      const rows = mapDbGaleriaToUi(data || [], fotosRows, signedUrlMap);
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}
