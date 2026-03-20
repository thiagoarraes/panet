import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getGaleriaStoragePathFromUrl, optimizeImageToWebp } from "../../lib/imageUtils.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GALERIA_PUBLIC_BASE = "https://panet.agenciapan.com/galerias";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invalidateGalerias = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["galerias"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "galerias"] });
};

// ---------------------------------------------------------------------------
// useCreateGaleriaEvento
// ---------------------------------------------------------------------------

export function useCreateGaleriaEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { data, error } = await supabase
        .from("galeria_eventos")
        .insert({
          titulo: payload.titulo,
          mes_ano: payload.mes_ano || null,
        })
        .select("id,titulo,mes_ano,capa_url,created_at")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useUpdateGaleriaEvento
// ---------------------------------------------------------------------------

export function useUpdateGaleriaEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from("galeria_eventos")
        .update({
          titulo: payload.titulo,
          mes_ano: payload.mes_ano || null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useDeleteGaleriaEvento
// ---------------------------------------------------------------------------

export function useDeleteGaleriaEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseEnabled || !supabase) return;
      // First fetch photos to delete from storage
      const { data: fotos, error: fotosError } = await supabase
        .from("galeria_fotos")
        .select("foto_url")
        .eq("evento_id", id);
      if (fotosError) throw new Error(fotosError.message);

      const storagePaths = Array.from(
        new Set(
          (fotos || [])
            .map((foto) => getGaleriaStoragePathFromUrl(foto?.foto_url))
            .filter(Boolean)
        )
      );

      if (storagePaths.length > 0) {
        const { error: removeError } = await supabase.storage.from("galeria").remove(storagePaths);
        if (removeError) throw new Error(removeError.message);
      }

      const { error } = await supabase.from("galeria_eventos").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useAddGaleriaFoto
// ---------------------------------------------------------------------------

export function useAddGaleriaFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventoId, payload }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("galeria_fotos").insert({
        evento_id: eventoId,
        foto_url: payload.foto_url,
        legenda: payload.legenda || null,
        ordem: payload.ordem || 0,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useUpdateGaleriaFoto
// ---------------------------------------------------------------------------

export function useUpdateGaleriaFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fotoId, payload }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from("galeria_fotos")
        .update({
          foto_url: payload.foto_url,
          legenda: payload.legenda || null,
        })
        .eq("id", fotoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useDeleteGaleriaFoto
// ---------------------------------------------------------------------------

export function useDeleteGaleriaFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fotoId) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("galeria_fotos").delete().eq("id", fotoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useSetGaleriaCapa
// ---------------------------------------------------------------------------

export function useSetGaleriaCapa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventoId, fotoUrl }) => {
      if (!isSupabaseEnabled || !supabase || !eventoId || !fotoUrl) return;
      const { error } = await supabase
        .from("galeria_eventos")
        .update({ capa_url: fotoUrl })
        .eq("id", eventoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}

// ---------------------------------------------------------------------------
// useUploadGaleriaFotos
// ---------------------------------------------------------------------------

export function useUploadGaleriaFotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventoId, files, opts = {}, currentEventoFotosLength = 0 }) => {
      if (!isSupabaseEnabled || !supabase || !eventoId || !Array.isArray(files) || files.length === 0) return;
      const year = String(opts.year || "").replace(/\D/g, "").slice(0, 4);
      const monthNum = Number(opts.month);
      if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
        throw new Error("Ano e mês válidos são obrigatórios para organizar as fotos.");
      }

      const monthFolder = String(monthNum).padStart(2, "0");
      const basePath = `${year}/${monthFolder}/${eventoId}`;
      let ordemBase = currentEventoFotosLength;
      let firstUploadedPublicUrl = null;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!(file instanceof File)) continue;
        const webpBlob = await optimizeImageToWebp(file, 1080, 0.92);
        const filename = `${Date.now()}-${i + 1}.webp`;
        const storagePath = `${basePath}/${filename}`;

        const { error: uploadError } = await supabase.storage.from("galeria").upload(storagePath, webpBlob, {
          contentType: "image/webp",
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);

        const publicUrl = `${GALERIA_PUBLIC_BASE}/${storagePath}`;
        if (!firstUploadedPublicUrl) firstUploadedPublicUrl = publicUrl;

        ordemBase += 1;
        const { error: insertFotoError } = await supabase.from("galeria_fotos").insert({
          evento_id: eventoId,
          foto_url: publicUrl,
          legenda: null,
          ordem: ordemBase,
        });
        if (insertFotoError) throw new Error(insertFotoError.message);
      }

      // Auto-set capa if evento has no capa yet
      if (firstUploadedPublicUrl && opts.setCapaIfEmpty) {
        await supabase.from("galeria_eventos").update({ capa_url: firstUploadedPublicUrl }).eq("id", eventoId);
      }
    },
    onSuccess: () => invalidateGalerias(queryClient),
  });
}
