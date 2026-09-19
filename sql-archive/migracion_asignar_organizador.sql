-- ============================================================
-- MIGRACIÓN: asignar organizador a un torneo ya creado, solo desde
-- el admin principal.
--
-- El selector en el admin (AdminTorneosPage.jsx → "Editar torneo")
-- ya se muestra solo si es admin principal, pero eso es apenas
-- cosmético: cualquier otro admin podría cambiar tournaments.
-- organizador_id igual (por API o por la consola de Supabase),
-- porque la política RLS de "tournaments" permite update a
-- CUALQUIER admin, no solo al principal.
--
-- Este trigger blinda eso a nivel de base de datos: si alguien que
-- no es admin principal intenta cambiar organizador_id, el cambio se
-- revierte en silencio (queda el valor que ya tenía) — mismo patrón
-- que ya se usa para bloquear el dominio propio del organizador
-- (ver organizador_perfiles_bloquear_domain_no_admin en
-- migracion_organizador_perfil.sql).
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

create or replace function public.tournaments_bloquear_organizador_no_principal()
returns trigger as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if tg_op = 'UPDATE' and new.organizador_id is distinct from old.organizador_id then
    -- Misma lista que ADMINS_PRINCIPALES en el frontend (AdminTorneosPage.jsx).
    if v_email not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
      new.organizador_id := old.organizador_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_tournaments_bloquear_organizador on tournaments;
create trigger trg_tournaments_bloquear_organizador
before update on tournaments
for each row execute function public.tournaments_bloquear_organizador_no_principal();
