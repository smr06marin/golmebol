-- =====================================================================
-- CUADRE DE CANCHA COMPARTIDO ENTRE ÁRBITROS (se turnan las cuentas para planillar)
--
-- Antes, «Mi cuenta del día» del árbitro solo sumaba los partidos que planilló con SU cuenta. Si dos árbitros se
-- turnan (uno planilla unos partidos y el otro los demás), cada uno veía solo su parte y no la plata de toda la cancha.
--
-- Ahora un árbitro que trabajó en una cancha ese día ve la cuenta COMPLETA de esa cancha ese día (todos los partidos,
-- las tarjetas cobradas y las fotos de las transferencias), sin importar con qué cuenta se planilló cada partido.
-- «Trabajó en esa cancha» = tiene un partido asignado ahí ese día (por id o por nombre) o registró un cobro ahí.
--
-- Solo AGREGA permisos de lectura; no cambia nada de lo que ya podían ver los demás.
-- Necesita migracion_cobros_cancha.sql (ya corrida).
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
-- =====================================================================

create or replace function public.trabajo_en_cancha_del_dia(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.matches m
    join public.matches m2
      on trim(coalesce(m2.location, '')) = trim(coalesce(m.location, ''))
     and (m2.played_at at time zone 'America/Bogota')::date = (m.played_at at time zone 'America/Bogota')::date
    join public.players p on p.user_id = auth.uid()
    where m.id = p_match_id
      and trim(coalesce(m.location, '')) <> ''
      and m.played_at is not null
      and (
           p.id in (m2.arbitro1_id, m2.arbitro2_id, m2.arbitro3_id)
        or (nullif(trim(coalesce(p.name, '')), '') is not null and trim(p.name) in (trim(coalesce(m2.arbitro1, '')), trim(coalesce(m2.arbitro2, ''))))
        or exists (select 1 from public.cobros_cancha c where c.match_id = m2.id and c.cobrado_por_user = auth.uid())
      )
  );
$$;
revoke all on function public.trabajo_en_cancha_del_dia(uuid) from public, anon;
grant execute on function public.trabajo_en_cancha_del_dia(uuid) to authenticated;

-- Cobros (tarjetas y transferencias): lo mismo de antes + los de la cancha donde trabajó ese día
drop policy if exists gm_cobros_select on public.cobros_cancha;
create policy gm_cobros_select on public.cobros_cancha for select to authenticated
  using (
       coalesce(public.es_dueno_torneo(tournament_id), false)
    or coalesce(public.es_organizador_plataforma(), false)
    or coalesce(public.es_admin_plataforma(), false)
    or cobrado_por_user = auth.uid()
    or public.puede_cobrar_en_cancha(match_id)
    or public.trabajo_en_cancha_del_dia(match_id)
  );

-- Fotos de los comprobantes: lo mismo de antes + las de la cancha donde trabajó ese día
drop policy if exists gm_comprobantes_select on storage.objects;
create policy gm_comprobantes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
         owner = auth.uid()
      or coalesce(public.es_dueno_torneo(((storage.foldername(name))[1])::uuid), false)
      or coalesce(public.es_organizador_plataforma(), false)
      or coalesce(public.es_admin_plataforma(), false)
      or public.puede_cobrar_en_cancha(((storage.foldername(name))[2])::uuid)
      or public.trabajo_en_cancha_del_dia(((storage.foldername(name))[2])::uuid)
    )
  );

-- ROLLBACK: volver a correr las secciones 1 y 2 de migracion_cobros_cancha.sql (políticas gm_cobros_select y
-- gm_comprobantes_select) y luego: drop function if exists public.trabajo_en_cancha_del_dia(uuid);
