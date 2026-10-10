-- ============================================================
-- Qué coordinador de árbitros dirige qué torneo.
--
-- La pantalla del coordinador ahora muestra solo: los torneos que ya manejó y los
-- torneos nuevos que aún no inician. Los torneos ya iniciados que dirige otro
-- coordinador (y los finalizados o archivados) dejan de aparecerle.
--
-- La app anota sola la relación cuando el coordinador asigna árbitros, marca
-- "sin planillador", abre una planilla o registra un reclamo en un partido de un torneo.
-- Esta migración crea la tabla y rellena lo que ya existe, para que cada coordinador
-- no pierda los torneos que viene dirigiendo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
-- ============================================================

create table if not exists torneo_coordinadores (
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  coordinador_id uuid not null references players(id)     on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (tournament_id, coordinador_id)
);
create index if not exists idx_torneo_coordinadores_coord on torneo_coordinadores (coordinador_id);

alter table torneo_coordinadores enable row level security;
drop policy if exists "torneo_coordinadores lectura" on torneo_coordinadores;
create policy "torneo_coordinadores lectura" on torneo_coordinadores for select to authenticated using (true);
drop policy if exists "torneo_coordinadores escritura" on torneo_coordinadores;
create policy "torneo_coordinadores escritura" on torneo_coordinadores for all to authenticated using (true) with check (true);

-- ── Relleno con lo que ya existe ────────────────────────────────────────────
-- 1) Coordinadores que son árbitros de algún partido del torneo.
insert into torneo_coordinadores (tournament_id, coordinador_id)
select distinct m.tournament_id, p.id
from matches m
join players p on p.es_arbitro_lider = true
             and p.id in (m.arbitro1_id, m.arbitro2_id, m.arbitro3_id)
where m.tournament_id is not null
on conflict do nothing;

-- 2) Coordinadores que registraron un reclamo en un partido del torneo.
insert into torneo_coordinadores (tournament_id, coordinador_id)
select distinct m.tournament_id, r.registrado_por
from arbitro_reclamos r
join matches m on m.id = r.match_id
join players p on p.id = r.registrado_por and p.es_arbitro_lider = true
where m.tournament_id is not null
on conflict do nothing;

-- 3) Si hay UN solo coordinador, es quien dirige todos los torneos que no están finalizados.
insert into torneo_coordinadores (tournament_id, coordinador_id)
select t.id, c.id
from tournaments t
cross join (select id from players where es_arbitro_lider = true) c
where (select count(*) from players where es_arbitro_lider = true) = 1
  and coalesce(t.status, 'active') <> 'finished'
on conflict do nothing;

-- Revisar el resultado (opcional):
-- select p.name as coordinador, t.name as torneo
-- from torneo_coordinadores tc
-- join players p on p.id = tc.coordinador_id
-- join tournaments t on t.id = tc.tournament_id
-- order by p.name, t.name;
