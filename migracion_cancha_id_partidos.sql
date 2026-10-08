-- Guarda en cada partido la cancha EXACTA (con su escenario), no solo el nombre.
-- Así "Cancha 1" del escenario A y "Cancha 1" del escenario B no se confunden
-- al avisar rotación de canchas en la programación.
-- Ejecutar una vez en Supabase > SQL Editor (se puede re-ejecutar sin problema).
alter table matches add column if not exists cancha_id text;
