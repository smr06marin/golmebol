-- ============================================================
-- MIGRACIÓN: Escuelas deportivas (Fase 1)
--
-- Una escuela de fútbol se maneja como un equipo más (tabla `teams`),
-- solo que marcado con tipo='escuela' y con categoría propia (ej "Sub-10").
-- El profesor coordinador/profesor es un jugador más (tabla `players`)
-- con el mismo patrón que ya existe para árbitros (es_arbitro /
-- es_arbitro_lider), para reutilizar el login por cédula tal cual está.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- ── Escuelas = equipos con tipo y categoría ─────────────────
alter table teams add column if not exists tipo text not null default 'club' check (tipo in ('club','escuela'));
alter table teams add column if not exists categoria text; -- ej. "Sub-8", "Sub-10", solo aplica si tipo='escuela'

create index if not exists idx_teams_tipo on teams(tipo);

-- ── Rol profesor/coordinador (mismo patrón que árbitros) ────
alter table players add column if not exists es_profesor boolean not null default false;
alter table players add column if not exists es_profesor_coordinador boolean not null default false;
alter table players add column if not exists escuela_id uuid references teams(id) on delete set null;

-- ── Contacto del acudiente (los jugadores de escuela son menores) ──
alter table players add column if not exists acudiente_nombre text;
alter table players add column if not exists acudiente_telefono text;

create index if not exists idx_players_escuela on players(escuela_id);
create index if not exists idx_players_es_profesor on players(es_profesor);
