-- ============================================================
-- FUSIÓN DE ESCENARIOS DUPLICADOS (el mismo complejo deportivo
-- creado dos veces por error, ej: "complejo deportivo EL GOL" y
-- "complejo deportivo el GOL" — mismo lugar, dos filas distintas).
--
-- Por qué pasa esto: si al crear el escenario se hizo doble click,
-- o se volvió a crear pensando que no había guardado la primera vez,
-- quedan dos filas en `escenarios` con IDs distintos. Cuando después
-- asignás un encargado a una de las dos, el encargado entra pero ve
-- "no tenés ningún escenario asignado" si el admin marcó la otra fila
-- por error, o simplemente queda todo repartido/confuso entre las dos.
--
-- Qué hace:
-- 1) Agrupa escenarios por nombre + ciudad (sin importar mayúsculas
--    ni espacios de más).
-- 2) Por cada grupo duplicado, se queda con la fila más antigua
--    (o la que tenga más datos cargados: logo, whatsapp, etc.)
-- 3) Le rellena a la fila que sobrevive los datos que le falten
--    (logo, imagen de fondo, whatsapp, horarios, precios) con los
--    de la duplicada.
-- 4) Traspasa a la fila que sobrevive todo lo que estaba enganchado
--    a la duplicada: encargados asignados, productos, ventas,
--    compras, reservas y pedidos.
-- 5) Borra la fila duplicada ya vacía.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez (si ya no hay duplicados, no
-- hace nada).
-- ============================================================

-- Paso 0 (opcional, solo para mirar): ver qué escenarios están duplicados
-- antes de fusionar.
select lower(trim(name)) as nombre_norm, coalesce(lower(trim(city)),'') as ciudad_norm,
       count(*) as filas, array_agg(id) as ids, array_agg(name) as nombres_reales
from escenarios
group by 1, 2
having count(*) > 1;

do $$
declare
  dup record;
  primary_id uuid;
  secondary_id uuid;
begin
  for dup in
    select lower(trim(name)) as nombre_norm, coalesce(lower(trim(city)),'') as ciudad_norm
    from escenarios
    group by 1, 2
    having count(*) > 1
  loop
    select id into primary_id
    from escenarios
    where lower(trim(name)) = dup.nombre_norm and coalesce(lower(trim(city)),'') = dup.ciudad_norm
    order by
      (
        (case when logo_url is not null then 1 else 0 end) +
        (case when imagen_fondo_url is not null then 1 else 0 end) +
        (case when whatsapp is not null and whatsapp <> '' then 1 else 0 end)
      ) desc,
      created_at asc nulls last,
      id asc
    limit 1;

    for secondary_id in
      select id from escenarios
      where lower(trim(name)) = dup.nombre_norm and coalesce(lower(trim(city)),'') = dup.ciudad_norm
        and id <> primary_id
    loop
      -- Rellenar a la fila que sobrevive los datos que le falten
      update escenarios p set
        logo_url         = coalesce(p.logo_url, s.logo_url),
        imagen_fondo_url = coalesce(p.imagen_fondo_url, s.imagen_fondo_url),
        whatsapp         = coalesce(nullif(p.whatsapp,''), s.whatsapp)
      from escenarios s
      where p.id = primary_id and s.id = secondary_id;

      -- Traspasar todo lo enganchado a la fila duplicada
      begin
        delete from escenario_encargados sec
        using escenario_encargados pri
        where sec.escenario_id = secondary_id
          and pri.escenario_id = primary_id
          and pri.player_id = sec.player_id;
        update escenario_encargados set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update escenario_productos set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update escenario_ventas set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update escenario_compras set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update escenario_reservas set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update escenario_pedidos set escenario_id = primary_id where escenario_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;

      -- Borrar la fila duplicada, ya sin nada enganchado
      delete from escenarios where id = secondary_id;

      raise notice 'Fusionado ✓ escenario "%" — se mantuvo id %, se eliminó %', dup.nombre_norm, primary_id, secondary_id;
    end loop;
  end loop;
end $$;

-- Paso final (opcional, para confirmar): ya no debería haber duplicados.
select lower(trim(name)) as nombre_norm, coalesce(lower(trim(city)),'') as ciudad_norm, count(*) as filas
from escenarios
group by 1, 2
having count(*) > 1;
