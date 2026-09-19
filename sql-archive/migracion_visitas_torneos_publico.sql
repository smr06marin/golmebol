-- ============================================================
-- MIGRACIÓN: Ranking público de torneos más visitados hoy
--
-- La portada nueva (LandingPage) quiere mostrar primero los torneos que
-- más está consultando la gente HOY (se actualiza solo según lo visiten),
-- usando los datos que ya se guardan en site_visitas. Pero esa tabla tiene
-- RLS que solo deja leer a usuarios autenticados (es del panel admin) — un
-- visitante anónimo de la portada no puede leerla directamente.
--
-- Igual que se hizo para el conteo público de ventas de Escenarios
-- (escenario_ventas_conteo_publico), la solución es una vista que corre con
-- los permisos de quien la creó (el dueño, normalmente postgres vía el SQL
-- Editor) y no con los del visitante — así se puede exponer SOLO el conteo
-- agregado por torneo (nada de session_id, dispositivo, ni fila por fila)
-- sin abrir la tabla completa a cualquiera.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- Índice para que el conteo por torneo + fecha sea rápido (antes solo había
-- índice por created_at solo).
create index if not exists site_visitas_torneo_created_idx on site_visitas (torneo_id, created_at);

-- "Hoy" en hora de Colombia (America/Bogota), no en UTC — para que a la
-- medianoche el conteo se reinicie cuando de verdad empieza el día acá.
-- Cuenta visitas tanto a la página pública del torneo (/t/:id, la que se
-- usa ahora desde la portada) como a la tabla dentro de /records (por si
-- alguien todavía llega ahí de otra forma).
create or replace view site_visitas_torneos_hoy as
select torneo_id, count(*) as visitas
from site_visitas
where pagina in ('torneo_publico', 'tabla_torneo')
  and torneo_id is not null
  and created_at >= (date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota')
group by torneo_id;

grant select on site_visitas_torneos_hoy to anon, authenticated;
