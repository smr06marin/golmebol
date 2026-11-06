-- ============================================================
-- PASO 8A — Predix: tablas de DINERO y administración (solo admin escribe)
-- ============================================================
-- Hoy estas tablas tienen reglas "using (true)": cualquiera con la llave
-- pública podría crearse una suscripción "paga", cambiar planes/rondas o
-- marcar premios como entregados.
-- AHORA: lectura pública igual que antes (la app la usa para rankings y saldos),
-- pero INSERT/UPDATE/DELETE solo para es_admin_plataforma().
-- Solo escribe AdminPredixPage (planes, suscripciones, rondas); premios
-- mensuales, predix_apuestas y predix_cruces no tienen escritura desde la app.
-- NO se tocan predicciones / duelos / posturas / cruces (jugadores): eso es el 8B.
-- ============================================================

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'predix_planes','predix_suscripciones','predix_rondas',
    'predix_premios_mensuales','predix_apuestas','predix_cruces'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'Tabla % no existe, se omite', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   'gm_' || t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_admin_plataforma())',
                   'gm_' || t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_admin_plataforma()) with check (public.es_admin_plataforma())',
                   'gm_' || t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_admin_plataforma())',
                   'gm_' || t || '_delete', t);
  end loop;
end $$;

-- ============================================================
-- PRUEBAS
-- ============================================================
-- 1) Debe mostrar 4 reglas por tabla (24 filas):
--    select tablename, policyname, cmd from pg_policies
--    where tablename in ('predix_planes','predix_suscripciones','predix_rondas',
--      'predix_premios_mensuales','predix_apuestas','predix_cruces')
--    order by 1, 3;
-- 2) En la web, con tu cuenta admin: /admin/predix -> crear o editar un plan, y
--    activar una suscripción de prueba a un jugador. Debe guardar.
-- 3) En la web, como jugador: /apuestas debe seguir mostrando tabla, planes y rondas.
--
-- ============================================================
-- ROLLBACK (deja las tablas como estaban: abiertas)
-- ============================================================
-- do $$ declare t text; pol record; begin
--   foreach t in array array['predix_planes','predix_suscripciones','predix_rondas','predix_premios_mensuales','predix_apuestas','predix_cruces'] loop
--     for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
--       execute format('drop policy %I on public.%I', pol.policyname, t); end loop;
--     execute format('create policy %I on public.%I for all using (true) with check (true)', 'rollback_abierto_'||t, t);
--   end loop; end $$;
