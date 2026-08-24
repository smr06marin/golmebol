-- ============================================================
-- MIGRACIÓN: El encargado del escenario también puede editar la vitrina
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
--
-- Hasta ahora solo el dueño de la cuenta de organizador (o el admin)
-- podía editar organizador_perfiles. Pero el encargado de un escenario
-- (login por cédula, no por la cuenta de organizador de torneos) también
-- necesita poder llenar el logo/descripción/contacto/redes de la vitrina
-- si ese escenario quedó vinculado a ella (organizador_perfiles.escenario_id).
-- El dominio propio sigue siendo SOLO del admin (el trigger de
-- migracion_organizador_perfil.sql no cambia).
-- ============================================================

drop policy if exists "organizador_perfiles_update" on organizador_perfiles;
create policy "organizador_perfiles_update"
on organizador_perfiles for update
using (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  or exists (
    select 1 from escenario_encargados ee
    join players p on p.id = ee.player_id
    where ee.escenario_id = organizador_perfiles.escenario_id
      and p.user_id = auth.uid()
  )
)
with check (
  organizador_id = auth.uid()
  or exists (
    select 1 from roles_plataforma rp
    where rp.activo is not false and rp.rol = 'admin'
      and (rp.user_id = auth.uid() or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  or exists (
    select 1 from escenario_encargados ee
    join players p on p.id = ee.player_id
    where ee.escenario_id = organizador_perfiles.escenario_id
      and p.user_id = auth.uid()
  )
);
