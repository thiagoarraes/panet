-- PanPass deixou de oferecer MFA (código por e-mail e TOTP) — agora só mostra
-- login e senha. Migra os serviços que ainda estavam com mfa_tipo='email'
-- (nenhum tinha 'totp' em produção) de volta para 'nenhum' e limpa os campos
-- que ficaram sem uso. As colunas continuam existindo (histórico/auditoria em
-- panpass_acessos ainda referencia 'totp'/'codigo_email'), só não são mais
-- preenchidas por nada novo.

UPDATE public.panpass_servicos
SET mfa_tipo = 'nenhum',
    mfa_email = NULL,
    mfa_email_remetente = NULL,
    mfa_email_gerenciado = true,
    totp_secret_cifrado = NULL,
    updated_at = now()
WHERE mfa_tipo IN ('email', 'totp');
