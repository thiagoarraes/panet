-- Adiciona coluna admin_modulos para controle granular de acesso por módulo
-- NULL = super admin (acesso total a todos os módulos)
-- text[] = lista de módulos permitidos (ex: '{postagens,galeria}')
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS admin_modulos text[] DEFAULT NULL;

-- Módulos válidos: colaboradores, postagens, ferias, presencial, galeria, mural
