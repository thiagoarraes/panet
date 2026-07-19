-- Controle de corridas por aplicativo (Uber).
-- Colaborador envia recibo (print/PDF) + motivo; campos da corrida são
-- extraídos por IA via edge function (service role faz o UPDATE).

CREATE TABLE IF NOT EXISTS public.corridas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid        NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  motivo          text        NOT NULL,
  recibo_path     text        NOT NULL, -- storage path no bucket recibos (não URL)
  recibo_mime     text        NOT NULL,
  status_extracao text        NOT NULL DEFAULT 'pendente'
    CHECK (status_extracao IN ('pendente','ok','erro')),
  erro_extracao   text,
  -- campos extraídos do recibo (nullable: a IA pode não encontrar)
  origem          text,
  destino         text,
  horario         timestamptz,
  duracao_min     integer,
  km              numeric,
  veiculo         text,
  motorista       text,
  valor_total     numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corridas: colaborador le proprias"
  ON public.corridas FOR SELECT TO authenticated
  USING (colaborador_id = (SELECT auth.uid()));

CREATE POLICY "corridas: colaborador insere proprias"
  ON public.corridas FOR INSERT TO authenticated
  WITH CHECK (colaborador_id = (SELECT auth.uid()));

CREATE POLICY "corridas: admin gerencia"
  ON public.corridas FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = (SELECT auth.uid()) AND perfil = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.colaboradores WHERE id = (SELECT auth.uid()) AND perfil = 'admin'));

CREATE INDEX idx_corridas_colaborador ON public.corridas (colaborador_id, created_at DESC);
CREATE INDEX idx_corridas_horario     ON public.corridas (horario DESC) WHERE horario IS NOT NULL;

-- Bucket privado para recibos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recibos', 'recibos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage recibos: colaborador envia proprios"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recibos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "storage recibos: colaborador le proprios"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recibos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "storage recibos: admin le todos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recibos' AND EXISTS (SELECT 1 FROM public.colaboradores WHERE id = (SELECT auth.uid()) AND perfil = 'admin'));
