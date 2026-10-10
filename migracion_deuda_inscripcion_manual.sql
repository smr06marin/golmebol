-- ============================================================
-- Cambio pedido: la deuda personal por inscripción sin pagar (la que bloquea
-- a un jugador en próximos torneos del mismo organizador) DEJA de generarse
-- sola al guardar los logros del torneo. Ahora es una acción MANUAL: en
-- Finanzas → Cuentas por equipo aparece un botón "🚫 Bloquear" por cada
-- equipo que quedó debiendo inscripción, y el organizador decide caso por
-- caso, cuando quiera, si lo bloquea o no (el código de esto ya se
-- entregó aparte, en AdminTorneoDetallePage.jsx).
--
-- Esta migración es la parte de datos: como TODAS las deudas personales que
-- existen hoy en la base se generaron con el mecanismo AUTOMÁTICO anterior
-- (nadie las creó a mano todavía, porque el botón no existía), se marcan
-- todas como pagadas — así ningún jugador queda bloqueado por algo que el
-- organizador no eligió bloquear a mano. Esto incluye, por ejemplo, la
-- deuda de $104.000 (x2) que traía bloqueado a Camilo Restrepo en LIGA
-- AUTOPARTES por AUTOPARTES RESTREPO en RELAMPAGO VIVEROS.
--
-- Si de ahora en adelante quieres bloquear a algún equipo puntual, hazlo
-- con el botón "🚫 Bloquear" en la pestaña Finanzas de ese torneo.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN.
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

update torneo_finanzas
set pagado = true
where tipo = 'deuda_personal' and pagado = false;
