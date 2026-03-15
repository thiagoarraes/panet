# Supabase Edge Functions (Admin)

## Functions
- `create-collaborator`
- `delete-collaborator`
- `reset-password`
- `update-profile`

## Required secrets
These are required in Supabase project secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy
From project root:

```bash
supabase functions deploy create-collaborator
supabase functions deploy delete-collaborator
supabase functions deploy reset-password
supabase functions deploy update-profile
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

Both functions validate that the caller is authenticated and has `perfil = 'admin'` in `public.colaboradores`.
