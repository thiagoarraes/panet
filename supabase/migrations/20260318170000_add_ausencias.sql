-- Tabela de ausências breves (médico, pessoal, imprevisto)
-- motivo é visível apenas para admins no frontend
CREATE TABLE IF NOT EXISTS public.ausencias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid     NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  motivo      text        NOT NULL,
  inicio      timestamptz NOT NULL,
  fim         timestamptz,           -- NULL quando não há horário de retorno definido
  estimativa  text,                  -- ex: "~2h", "tarde toda" (usado quando fim é NULL)
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ausencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ausencias: leitura autenticados"
  ON public.ausencias FOR SELECT TO authenticated USING (true);

CREATE POLICY "ausencias: admin gerencia"
  ON public.ausencias FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = auth.uid() AND perfil = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = auth.uid() AND perfil = 'admin'));

CREATE INDEX idx_ausencias_colaborador ON public.ausencias (colaborador_id);
CREATE INDEX idx_ausencias_inicio      ON public.ausencias (inicio DESC);
CREATE INDEX idx_ausencias_fim         ON public.ausencias (fim)     WHERE fim IS NOT NULL;
