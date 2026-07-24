-- Para que la vista previa en vivo del árbol de eliminatorias se vea IGUAL en
-- el admin y en el jugador (antes cada uno la calculaba por su lado con
-- valores por defecto distintos), guardamos en la base de datos:
--
-- 1) preview_config: cómo armaste la vista previa (cupos, estilo de llaves,
--    qué hacer si el número es impar, y el orden que moviste a mano).
-- 2) preview_calendario: la fecha/hora planeada para cada ronda (octavos,
--    cuartos, semifinal, final), aunque los cruces todavía no sean el árbol
--    oficial — así la gente ya puede ver hasta cuándo sería la final.
--
-- Es seguro correr esto aunque ya existan las columnas (IF NOT EXISTS) y no
-- cambia ni borra ningún dato.

alter table tournaments add column if not exists preview_config jsonb;
alter table tournaments add column if not exists preview_calendario jsonb;
