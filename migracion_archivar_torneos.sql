-- ============================================================
-- Permite "archivar" un torneo: sacarlo de la lista principal de Torneos
-- (para que no se vaya llenando con cada edición vieja ya cerrada) SIN
-- borrar ni tocar ningún dato — se puede desarchivar en cualquier momento
-- y toda su información sigue exactamente igual.
--
-- Se usa en dos lugares:
--  1) Automático: cuando el organizador le da "Crear siguiente edición" a
--     un torneo ya finalizado, ESE torneo (el viejo) se archiva solo.
--  2) Manual: botón "🗄️ Archivar" / "Desarchivar" en Torneos y en el
--     detalle de cada torneo, para cualquier torneo que ya no se use.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table tournaments add column if not exists archivado boolean not null default false;
