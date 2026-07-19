import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

export const normalizeEndereco = (value) => String(value || "").trim().toLowerCase();

// Mapa destino normalizado -> nome do cliente (cadastro feito pelo admin).
export function useCorridasClientes() {
  return useQuery({
    queryKey: ["admin", "corridas-clientes"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return new Map();
      const { data, error } = await supabase.from("corridas_clientes").select("endereco,nome").limit(1000);
      if (error) throw new Error(error.message);
      const map = new Map();
      (data || []).forEach((row) => map.set(normalizeEndereco(row.endereco), row.nome));
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isSupabaseEnabled,
  });
}
