-- ============================================================
-- ARREGLO PUNTUAL: libera cupos de horarios fijos que quedaron
-- "huérfanos" (la regla se borró o se le cambió cancha/hora, pero
-- la reserva puntual ya generada se quedó viva con los datos viejos).
--
-- Ya se corrigió el código para que esto no vuelva a pasar (se
-- autolimpia solo en cada carga de la página), pero lo que ya quedó
-- mal en la base de datos ANTES de ese cambio no se corrige solo —
-- este script limpia eso, una sola vez.
--
-- Cómo ejecutar: Supabase → SQL Editor → primero corré el SELECT de
-- abajo para VER qué se va a borrar → si se ve bien, corré el DELETE.
-- Es seguro correrlo más de una vez.
-- ============================================================

-- 1) Ver qué quedaría huérfano (reservas futuras "aceptadas" ligadas a
--    un horario fijo que ya no existe, o que existe pero con otra
--    cancha/hora que la que tiene esta reserva puntual).
select r.id, r.fecha, r.hora, r.cancha, r.nombre as nombre_en_la_reserva,
       f.id as regla_id, f.nombre as nombre_en_la_regla, f.cancha as cancha_regla, f.hora as hora_regla
from escenario_reservas r
left join escenario_reservas_fijas f on f.id = r.reserva_fija_id
where r.estado = 'aceptada'
  and r.reserva_fija_id is not null
  and r.fecha >= current_date
  and (f.id is null or f.cancha <> r.cancha or f.hora <> r.hora);

-- 2) Borrar esas filas huérfanas (descomentar y correr después de
--    revisar el SELECT de arriba).
-- delete from escenario_reservas r
-- where r.estado = 'aceptada'
--   and r.reserva_fija_id is not null
--   and r.fecha >= current_date
--   and not exists (
--     select 1 from escenario_reservas_fijas f
--     where f.id = r.reserva_fija_id and f.cancha = r.cancha and f.hora = r.hora
--   );
