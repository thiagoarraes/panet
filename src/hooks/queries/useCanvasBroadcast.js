import { useCallback, useEffect, useRef } from "react";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Canal de broadcast efemero para os tracos do desenho. NUNCA persiste no banco:
// os strokes trafegam so via Realtime (canal `gartic-draw-<salaId>`). O desenhista
// emite segmentos e "clear"; os espectadores recebem via callbacks.
//
// Sincronizacao (quem entra no meio do desenho): o espectador emite `sync-request`;
// o desenhista responde com `sync` (snapshot JPEG do canvas, tambem efemero). Coords
// dos strokes trafegam normalizadas (0..1) para independerem do tamanho do canvas.
export function useCanvasBroadcast({ salaId, enabled = true, onStroke, onClear, onSync, onSyncRequest }) {
  const channelRef = useRef(null);
  const cbRef = useRef({});

  useEffect(() => {
    cbRef.current = { onStroke, onClear, onSync, onSyncRequest };
  }, [onStroke, onClear, onSync, onSyncRequest]);

  useEffect(() => {
    if (!enabled || !isSupabaseEnabled || !supabase || !salaId) return undefined;
    const channel = supabase.channel(`gartic-draw-${salaId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => cbRef.current.onStroke?.(payload))
      .on("broadcast", { event: "clear" }, () => cbRef.current.onClear?.())
      .on("broadcast", { event: "sync" }, ({ payload }) => cbRef.current.onSync?.(payload))
      .on("broadcast", { event: "sync-request" }, () => cbRef.current.onSyncRequest?.())
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      channel.unsubscribe();
    };
  }, [salaId, enabled]);

  const emitStroke = useCallback((payload) => {
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload });
  }, []);

  const emitClear = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "clear" });
  }, []);

  const emitSync = useCallback((payload) => {
    channelRef.current?.send({ type: "broadcast", event: "sync", payload });
  }, []);

  const emitSyncRequest = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "sync-request" });
  }, []);

  return { emitStroke, emitClear, emitSync, emitSyncRequest };
}
