-- Reglas de cada llave (eliminatorias) que el organizador elige al crear el partido:
--   criterio: 'goles' (suma de goles, lo de siempre) o 'puntos' (3 por ganar, 1 por empatar)
--   elimina:  false = el empate es válido y no se pregunta por penales (por defecto sí se pregunta)
-- Si la columna está vacía (null) todo funciona como siempre. Correr UNA sola vez en Supabase > SQL Editor.
alter table public.matches add column if not exists config_llave jsonb;
