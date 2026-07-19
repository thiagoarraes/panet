-- Vínculo destino -> cliente para corridas Uber.
-- Admin cadastra uma vez; corridas futuras com o mesmo destino (normalizado)
-- exibem automaticamente o nome do cliente.
CREATE TABLE IF NOT EXISTS public.corridas_clientes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endereco   text        NOT NULL,
  nome       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_corridas_clientes_endereco
  ON public.corridas_clientes (lower(btrim(endereco)));

ALTER TABLE public.corridas_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corridas_clientes: leitura autenticados"
  ON public.corridas_clientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "corridas_clientes: admin gerencia"
  ON public.corridas_clientes FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = (SELECT auth.uid()) AND perfil = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = (SELECT auth.uid()) AND perfil = 'admin'));
