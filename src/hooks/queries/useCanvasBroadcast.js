import { useCallback, useEffect, useRef } from "react";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Canal de broadcast efemero para os tracos do desenho. NUNCA persiste no banco:
// os strokes trafegam so via Realtime (canal `gartic-draw-<salaId>`). O desenhista
// emite segmentos e "clear"; os espectadores recebem via callbacks.
//
// Coordenadas trafegam normalizadas (0..1) para serem independentes do tamanho
// do canvas de cada cliente.
export function useCanvasBroadcast({ salaId, enabled = true, onStroke, onClear }) {
  const channelRef = useRef(null);
  const onStrokeRef = useRef(onStroke);
  const onClearRef = useRef(onClear);

  useEffect(() => {
    onStrokeRef.current = onStroke;
    onClearRef.current = onClear;
  }, [onStroke, onClear]);

  useEffect(() => {
    if (!enabled || !isSupabaseEnabled || !supabase || !salaId) return undefined;
    const channel = supabase.channel(`gartic-draw-${salaId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        onStrokeRef.current?.(payload);
      })
      .on("broadcast", { event: "clear" }, () => {
        onClearRef.current?.();
      })
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

  return { emitStroke, emitClear };
}
