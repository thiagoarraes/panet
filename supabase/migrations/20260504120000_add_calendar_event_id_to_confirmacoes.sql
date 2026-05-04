alter table public.presencial_confirmacoes
  add column if not exists google_calendar_event_id text;
