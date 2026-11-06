-- =====================================================================
-- PASO 9B-3 — escenario_reservas: cerrar la tabla (tiene teléfonos)
-- =====================================================================
-- Correr SOLO cuando:
--   1) migracion_seguridad_paso9b2.sql ya está corrida (crea escenario_ocupacion), y
--   2) el cambio de ReservarEscenarioPage.jsx ya está subido y desplegado
--      (la página pública pide la ocupación a la función, ya no lee la tabla).
-- DESPUÉS:
--   * LEER la tabla: solo encargados del escenario y admin (los teléfonos dejan de ser públicos).
--   * CREAR: encargado/admin cualquier reserva; cualquier visitante SOLO una solicitud
--     "pendiente" sin pago (lo que hace la página pública).
--   * EDITAR / BORRAR: solo encargados del escenario y admin.
-- NO cambia datos.
-- =====================================================================
begin;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'escenario_reservas' loop
    execute format('drop policy %I on public.escenario_reservas', r.policyname);
  end loop;
end $$;

alter table public.escenario_reservas enable row level security;

create policy gm_resv_select on public.escenario_reservas for select to authenticated
  using (coalesce(public.es_encargado_escenario(escenario_id), false) or coalesce(public.es_admin_plataforma(), false));

create policy gm_resv_insert_staff on public.escenario_reservas for insert to authenticated
  with check (coalesce(public.es_encargado_escenario(escenario_id), false) or coalesce(public.es_admin_plataforma(), false));

create policy gm_resv_insert_publico on public.escenario_reservas for insert to anon, authenticated
  with check (
    estado = 'pendiente'
    and pago = 'pendiente'
    and coalesce(monto_pagado, 0) = 0
    and exists (select 1 from public.escenarios e where e.id = escenario_id)
  );

create policy gm_resv_update on public.escenario_reservas for update to authenticated
  using (coalesce(public.es_encargado_escenario(escenario_id), false) or coalesce(public.es_admin_plataforma(), false))
  with check (coalesce(public.es_encargado_escenario(escenario_id), false) or coalesce(public.es_admin_plataforma(), false));

create policy gm_resv_delete on public.escenario_reservas for delete to authenticated
  using (coalesce(public.es_encargado_escenario(escenario_id), false) or coalesce(public.es_admin_plataforma(), false));

commit;

-- PRUEBAS
-- A) Un visitante ya no lee reservas (debe dar count = 0):
--    begin; set local role anon; select count(*) from public.escenario_reservas; rollback;
-- B) En la web, SIN iniciar sesión: abrir /reservar/ID_ESCENARIO, ver la grilla de horarios,
--    elegir uno y enviar la solicitud. Debe quedar "pendiente" y verse al instante como ocupado.
-- C) Como encargado: /escenario reservas -> aceptar, rechazar, cobrar, cancelar, reprogramar, bloquear un horario.
-- ROLLBACK (deja la tabla abierta como estaba)
--    begin;
--    do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='escenario_reservas' loop
--      execute format('drop policy %I on public.escenario_reservas', r.policyname); end loop; end $$;
--    alter table public.escenario_reservas disable row level security;
--    commit;
