-- PanPass: cofre de credenciais dos serviços contratados.
--
-- Segurança: as colunas cifradas (senha_cifrada, totp_secret_cifrado) NUNCA são
-- legíveis pelo client. Isso é garantido por GRANT por coluna — o papel
-- `authenticated` só recebe SELECT nas colunas não-secretas. A policy de RLS
-- pode referenciar `restrito_a`/`ativo` normalmente: cláusulas USING não são
-- limitadas por privilégio de coluna.
--
-- A leitura de segredo acontece só na Edge Function `panpass-reveal` (service
-- role), que decifra, registra em panpass_acessos e devolve o valor.

CREATE TABLE IF NOT EXISTS public.panpass_servicos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text        NOT NULL,
  categoria           text,
  url_login           text,
  logo_url            text,
  usuario             text        NOT NULL,
  senha_cifrada       text        NOT NULL,
  mfa_tipo            text        NOT NULL DEFAULT 'nenhum'
                                  CHECK (mfa_tipo IN ('nenhum', 'totp', 'email')),
  totp_secret_cifrado text,
  mfa_email           text,
  mfa_email_remetente text,
  restrito_a          uuid[],     -- NULL = liberado para todos
  ativo               boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.panpass_acessos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id     uuid        REFERENCES public.panpass_servicos(id) ON DELETE SET NULL,
  colaborador_id uuid        REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  acao           text        NOT NULL CHECK (acao IN ('senha', 'totp', 'codigo_email')),
  sucesso        boolean     NOT NULL DEFAULT true,
  detalhe        text,
  ip             text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panpass_acessos_servico
  ON public.panpass_acessos (servico_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panpass_acessos_colaborador
  ON public.panpass_acessos (colaborador_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.panpass_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panpass_acessos  ENABLE ROW LEVEL SECURITY;

-- Colaborador enxerga apenas serviços ativos aos quais tem direito.
CREATE POLICY "panpass_servicos: leitura permitida"
  ON public.panpass_servicos FOR SELECT TO authenticated
  USING (ativo AND (restrito_a IS NULL OR (SELECT auth.uid()) = ANY (restrito_a)));

-- Admin enxerga tudo (inclusive inativos) para gerenciar na aba do painel.
CREATE POLICY "panpass_servicos: admin le tudo"
  ON public.panpass_servicos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.colaboradores
    WHERE id = (SELECT auth.uid()) AND perfil = 'admin'
  ));

-- Escrita só pela Edge Function `panpass-admin` (service role, ignora RLS).
-- Nenhuma policy de INSERT/UPDATE/DELETE para `authenticated` — de propósito.

-- Log: só admin lê; escrita exclusivamente via service role.
CREATE POLICY "panpass_acessos: admin le"
  ON public.panpass_acessos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.colaboradores
    WHERE id = (SELECT auth.uid()) AND perfil = 'admin'
  ));

-- ─── Privilégio por coluna: a barreira real contra vazamento do segredo ──────
REVOKE ALL ON public.panpass_servicos FROM authenticated, anon;
GRANT SELECT (id, nome, categoria, url_login, logo_url, usuario, mfa_tipo, ativo, created_at)
  ON public.panpass_servicos TO authenticated;

REVOKE ALL ON public.panpass_acessos FROM authenticated, anon;
GRANT SELECT ON public.panpass_acessos TO authenticated;
