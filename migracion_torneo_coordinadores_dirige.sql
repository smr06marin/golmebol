-- ============================================================
-- Botones «Yo lo dirijo» / «Ya no lo dirijo» del coordinador de árbitros.
--
-- Agrega a torneo_coordinadores la columna "dirige":
--   true  (por defecto) → el coordinador dirige ese torneo (sale en «Torneos que dirijo»)
--   false               → el coordinador dijo «Ya no lo dirijo»: el torneo pasa a «Torneos que no dirijo»
--                         aunque antes hubiera asignado árbitros ahí.
-- Si después vuelve a asignar árbitros, abrir una planilla o tocar «Yo lo dirijo», vuelve a ser suyo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Es seguro correrlo más de una vez.
-- ============================================================

alter table torneo_coordinadores add column if not exists dirige boolean not null default true;
