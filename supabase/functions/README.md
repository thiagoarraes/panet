# Supabase Edge Functions (Admin)

## Functions
- `create-collaborator`
- `delete-collaborator`
- `post-og`
- `reset-password`
- `update-profile`

## Required secrets

Em Settings > Edge Functions > Secrets:

| Secret | Obrigatorio | Observacao |
|--------|-------------|------------|
| `PANPASS_SERVICE_ROLE_KEY` | sim | Valor atual da service role. O `SUPABASE_SERVICE_ROLE_KEY` e injetado pelo runtime e **nao pode ser editado** — apos uma rotacao manual da chave, este secret e a unica forma de entregar o valor novo as funcoes. |
| `PANPASS_MASTER_KEY` | sim (PanPass) | Chave de cifra das credenciais. Rotacionar esta chave invalida tudo que ja esta cifrado no banco. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | sim (Calendar) | |
| `ANTHROPIC_API_KEY` | sim (extract-recibo) | |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` vem injetados pelo runtime. Todas as
funcoes resolvem a chave por `_shared/env.ts`, que tenta
`PANPASS_SERVICE_ROLE_KEY` -> `SUPABASE_SECRET_KEY` -> `SUPABASE_SERVICE_ROLE_KEY`.

### Depois de rotacionar a service role

1. Grave o valor novo em `PANPASS_SERVICE_ROLE_KEY`.
2. **Redeploy de todas as funcoes** (o passo mais esquecido — sem ele as funcoes
   antigas continuam rodando com a chave revogada e devolvem 401/500):

```bash
npm run deploy:functions
```

## JWT verification
The project uses Supabase publishable keys in the frontend. Administrative functions therefore keep
gateway JWT verification disabled and validate the caller token inside the function body.
This is configured in `supabase/config.toml`.

## Deploy

Do diretorio raiz, sempre **todas** as funcoes (a CLI respeita o `verify_jwt` de
`supabase/config.toml`):

```bash
npm run deploy:functions
```

Deploy de uma unica funcao, quando so ela mudou:

```bash
supabase functions deploy panpass-reveal
```

## Local serve (optional)
```bash
supabase functions serve
```

## Frontend usage
The admin screen invokes:

- `supabase.functions.invoke("create-collaborator", { body })`
- `supabase.functions.invoke("delete-collaborator", { body: { user_id } })`
- `supabase.functions.invoke("reset-password", { body: { user_id } })`
- `supabase.functions.invoke("update-profile", { body })`

The collaborator-management functions validate that the caller is authenticated, has `perfil = 'admin'`, and has access to the `colaboradores` module in `public.colaboradores.admin_modulos`.
