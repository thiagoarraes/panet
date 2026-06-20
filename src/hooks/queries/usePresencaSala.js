import { useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Presença em tempo real dos jogadores de uma sala via Supabase Presence.
// Retorna um Set com os colaboradorId atualmente conectados. Diferente do campo
// `conectado` no banco (que não reflete quem fecha a aba), a presença sai sozinha
// quando o cliente desconecta.
export function usePresencaSala(salaId, colaboradorId, enabled = true) {
  const [online, setOnline] = useState(() => new Set());

  useEffect(() => {
    if (!enabled || !isSupabaseEnabled || !supabase || !salaId || !colaboradorId) {
      setOnline(new Set());
      return undefined;
    }
    const channel = supabase.channel(`jogo-presence-${salaId}`, {
      config: { presence: { key: colaboradorId } },
    });
    const sync = () => setOnline(new Set(Object.keys(channel.presenceState())));
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ at: Date.now() });
      });
    return () => {
      channel.unsubscribe();
    };
  }, [salaId, colaboradorId, enabled]);

  return online;
}
