-- ============================================================
-- MIGRACIÓN: Reservas fijas + cancelar/reprogramar una reserva
--
-- 1) "Reservas fijas": un cliente que juega siempre el mismo día de la
--    semana a la misma hora. Antes solo existía el checkbox "repetir cada
--    semana" de una solicitud pública, que generaba 8 semanas de una sola
--    vez y ya. Ahora el encargado puede registrar un horario fijo desde su
--    panel, y el sistema mantiene siempre las próximas semanas generadas
--    automáticamente (ventana móvil), sin que el encargado tenga que hacer
--    nada.
-- 2) Cancelar una reserva puntual (no llegó / canceló a última hora) sin
--    borrarla, y reprogramarla a otro horario/cancha.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_reservas_fijas (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  cancha        text not null,        -- slug de escenario_canchas
  dia_semana    integer not null check (dia_semana between 0 and 6), -- 0=domingo … 6=sábado
  hora          text not null,        -- 'HH:00'
  duracion      integer not null default 60,
  nombre        text not null,
  telefono      text,
  equipo        text,
  monto         numeric not null default 0,
  activa        boolean not null default true,
  created_at    timestamptz default now()
);
create index if not exists idx_escenario_reservas_fijas_escenario on escenario_reservas_fijas(escenario_id);
alter table escenario_reservas_fijas disable row level security;

-- Cada reserva generada por una regla fija queda enlazada a ella, para no
-- volver a generar la misma fecha dos veces y para poder desactivar la
-- regla sin tocar las reservas ya generadas.
alter table escenario_reservas add column if not exists reserva_fija_id uuid references escenario_reservas_fijas(id) on delete set null;
alter table escenario_reservas add column if not exists motivo_cancelacion text;

-- 'estado' estaba limitado a solo pendiente/aceptada/rechazada/mantenimiento
-- — se agrega 'cancelada' para poder cancelar una reserva puntual (no
-- llegó / canceló a última hora) sin borrar el registro ni el historial.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'escenario_reservas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table escenario_reservas drop constraint %I', r.conname);
  end loop;
end $$;
alter table escenario_reservas add constraint escenario_reservas_estado_check
  check (estado in ('pendiente','aceptada','rechazada','mantenimiento','cancelada'));
