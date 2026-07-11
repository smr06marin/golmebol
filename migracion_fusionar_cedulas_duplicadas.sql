-- ============================================================
-- FUSIÓN DE CÉDULAS DUPLICADAS (una persona con una fila como
-- jugador y otra fila como árbitro, de antes de que existiera el
-- aviso de "ya está registrado").
--
-- Qué hace:
-- 1) Busca cédulas que aparecen más de una vez en `players`.
-- 2) Por cada cédula duplicada, decide cuál fila conservar
--    (la que ya tiene cuenta de acceso creada manda; si ninguna o
--    las dos tienen, gana la que tenga más datos llenos).
-- 3) A la fila que sobrevive le pega los roles de la otra
--    (queda jugador Y árbitro si correspondía), y le rellena los
--    datos que le faltaran (foto, teléfono, ciudad, etc.) con los
--    de la duplicada.
-- 4) Traspasa a la fila que sobrevive todo lo que estaba enganchado
--    a la fila duplicada: equipos, inscripciones a torneos,
--    predicciones, partidos arbitrados, sanciones, finanzas, etc.
-- 5) Borra la fila duplicada ya vacía.
-- 6) Al final dejamos un índice único por cédula para que este tipo
--    de duplicado no se pueda volver a crear en la base de datos,
--    pase lo que pase en el código.
--
-- Caso especial: si las DOS filas duplicadas ya tienen su propia
-- cuenta de acceso (dos logins reales para la misma persona), el
-- script NO decide solo — lo deja sin tocar y avisa en el mensaje
-- para que se revise a mano cuál contraseña es la que usa.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez (si ya no hay duplicados, no
-- hace nada).
-- ============================================================

-- Paso 0 (opcional, solo para mirar): ver qué cédulas están duplicadas
-- antes de fusionar.
select numero_cedula, count(*) as filas, array_agg(id) as ids, array_agg(name) as nombres
from players
where numero_cedula is not null and numero_cedula <> ''
group by numero_cedula
having count(*) > 1;

-- Paso 1: fusionar
do $$
declare
  dup record;
  primary_id uuid;
  secondary_id uuid;
  primary_has_auth boolean;
  secondary_has_auth boolean;
begin
  for dup in
    select numero_cedula
    from players
    where numero_cedula is not null and numero_cedula <> ''
    group by numero_cedula
    having count(*) > 1
  loop
    select id into primary_id
    from players
    where numero_cedula = dup.numero_cedula
    order by
      (user_id is not null) desc,
      (
        (case when name is not null and name <> '' then 1 else 0 end) +
        (case when telefono is not null and telefono <> '' then 1 else 0 end) +
        (case when city is not null and city <> '' then 1 else 0 end) +
        (case when genero is not null and genero <> '' then 1 else 0 end) +
        (case when fecha_nacimiento is not null then 1 else 0 end) +
        (case when photo_url is not null then 1 else 0 end)
      ) desc,
      id asc
    limit 1;

    for secondary_id in
      select id from players where numero_cedula = dup.numero_cedula and id <> primary_id
    loop
      select (user_id is not null) into primary_has_auth   from players where id = primary_id;
      select (user_id is not null) into secondary_has_auth from players where id = secondary_id;

      if primary_has_auth and secondary_has_auth then
        raise notice 'REVISAR A MANO — cédula % tiene DOS cuentas con acceso propio (players.id % y %). No se fusionó automáticamente, hay que decidir a mano cuál contraseña usa la persona.', dup.numero_cedula, primary_id, secondary_id;
        continue;
      end if;

      -- Traspasar la cuenta de acceso a la fila que sobrevive, si ella no tenía
      update players set user_id = (select user_id from players where id = secondary_id)
      where id = primary_id and user_id is null;

      -- Unir roles y rellenar datos que falten
      update players p set
        es_arbitro        = p.es_arbitro or s.es_arbitro or p.rol = 'arbitro' or s.rol = 'arbitro',
        es_arbitro_lider   = p.es_arbitro_lider or s.es_arbitro_lider,
        rol = case
                when p.rol = 'jugador' or s.rol = 'jugador' then 'jugador'
                when p.rol = 'arbitro' or s.rol = 'arbitro' then 'arbitro'
                else coalesce(nullif(p.rol,''), s.rol)
              end,
        activo_membresia   = p.activo_membresia or s.activo_membresia,
        telefono           = coalesce(nullif(p.telefono,''), s.telefono),
        city               = coalesce(nullif(p.city,''), s.city),
        genero             = coalesce(nullif(p.genero,''), s.genero),
        fecha_nacimiento   = coalesce(p.fecha_nacimiento, s.fecha_nacimiento),
        photo_url          = coalesce(p.photo_url, s.photo_url),
        photo_face_url     = coalesce(p.photo_face_url, s.photo_face_url),
        cedula_frontal_url = coalesce(p.cedula_frontal_url, s.cedula_frontal_url),
        cedula_trasera_url = coalesce(p.cedula_trasera_url, s.cedula_trasera_url),
        posicion_futbol5   = coalesce(nullif(p.posicion_futbol5,''), s.posicion_futbol5),
        posicion_futbol7   = coalesce(nullif(p.posicion_futbol7,''), s.posicion_futbol7),
        posicion_futbol11  = coalesce(nullif(p.posicion_futbol11,''), s.posicion_futbol11)
      from players s
      where p.id = primary_id and s.id = secondary_id;

      -- Traspasar todo lo que estaba enganchado a la fila duplicada.
      -- Cada UPDATE va envuelto por si esa tabla/columna no existe en
      -- este proyecto (no debería fallar el resto del script).
      begin
        update team_players set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update tournament_player_registrations set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update predicciones set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update tournament_logros set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update sanciones set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update torneo_finanzas set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update player_match_stats set player_id = primary_id where player_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update match_edit_log set editor_user_id = (select user_id from players where id = primary_id) where editor_user_id = (select user_id from players where id = secondary_id) and (select user_id from players where id = secondary_id) is not null;
      exception when undefined_table or undefined_column then null;
      end;
      begin
        update matches set arbitro1_id = primary_id where arbitro1_id = secondary_id;
        update matches set arbitro2_id = primary_id where arbitro2_id = secondary_id;
        update matches set arbitro3_id = primary_id where arbitro3_id = secondary_id;
      exception when undefined_table or undefined_column then null;
      end;

      -- Borrar la fila duplicada, ya sin nada enganchado
      delete from players where id = secondary_id;

      raise notice 'Fusionado ✓ cédula % — se mantuvo players.id %, se eliminó %', dup.numero_cedula, primary_id, secondary_id;
    end loop;
  end loop;
end $$;

-- Paso 2 (opcional, para confirmar): ya no debería haber duplicados,
-- salvo los que salieron en el aviso "REVISAR A MANO" arriba.
select numero_cedula, count(*) as filas
from players
where numero_cedula is not null and numero_cedula <> ''
group by numero_cedula
having count(*) > 1;

-- Paso 3: candado a futuro — evita que se pueda volver a crear un
-- duplicado por cédula, sin importar desde dónde se intente.
create unique index if not exists idx_players_numero_cedula_unico
  on players (numero_cedula)
  where numero_cedula is not null and numero_cedula <> '';
