-- =====================================================================
-- Link para que el DUEÑO de un equipo mande a sus jugadores el link de registro
-- (cada persona se inscribe sola desde su celular).
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN. Se puede correr más de una vez.
--
-- dueno_link_registro(p_team_id):
--   * Solo funciona si quien la llama es el dueño del equipo (soy_dueno_de_equipo).
--   * Devuelve el token del link de registro (de la tabla privada, o de teams si aún está ahí).
--   * Reinicia el tiempo de validez del link desde ahora (mismas horas que ya tenía, mínimo 24).
-- =====================================================================
create or replace function public.dueno_link_registro(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token text;
  v_horas int;
  v_ahora timestamptz := now();
begin
  if not public.soy_dueno_de_equipo(p_team_id) then
    raise exception 'Solo el dueño del equipo puede enviar el link de registro';
  end if;

  select coalesce(nullif(trim(k.registro_token::text), ''), nullif(trim(t.registro_token::text), ''))
    into v_token
  from public.teams t
  left join public.teams_privado k on k.team_id = t.id
  where t.id = p_team_id;

  if v_token is null then
    raise exception 'Este equipo todavía no tiene link de registro. Pídeselo al organizador del torneo.';
  end if;

  update public.teams
     set registro_token_generado_en = v_ahora,
         registro_token_horas = greatest(coalesce(registro_token_horas, 24), 24)
   where id = p_team_id
  returning registro_token_horas into v_horas;

  return jsonb_build_object('token', v_token, 'horas', v_horas, 'generado_en', v_ahora);
end;
$function$;

revoke all on function public.dueno_link_registro(uuid) from public, anon;
grant execute on function public.dueno_link_registro(uuid) to authenticated;

-- Prueba (opcional), con la sesión de un dueño en la app: debe devolver {token, horas, generado_en}.
-- Con cualquier otra cuenta debe dar el error "Solo el dueño del equipo...".
