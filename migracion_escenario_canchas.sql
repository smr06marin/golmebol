-- ============================================================
-- MIGRACIÓN: Canchas dinámicas por escenario
--
-- Antes el módulo Escenarios tenía exactamente dos canchas fijas
-- ('futbol5'/'futbol7') hardcodeadas en el código. Ahora cada escenario
-- puede tener las canchas que el encargado quiera crear desde su panel
-- de configuración (nombre y precio propios).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create table if not exists escenario_canchas (
  id            uuid primary key default gen_random_uuid(),
  escenario_id  uuid not null references escenarios(id) on delete cascade,
  slug          text not null,        -- lo que se guarda en escenario_reservas.cancha
  nombre        text not null,
  precio_hora   numeric not null default 0,
  orden         integer not null default 0,
  activa        boolean not null default true,
  created_at    timestamptz default now(),
  unique(escenario_id, slug)
);
create index if not exists idx_escenario_canchas_escenario on escenario_canchas(escenario_id);

-- Semilla: cada escenario ya tenía sus 2 canchas fijas con precio en
-- columnas propias (precio_futbol5 / precio_futbol7) — se migran a filas
-- de escenario_canchas conservando el mismo slug para que las reservas ya
-- guardadas sigan calzando con su cancha.
insert into escenario_canchas (escenario_id, slug, nombre, precio_hora, orden)
select e.id, 'futbol5', 'Cancha 5', coalesce(e.precio_futbol5, 60000), 0
from escenarios e
where not exists (select 1 from escenario_canchas c where c.escenario_id = e.id and c.slug = 'futbol5');

insert into escenario_canchas (escenario_id, slug, nombre, precio_hora, orden)
select e.id, 'futbol7', 'Cancha 7', coalesce(e.precio_futbol7, 90000), 1
from escenarios e
where not exists (select 1 from escenario_canchas c where c.escenario_id = e.id and c.slug = 'futbol7');

-- escenario_reservas.cancha estaba limitado por un check a solo
-- ('futbol5','futbol7'); ahora puede ser el slug de cualquier cancha que
-- se cree, así que se quita esa restricción.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'escenario_reservas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%cancha%'
  loop
    execute format('alter table escenario_reservas drop constraint %I', r.conname);
  end loop;
end $$;
