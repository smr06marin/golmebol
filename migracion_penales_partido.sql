-- Tanda de penales por tiro (desempate en eliminatorias).
-- Ejecutar UNA vez en Supabase > SQL Editor (se puede re-ejecutar sin problema).
--
-- Cada fila es un cobro: quién cobró, qué arquero defendía y qué pasó
-- (gol, fuera o atajado). De aquí salen los "penales atajados" del arquero.
-- Estos goles son solo de la tanda: NO suman como gol del jugador ni como gol
-- recibido del arquero.

create table if not exists public.partido_penales (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null,
  tournament_id   uuid,
  orden           integer not null,          -- orden del cobro en toda la tanda (1, 2, 3...)
  ronda           integer not null default 1, -- ronda del equipo que cobra (muerte súbita > N)
  team_id         uuid not null,             -- equipo que cobra
  player_id       uuid,                      -- quien cobra (null = jugador sin registro)
  player_nombre   text,                      -- nombre escrito a mano si no tiene registro
  numero          text,
  arquero_id      uuid,                      -- arquero rival que defendía
  arquero_nombre  text,
  resultado       text not null check (resultado in ('gol', 'fuera', 'atajado')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_partido_penales_match   on public.partido_penales (match_id);
create index if not exists idx_partido_penales_arquero on public.partido_penales (arquero_id);
create index if not exists idx_partido_penales_torneo  on public.partido_penales (tournament_id);

alter table public.partido_penales enable row level security;

-- Cualquiera puede ver las tandas (son públicas, igual que los resultados).
drop policy if exists "partido_penales lectura publica" on public.partido_penales;
create policy "partido_penales lectura publica" on public.partido_penales
  for select to anon, authenticated using (true);

-- Escribir/corregir: quien está planillando (cuenta o sesión anónima del link de árbitro).
drop policy if exists "partido_penales escritura planilla" on public.partido_penales;
create policy "partido_penales escritura planilla" on public.partido_penales
  for all to authenticated using (true) with check (true);

-- Arreglo de datos viejos: la planilla completa guardaba el ganador de penales como
-- 'local' / 'visitante', pero todo el resto de la plataforma lee 'home' / 'away'.
-- Con 'local' la llave le daba el paso al equipo equivocado.
update public.matches set penales_ganador = 'home' where penales_ganador = 'local';
update public.matches set penales_ganador = 'away' where penales_ganador = 'visitante';
