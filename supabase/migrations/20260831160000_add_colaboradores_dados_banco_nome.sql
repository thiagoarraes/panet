-- Adiciona o nome do banco aos dados de RH.
--
-- Ate aqui a tabela guardava agencia, conta e pix, mas nao QUAL banco -- o que
-- deixava os tres campos ambiguos na hora de emitir pagamento.
--
-- Nao existe tabela `bancos` de apoio de proposito: a lista oferecida no campo
-- do formulario e o `distinct banco_nome` das linhas ja cadastradas. Um banco
-- novo entra na lista pelo simples ato de ser digitado uma vez, sem cadastro
-- previo e sem tela de manutencao. O campo continua texto livre, entao o RH
-- nunca fica bloqueado por um banco que ainda nao esteja na lista.
--
-- A leitura dessa lista passa pela MESMA policy de select da tabela, entao so
-- quem tem o modulo `colaboradores` enxerga os nomes.

alter table public.colaboradores_dados
  add column if not exists banco_nome text;

comment on column public.colaboradores_dados.banco_nome is
  'Nome do banco. Texto livre; o form sugere os valores ja cadastrados.';
