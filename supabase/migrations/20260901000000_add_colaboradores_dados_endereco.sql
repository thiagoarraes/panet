-- Adiciona endereco aos dados de RH.
--
-- CEP, logradouro, bairro, cidade e UF vem auto-preenchidos pela busca no
-- ViaCEP no formulario; numero e complemento (apartamento/bloco, se predio)
-- ficam a cargo de quem preenche. Colunas separadas em vez de um texto unico
-- porque cada pedaco pode precisar ser lido isoladamente no futuro (ex.: uma
-- exportacao por cidade), e a auto-completude do CEP so faz sentido
-- preenchendo campos distintos.
--
-- Mesma tabela, mesmas 4 policies (current_user_has_admin_module) -- endereco
-- e tao sensivel quanto CPF/conta bancaria e nao ganha regra propria.

alter table public.colaboradores_dados
  add column if not exists endereco_cep text,
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_numero text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_uf text check (endereco_uf is null or endereco_uf ~ '^[A-Z]{2}$');
