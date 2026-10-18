-- ══════════════════════════════════════════════════════════════════
-- W CONFIGURABLE POR TORNEO + DESCUENTO DE PUNTOS EN LA TABLA
-- ══════════════════════════════════════════════════════════════════
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez (no duplica ni borra nada).
--
-- 1) Partido por W: cada torneo define con qué marcador gana el equipo que
--    SÍ se presentó (por defecto 3-0) y cuántos puntos recibe (por defecto
--    los mismos de una victoria normal).
-- 2) Descuentos de puntos: el organizador puede quitarle (o devolverle)
--    puntos a un equipo en la tabla de posiciones, con su motivo. La tabla
--    pública muestra la marca y el motivo.
-- Los torneos que ya existen siguen igual: W = 3-0 y los puntos de victoria.

-- ── 1) Configuración del W ──────────────────────────────────────
alter table public.tournaments
  add column if not exists w_goles_ganador integer not null default 3;

alter table public.tournaments
  add column if not exists w_puntos_ganador integer;   -- vacío = igual que pts_victoria

comment on column public.tournaments.w_goles_ganador  is 'Goles con los que gana el equipo que se presentó en un partido por W (el otro queda en 0).';
comment on column public.tournaments.w_puntos_ganador is 'Puntos que recibe el ganador de un partido por W. Vacío = los mismos de pts_victoria.';

-- ── 2) Descuentos de puntos ─────────────────────────────────────
create table if not exists public.descuentos_puntos (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  puntos        integer not null check (puntos <> 0),  -- negativo = se quitan puntos, positivo = se devuelven
  motivo        text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists descuentos_puntos_torneo_idx on public.descuentos_puntos (tournament_id);
create index if not exists descuentos_puntos_equipo_idx on public.descuentos_puntos (tournament_id, team_id);

comment on table public.descuentos_puntos is 'Ajustes manuales de puntos por equipo en la tabla de posiciones de un torneo (sanciones). puntos < 0 resta, > 0 suma.';

alter table public.descuentos_puntos enable row level security;

-- Todo el mundo puede VER los descuentos (la tabla pública los muestra con su motivo).
drop policy if exists "descuentos_puntos lectura publica" on public.descuentos_puntos;
create policy "descuentos_puntos lectura publica" on public.descuentos_puntos
  for select to anon, authenticated using (true);

-- Solo el dueño del torneo (o un organizador/admin de la plataforma) los crea, cambia o borra.
drop policy if exists "descuentos_puntos escritura dueno" on public.descuentos_puntos;
create policy "descuentos_puntos escritura dueno" on public.descuentos_puntos
  for all to authenticated
  using (coalesce(public.es_dueno_torneo(tournament_id), false) or coalesce(public.es_organizador_plataforma(), false))
  with check (coalesce(public.es_dueno_torneo(tournament_id), false) or coalesce(public.es_organizador_plataforma(), false));

grant select on public.descuentos_puntos to anon, authenticated;
grant insert, update, delete on public.descuentos_puntos to authenticated;

-- Comprobación (opcional): debe devolver 0 filas y no dar error
-- select * from public.descuentos_puntos limit 5;
-- select id, w_goles_ganador, w_puntos_ganador from public.tournaments limit 3;
