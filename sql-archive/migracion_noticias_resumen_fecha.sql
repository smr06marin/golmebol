-- ============================================================
-- Habilita el nuevo "Resumen de fecha" en Noticias (IA), que
-- genera una sola noticia narrando TODA una jornada/fecha
-- (varios partidos juntos), en vez de un solo partido.
--
-- Qué hace:
-- 1) Deja la columna noticias.match_id opcional (nullable), porque
--    un resumen de fecha no pertenece a un solo partido.
-- 2) Si existe algún CHECK constraint que limite los valores
--    permitidos de noticias.tipo, lo reemplaza por uno que
--    incluya 'semanal' (el tipo que usa el resumen de fecha),
--    además de los que ya existían: 'pre_partido', 'post_partido'.
--
-- Es seguro ejecutarlo más de una vez.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================

-- Paso 1: match_id opcional
alter table noticias alter column match_id drop not null;

-- Paso 2: encontrar y reemplazar el CHECK constraint de "tipo" (si existe)
do $$
declare
  nombre_constraint text;
begin
  select con.conname into nombre_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'noticias'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tipo%'
  limit 1;

  if nombre_constraint is not null then
    execute format('alter table noticias drop constraint %I', nombre_constraint);
    raise notice 'Se reemplazó el constraint % de noticias.tipo', nombre_constraint;
  end if;

  alter table noticias add constraint noticias_tipo_check
    check (tipo in ('pre_partido', 'post_partido', 'semanal'));
exception when duplicate_object then
  null; -- ya existía con ese nombre, no pasa nada
end $$;
