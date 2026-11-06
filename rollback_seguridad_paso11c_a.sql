-- ROLLBACK DEL PASO 11C-A — quita la tabla privada, el trigger y las funciones nuevas.
-- (Solo es seguro si la fase B NO se ha corrido: la fase B vacía las columnas de teams y
--  esta tabla sería la única copia de esos datos. Si B ya se corrió, usar primero rollback_seguridad_paso11c_b.sql.)
begin;

drop trigger if exists teams_sync_privado_trg on public.teams;
drop trigger if exists teams_borrar_privado_trg on public.teams;
drop function if exists public.teams_sync_privado();
drop function if exists public.teams_borrar_privado();
drop function if exists public.soy_dueno_de_equipo(uuid);
drop function if exists public.mis_equipos_dueno();
drop function if exists public.registro_tokens_torneo(uuid);
drop function if exists public.equipo_datos_privados(uuid);
drop function if exists public.puede_ver_datos_equipo(uuid);
drop table if exists public.teams_privado;

commit;
