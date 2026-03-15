-- Allow admin users to update collaborator profiles
DROP POLICY IF EXISTS "colaboradores: admin update" ON public.colaboradores;

CREATE POLICY "colaboradores: admin update"
  ON public.colaboradores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.colaboradores
      WHERE id = auth.uid() AND perfil = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.colaboradores
      WHERE id = auth.uid() AND perfil = 'admin'
    )
  );