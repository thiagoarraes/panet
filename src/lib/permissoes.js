/**
 * Espelho em JS de public.current_user_has_admin_module(text) (SQL, ver
 * supabase/migrations/20260427180000_add_ex_panner.sql:32-50). O banco
 * continua sendo a autoridade -- se este helper divergir da funcao SQL, o
 * pior caso e UI errada (secao escondida ou vazia), nunca vazamento: a RLS
 * decide de verdade o que a API devolve.
 *
 * admin_modulos: null = acesso total (super admin); array = lista branca;
 * [] = nenhum modulo. So faz sentido combinado com perfil === "admin" e
 * ativo !== false -- um ex-panner que era admin perde o acesso.
 */
export const temModulo = (profile, moduloId) =>
  profile?.perfil === "admin" &&
  profile?.ativo !== false &&
  (profile.admin_modulos == null || (profile.admin_modulos || []).includes(moduloId));

/**
 * admin_modulos === null tambem e verdade para um colaborador comum (o campo
 * so existe para quem e admin). Por isso NUNCA checar so `admin_modulos ===
 * null` para decidir "super admin" -- e o bug que existia em
 * AdminPage.jsx:39-40 antes desta extracao, mascarado porque o AdminPage so
 * monta atras de um guard de isAdmin. Em qualquer tela sem esse guard (como
 * ColaboradoresPage, que todo mundo acessa) o mesmo padrao liberaria dados
 * restritos para colaboradores comuns.
 */
export const isSuperAdmin = (profile) =>
  profile?.perfil === "admin" && profile?.ativo !== false && profile?.admin_modulos == null;
