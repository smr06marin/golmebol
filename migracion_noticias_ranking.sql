-- ============================================================
-- Habilita el nuevo tipo de noticia "ranking" (goleador del
-- torneo, valla menos vencida, tabla de posiciones, sin depender
-- de un partido puntual).
--
-- Es seguro ejecutarlo más de una vez.
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- ============================================================
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
    check (tipo in ('pre_partido', 'post_partido', 'semanal', 'ranking'));
exception when duplicate_object then
  null;
end $$;
