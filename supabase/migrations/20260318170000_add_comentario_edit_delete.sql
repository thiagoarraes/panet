-- Add editado flag and updated_at to comentarios
alter table public.comentarios
  add column if not exists editado boolean not null default false,
  add column if not exists updated_at timestamptz;

-- Allow comment author to update their own comments
create policy "comentarios: dono edita"
  on public.comentarios for update
  using (auth.uid() = colaborador_id)
  with check (auth.uid() = colaborador_id);
