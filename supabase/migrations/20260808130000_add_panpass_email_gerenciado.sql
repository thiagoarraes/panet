-- PanPass: sinaliza quando a caixa do código por e-mail NÃO é gerenciada pela
-- empresa (ex.: Gmail pessoal do fornecedor). Nesses casos a delegação do
-- Google Workspace não alcança a caixa — o PanPass não tenta buscar o código
-- e orienta o colaborador a pedir diretamente ao dono do e-mail.

ALTER TABLE public.panpass_servicos
  ADD COLUMN IF NOT EXISTS mfa_email_gerenciado boolean NOT NULL DEFAULT true;

-- mfa_email e a nova coluna não são segredo — são necessários para o
-- colaborador saber a quem pedir o código quando a busca automática não é
-- possível. Grant cumulativo sobre o já existente na migration anterior.
GRANT SELECT (mfa_email, mfa_email_gerenciado)
  ON public.panpass_servicos TO authenticated;
