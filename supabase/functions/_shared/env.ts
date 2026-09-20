// Resolução da chave de service role usada pelas Edge Functions.
//
// O `SUPABASE_SERVICE_ROLE_KEY` é injetado automaticamente pelo runtime e não
// pode ser editado em Settings > Edge Functions > Secrets. Quando a chave é
// rotacionada manualmente no dashboard, a única saída é gravar o valor novo num
// secret próprio (`PANPASS_SERVICE_ROLE_KEY`). Mantemos o injetado como fallback
// para que uma função continue de pé mesmo se o secret custom ainda não existir
// — foi a divergência entre os dois nomes que derrubou revelar senha, criar
// colaborador e companhia depois da última rotação.

export function getServiceRoleKey(): string | undefined {
  return (
    Deno.env.get("PANPASS_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    undefined
  );
}

export function getSupabaseUrl(): string | undefined {
  return Deno.env.get("SUPABASE_URL") || undefined;
}
