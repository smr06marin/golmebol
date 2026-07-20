-- ============================================================
-- MIGRACIÓN: Predix fase 2 — modo demo/pago en duelos y posturas,
-- limpieza de la mesa de apuestas vieja (predix_apuestas/predix_cruces)
--
-- Contexto: PlayerApuestasPage.jsx (/jugador/apuestas) ya tiene su
-- propia mesa de apuestas abiertas ("posturas", tablas
-- predix_posturas/predix_posturas_cruces) con mejores resguardos
-- (tope del 25% del saldo, no se puede apostar en tu propio
-- partido, etc). La página vieja PredixApuestasPage.jsx (ruta
-- /predix) hacía lo mismo pero con las tablas predix_apuestas/
-- predix_cruces, sin ningún resguardo y sin filtro de suscripción
-- — quedó duplicada y se está retirando del código. Como los datos
-- de Predix hasta ahora son de prueba, se eliminan esas tablas.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- Separar puntos "demo" (gratis) de puntos "pago" también en duelos
-- directos y en la mesa de apuestas abiertas (posturas).
alter table predix_duelos    add column if not exists modo text not null default 'demo' check (modo in ('demo','pago'));
alter table predix_posturas  add column if not exists modo text not null default 'demo' check (modo in ('demo','pago'));

create index if not exists idx_predix_duelos_modo   on predix_duelos(modo);
create index if not exists idx_predix_posturas_modo on predix_posturas(modo);

-- Retiro de la mesa de apuestas vieja (duplicada, sin resguardos,
-- reemplazada por predix_posturas). Datos de prueba, se puede borrar.
drop table if exists predix_cruces cascade;
drop table if exists predix_apuestas cascade;
