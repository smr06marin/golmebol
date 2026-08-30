-- ============================================================
-- FIX: "new row violates row-level security policy for table
-- partido_arqueros" al guardar el resultado en la planilla (sencilla o
-- completa)
--
-- Mismo caso que ya pasó antes con escenario_gastos: en algún momento se
-- activó RLS (seguridad por fila) en partido_arqueros sin ninguna
-- política (a mano, o desde el aviso de seguridad de Supabase), y sin
-- política ninguna, TODO insert queda bloqueado por defecto.
--
-- El control de acceso de la planilla ya se hace en la app (solo el
-- árbitro asignado o el admin pueden entrar a cargarla) — no hace falta
-- RLS a nivel de base de datos también. Esta migración desactiva RLS en
-- partido_arqueros para que vuelva a guardar.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

drop policy if exists "partido_arqueros_select" on partido_arqueros;
drop policy if exists "partido_arqueros_insert" on partido_arqueros;
drop policy if exists "partido_arqueros_update" on partido_arqueros;
drop policy if exists "partido_arqueros_delete" on partido_arqueros;

alter table partido_arqueros disable row level security;
