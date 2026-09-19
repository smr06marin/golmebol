-- ============================================================
-- MIGRACIÓN: RPC de registro público (equipo + escuela)
-- Cómo ejecutar: Supabase → SQL Editor → pegar → RUN
-- Es idempotente (create or replace / drop policy if exists).
--
-- NO incluye la tanda 1 de RLS. Estos RPC existen para que, cuando
-- se endurezca RLS, el registro público siga funcionando vía
-- security definer (sin abrir players / torneo_finanzas al anon).
--
-- Hallazgo vs. el pedido original:
--   El chequeo de deuda en RegistroEquipoPage filtra por player_id
--   (deuda_personal impaga en CUALQUIER torneo), no por tournament_id.
--   Por eso la función se llama jugador_tiene_deuda(player_id), no
--   torneo_tiene_deuda.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. buscar_jugador_por_cedula
--    Columnas que muestra el UI de registro de equipo:
--      name, numero_cedula, city, photo_url, telefono/whatsapp
--      (para WhatsApp), es_arbitro/rol, flags de cédula subida.
--    Opcional: p_tournament_id → avisa si ya está en ese torneo.
-- ────────────────────────────────────────────────────────────

create or replace function public.buscar_jugador_por_cedula(
  p_cedula text,
  p_tournament_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cedula text := trim(p_cedula);
  v_p      players%rowtype;
  v_ya     record;
begin
  if v_cedula is null or v_cedula = '' then
    raise exception 'Cédula vacía';
  end if;

  select * into v_p from players where numero_cedula = v_cedula limit 1;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;

  -- ¿Ya inscrito en este torneo?
  if p_tournament_id is not null then
    select r.id, t.name as equipo_nombre
      into v_ya
    from tournament_player_registrations r
    left join teams t on t.id = r.team_id
    where r.tournament_id = p_tournament_id
      and r.player_id = v_p.id
      and r.activo = true
    limit 1;
  end if;

  return jsonb_build_object(
    'encontrado', true,
    'id', v_p.id,
    'name', v_p.name,
    'numero_cedula', v_p.numero_cedula,
    'city', v_p.city,
    'photo_url', v_p.photo_url,
    'telefono', v_p.telefono,
    'whatsapp', v_p.whatsapp,
    'es_arbitro', coalesce(v_p.es_arbitro, false) or v_p.rol = 'arbitro',
    'rol', v_p.rol,
    -- No devolvemos las URLs de cédula (PII). Solo si faltan, para el UI.
    'tiene_cedula_frontal', v_p.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_p.cedula_trasera_url is not null,
    'ya_en_torneo', v_ya.id is not null,
    'equipo_en_torneo', v_ya.equipo_nombre
  );
end;
$$;

revoke all on function public.buscar_jugador_por_cedula(text, uuid) from public;
grant execute on function public.buscar_jugador_por_cedula(text, uuid) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. jugador_tiene_deuda(player_id)
--    Reemplaza el select abierto a torneo_finanzas del registro.
-- ────────────────────────────────────────────────────────────

create or replace function public.jugador_tiene_deuda(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_concepto text;
begin
  if p_player_id is null then
    return jsonb_build_object('tiene_deuda', false, 'total', 0);
  end if;

  select coalesce(sum(monto), 0),
         (array_agg(concepto) filter (where concepto is not null))[1]
    into v_total, v_concepto
  from torneo_finanzas
  where player_id = p_player_id
    and tipo = 'deuda_personal'
    and pagado = false;

  if coalesce(v_total, 0) > 0 then
    return jsonb_build_object(
      'tiene_deuda', true,
      'total', v_total,
      'concepto', coalesce(v_concepto, 'tarjetas de torneos anteriores')
    );
  end if;

  return jsonb_build_object('tiene_deuda', false, 'total', 0);
end;
$$;

revoke all on function public.jugador_tiene_deuda(uuid) from public;
grant execute on function public.jugador_tiene_deuda(uuid) to anon, authenticated;


-- Sanción activa (también se consulta en el registro de equipo)
create or replace function public.jugador_sancion_activa(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s record;
begin
  select motivo, fecha_fin into v_s
  from sanciones
  where player_id = p_player_id
    and activa = true
    and (fecha_fin is null or fecha_fin > now())
  order by created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('sancionado', false);
  end if;

  return jsonb_build_object(
    'sancionado', true,
    'motivo', v_s.motivo,
    'fecha_fin', v_s.fecha_fin
  );
end;
$$;

revoke all on function public.jugador_sancion_activa(uuid) from public;
grant execute on function public.jugador_sancion_activa(uuid) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. registrar_equipo — crea (si hace falta) + inscribe en torneo
-- ────────────────────────────────────────────────────────────

create or replace function public.registrar_equipo(
  p_token text,
  p_tournament_id uuid,
  p_cedula text,
  p_name text default null,
  p_telefono text default null,
  p_city text default null,
  p_genero text default null,
  p_fecha_nacimiento date default null,
  p_posicion_futbol5 text default null,
  p_posicion_futbol7 text default null,
  p_posicion_futbol11 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text := trim(p_token);
  v_cedula  text := trim(p_cedula);
  v_equipo  teams%rowtype;
  v_torneo  tournaments%rowtype;
  v_player  players%rowtype;
  v_creado  boolean := false;
  v_digitos text;
  v_choque  record;
  v_deuda   jsonb;
  v_sanc    jsonb;
begin
  if v_token is null or v_token = '' then raise exception 'Token inválido'; end if;
  if v_cedula is null or v_cedula = '' then raise exception 'Cédula obligatoria'; end if;
  if p_tournament_id is null then raise exception 'Torneo obligatorio'; end if;

  -- Equipo del link
  select * into v_equipo from teams where registro_token = v_token limit 1;
  if not found then raise exception 'Link de registro inválido (equipo)'; end if;

  -- Torneo abierto / existente
  select * into v_torneo from tournaments where id = p_tournament_id limit 1;
  if not found then raise exception 'Torneo no encontrado'; end if;

  -- Equipo debe estar inscrito en ese torneo
  if not exists (
    select 1 from tournament_teams
    where tournament_id = p_tournament_id and team_id = v_equipo.id
  ) then
    raise exception 'El equipo no pertenece a este torneo';
  end if;

  -- Link vencido (24h desde registro_token_generado_en)
  if v_equipo.registro_token_generado_en is not null
     and v_equipo.registro_token_generado_en < now() - interval '24 hours' then
    raise exception 'Link de registro vencido';
  end if;

  -- Buscar o crear jugador
  select * into v_player from players where numero_cedula = v_cedula limit 1;

  if not found then
    -- Alta nueva: campos obligatorios
    if nullif(trim(p_name), '') is null then raise exception 'El nombre es obligatorio'; end if;
    if nullif(trim(p_telefono), '') is null then raise exception 'El teléfono es obligatorio'; end if;
    if nullif(trim(p_city), '') is null then raise exception 'La ciudad es obligatoria'; end if;
    if nullif(trim(p_genero), '') is null then raise exception 'El género es obligatorio'; end if;
    if p_fecha_nacimiento is null then raise exception 'La fecha de nacimiento es obligatoria'; end if;
    if coalesce(p_posicion_futbol5, '') = ''
       and coalesce(p_posicion_futbol7, '') = ''
       and coalesce(p_posicion_futbol11, '') = '' then
      raise exception 'Selecciona al menos una posición';
    end if;

    -- WhatsApp único (últimos 10 dígitos)
    v_digitos := right(regexp_replace(p_telefono, '\D', '', 'g'), 10);
    if length(v_digitos) = 10 then
      select id, name into v_choque
      from players
      where right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 10) = v_digitos
         or right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 10) = v_digitos
      limit 1;
      if found then
        raise exception 'Ese número de WhatsApp ya está registrado con otro jugador (%).', v_choque.name;
      end if;
    end if;

    insert into players (
      name, telefono, city, genero, fecha_nacimiento,
      posicion_futbol5, posicion_futbol7, posicion_futbol11,
      numero_cedula, activo_membresia, fecha_registro
    ) values (
      trim(p_name), trim(p_telefono), trim(p_city), trim(p_genero), p_fecha_nacimiento,
      nullif(p_posicion_futbol5, ''), nullif(p_posicion_futbol7, ''), nullif(p_posicion_futbol11, ''),
      v_cedula, true, now()
    )
    returning * into v_player;

    v_creado := true;
  end if;

  -- Ya en este torneo
  if exists (
    select 1 from tournament_player_registrations
    where tournament_id = p_tournament_id
      and player_id = v_player.id
      and activo = true
  ) then
    raise exception 'Ya estás registrado en este torneo';
  end if;

  -- Sanción / deuda bloquean inscripción
  v_sanc := public.jugador_sancion_activa(v_player.id);
  if (v_sanc->>'sancionado')::boolean then
    raise exception 'Jugador sancionado: no puede inscribirse';
  end if;

  v_deuda := public.jugador_tiene_deuda(v_player.id);
  if (v_deuda->>'tiene_deuda')::boolean then
    raise exception 'Jugador con deuda de tarjetas: no puede inscribirse';
  end if;

  -- Inscripción al torneo
  insert into tournament_player_registrations (tournament_id, team_id, player_id, activo)
  values (p_tournament_id, v_equipo.id, v_player.id, true);

  -- Relación base equipo ↔ jugador
  if not exists (
    select 1 from team_players
    where team_id = v_equipo.id and player_id = v_player.id
  ) then
    insert into team_players (team_id, player_id, activo)
    values (v_equipo.id, v_player.id, true);
  end if;

  return jsonb_build_object(
    'player_id', v_player.id,
    'creado', v_creado,
    'name', v_player.name,
    'requiere_cedula', coalesce(v_torneo.requiere_cedula, true),
    'tiene_cedula_frontal', v_player.cedula_frontal_url is not null,
    'tiene_cedula_trasera', v_player.cedula_trasera_url is not null
  );
end;
$$;

revoke all on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text) from public;
grant execute on function public.registrar_equipo(text, uuid, text, text, text, text, text, date, text, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. registrar_escuela — acudiente + jugador + vínculos
--    Auth (signUp) queda en el cliente; después llamar
--    vincular_auth_player(player_id) con la sesión creada.
-- ────────────────────────────────────────────────────────────

create or replace function public.registrar_escuela(
  p_escuela_id uuid,
  p_acudiente_nombre text,
  p_acudiente_cedula text,
  p_acudiente_telefono text,
  p_jugador_name text,
  p_jugador_fecha_nacimiento date,
  p_jugador_cedula text,
  p_tipo_sangre text default null,
  p_genero text default null,
  p_telefono text default null,
  p_posicion text default null,
  p_pie_dominante text default null,
  p_anios_jugando numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escuela   teams%rowtype;
  v_acud      players%rowtype;
  v_acud_id   uuid;
  v_acud_new  boolean := false;
  v_jug       players%rowtype;
  v_ti        text := trim(p_jugador_cedula);
  v_ac_ced    text := trim(p_acudiente_cedula);
begin
  if p_escuela_id is null then raise exception 'Escuela obligatoria'; end if;
  if nullif(trim(p_acudiente_nombre), '') is null then raise exception 'Falta el nombre del acudiente'; end if;
  if v_ac_ced is null or v_ac_ced = '' then raise exception 'Falta la cédula del acudiente'; end if;
  if nullif(trim(p_acudiente_telefono), '') is null then raise exception 'Falta el teléfono del acudiente'; end if;
  if nullif(trim(p_jugador_name), '') is null then raise exception 'Falta el nombre del jugador'; end if;
  if p_jugador_fecha_nacimiento is null then raise exception 'Falta la fecha de nacimiento'; end if;
  if v_ti is null or v_ti = '' then raise exception 'Falta el documento del jugador'; end if;

  select * into v_escuela
  from teams
  where id = p_escuela_id and tipo = 'escuela'
  limit 1;
  if not found then raise exception 'Escuela no encontrada o link inválido'; end if;

  -- Acudiente: reutilizar o crear
  select * into v_acud from players where numero_cedula = v_ac_ced limit 1;
  if found then
    v_acud_id := v_acud.id;
    if not coalesce(v_acud.es_acudiente, false) then
      update players set es_acudiente = true where id = v_acud_id;
    end if;
  else
    insert into players (
      name, numero_cedula, telefono, rol, es_acudiente,
      activo_membresia, fecha_vencimiento, primer_ingreso, fecha_registro
    ) values (
      trim(p_acudiente_nombre), v_ac_ced, trim(p_acudiente_telefono),
      'acudiente', true, true, null, false, now()
    )
    returning id into v_acud_id;
    v_acud_new := true;
  end if;

  -- Jugador no debe existir
  if exists (select 1 from players where numero_cedula = v_ti) then
    raise exception 'Ya hay una persona registrada con ese número de documento';
  end if;

  insert into players (
    name, fecha_nacimiento, numero_cedula, tipo_sangre, genero, telefono,
    posicion, pie_dominante, anios_jugando,
    acudiente_nombre, acudiente_telefono,
    es_jugador_escuela, escuela_id,
    activo_membresia, fecha_vencimiento, primer_ingreso, fecha_registro
  ) values (
    trim(p_jugador_name), p_jugador_fecha_nacimiento, v_ti,
    nullif(p_tipo_sangre, ''), nullif(p_genero, ''), nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(p_posicion, ''), nullif(p_pie_dominante, ''), p_anios_jugando,
    trim(p_acudiente_nombre), trim(p_acudiente_telefono),
    true, p_escuela_id,
    true, null, false, now()
  )
  returning * into v_jug;

  insert into team_players (team_id, player_id, activo)
  values (p_escuela_id, v_jug.id, true);

  insert into escuela_acudientes (acudiente_id, jugador_id)
  values (v_acud_id, v_jug.id)
  on conflict (acudiente_id, jugador_id) do nothing;

  return jsonb_build_object(
    'acudiente_id', v_acud_id,
    'acudiente_creado', v_acud_new,
    'jugador_id', v_jug.id,
    'escuela_nombre', v_escuela.name
  );
end;
$$;

revoke all on function public.registrar_escuela(uuid, text, text, text, text, date, text, text, text, text, text, text, numeric) from public;
grant execute on function public.registrar_escuela(uuid, text, text, text, text, date, text, text, text, text, text, text, numeric) to anon, authenticated;


-- Vincula auth.uid() al player tras signUp (email debe ser {cedula}@golmebol.com)
create or replace function public.vincular_auth_player(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p players%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_esperado text;
begin
  if auth.uid() is null then
    raise exception 'Debes estar autenticado';
  end if;

  select * into v_p from players where id = p_player_id;
  if not found then raise exception 'Jugador no encontrado'; end if;

  v_esperado := lower(v_p.numero_cedula || '@golmebol.com');
  if v_email is distinct from v_esperado then
    raise exception 'El email de la sesión no corresponde a este documento';
  end if;

  update players
  set user_id = auth.uid()
  where id = p_player_id
    and (user_id is null or user_id = auth.uid());

  return jsonb_build_object('ok', true, 'player_id', p_player_id);
end;
$$;

revoke all on function public.vincular_auth_player(uuid) from public;
grant execute on function public.vincular_auth_player(uuid) to authenticated;


-- Tras subir al bucket, graba las URLs solo si el archivo EXISTE en
-- storage.objects (no se confía en URLs inventadas por el cliente).
-- p_frontal_ext / p_trasera_ext: extensión sin punto (ej. 'jpg'). Null = no confirmar esa cara.
drop function if exists public.confirmar_cedula_urls(uuid, text, text);

create or replace function public.confirmar_cedula_urls(
  p_player_id uuid,
  p_frontal_ext text default null,
  p_trasera_ext text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p            players%rowtype;
  v_ext_f        text;
  v_ext_t        text;
  v_nombre_f     text;
  v_nombre_t     text;
  v_url_f        text;
  v_url_t        text;
  v_origin       text;
  v_base         text;
begin
  if p_player_id is null then
    raise exception 'player_id obligatorio';
  end if;

  select * into v_p from players where id = p_player_id;
  if not found then raise exception 'Jugador no encontrado'; end if;

  -- Origen para armar la URL (mismo formato que getPublicUrl). No viene del cliente.
  select (regexp_match(u, '^(https?://[^/]+)'))[1]
    into v_origin
  from (
    (select cedula_frontal_url as u from players where cedula_frontal_url ~ '^https?://' limit 1)
    union all
    (select cedula_trasera_url as u from players where cedula_trasera_url ~ '^https?://' limit 1)
  ) s
  limit 1;

  v_base := coalesce(v_origin, '') || '/storage/v1/object/public/cedulas/';

  -- Frontal
  if nullif(trim(coalesce(p_frontal_ext, '')), '') is not null then
    v_ext_f := lower(regexp_replace(trim(p_frontal_ext), '[^a-z0-9]', '', 'g'));
    if v_ext_f = '' or v_ext_f !~ '^(jpe?g|png|webp|gif|heic)$' then
      raise exception 'Extensión de cédula frontal inválida';
    end if;
    v_nombre_f := p_player_id::text || '_frontal.' || v_ext_f;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'cedulas' and name = v_nombre_f
    ) then
      raise exception 'Archivo no encontrado, subilo primero (frontal)';
    end if;
    v_url_f := v_base || v_nombre_f;
  end if;

  -- Trasera
  if nullif(trim(coalesce(p_trasera_ext, '')), '') is not null then
    v_ext_t := lower(regexp_replace(trim(p_trasera_ext), '[^a-z0-9]', '', 'g'));
    if v_ext_t = '' or v_ext_t !~ '^(jpe?g|png|webp|gif|heic)$' then
      raise exception 'Extensión de cédula trasera inválida';
    end if;
    v_nombre_t := p_player_id::text || '_trasera.' || v_ext_t;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'cedulas' and name = v_nombre_t
    ) then
      raise exception 'Archivo no encontrado, subilo primero (trasera)';
    end if;
    v_url_t := v_base || v_nombre_t;
  end if;

  if v_url_f is null and v_url_t is null then
    raise exception 'Nada que confirmar: pasá p_frontal_ext y/o p_trasera_ext';
  end if;

  update players set
    cedula_frontal_url = case
      when cedula_frontal_url is null and v_url_f is not null then v_url_f
      else cedula_frontal_url end,
    cedula_trasera_url = case
      when cedula_trasera_url is null and v_url_t is not null then v_url_t
      else cedula_trasera_url end
  where id = p_player_id;

  return jsonb_build_object(
    'ok', true,
    'player_id', p_player_id,
    'frontal_confirmada', v_url_f is not null,
    'trasera_confirmada', v_url_t is not null
  );
end;
$$;

revoke all on function public.confirmar_cedula_urls(uuid, text, text) from public;
grant execute on function public.confirmar_cedula_urls(uuid, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. Storage "cedulas" — insert una sola vez post-registro
--    Path real de la app: {player_id}_frontal.{ext} / _trasera.{ext}
-- ────────────────────────────────────────────────────────────

-- Quitar policies abiertas previas (si existen)
drop policy if exists "cedulas_select_all" on storage.objects;
drop policy if exists "cedulas_insert_all" on storage.objects;
drop policy if exists "cedulas_update_all" on storage.objects;
drop policy if exists "cedulas_delete_all" on storage.objects;
drop policy if exists "cedulas_select" on storage.objects;
drop policy if exists "cedulas_insert" on storage.objects;
drop policy if exists "cedulas_update" on storage.objects;
drop policy if exists "cedulas_delete" on storage.objects;
drop policy if exists "cedulas_insert_registro" on storage.objects;
drop policy if exists "cedulas_select_autorizado" on storage.objects;

-- Bucket privado (no listable por URL pública sin signed URL)
update storage.buckets set public = false where id = 'cedulas';

-- INSERT: path {uuid}_frontal.* o {uuid}_trasera.* y esa cara aún sin URL
create policy "cedulas_insert_registro"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'cedulas'
  and (
    (
      storage.objects.name ~* '^[0-9a-f-]{36}_frontal\.[a-z0-9]+$'
      and exists (
        select 1 from players p
        where p.id::text = split_part(storage.objects.name, '_frontal.', 1)
          and p.cedula_frontal_url is null
      )
    )
    or (
      storage.objects.name ~* '^[0-9a-f-]{36}_trasera\.[a-z0-9]+$'
      and exists (
        select 1 from players p
        where p.id::text = split_part(storage.objects.name, '_trasera.', 1)
          and p.cedula_trasera_url is null
      )
    )
  )
);

-- SELECT: admin, dueño del player, staff de su escuela, u organizador
-- de un torneo donde el jugador esté inscrito. Nunca anon/público.
create policy "cedulas_select_autorizado"
on storage.objects for select
to authenticated
using (
  bucket_id = 'cedulas'
  and (
    exists (
      select 1 from roles_plataforma rp
      where rp.activo is not false
        and rp.rol = 'admin'
        and (
          rp.user_id = auth.uid()
          or lower(rp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    or exists (
      select 1 from players p
      where p.user_id = auth.uid()
        and (
          storage.objects.name like (p.id::text || '_frontal.%')
          or storage.objects.name like (p.id::text || '_trasera.%')
        )
    )
    or exists (
      select 1 from players p
      join players staff on staff.escuela_id = p.escuela_id
      where staff.user_id = auth.uid()
        and p.escuela_id is not null
        and (staff.es_profesor or staff.es_profesor_coordinador or staff.rol = 'profesor')
        and (
          storage.objects.name like (p.id::text || '_frontal.%')
          or storage.objects.name like (p.id::text || '_trasera.%')
        )
    )
    or exists (
      select 1 from players p
      join tournament_player_registrations r on r.player_id = p.id
      join tournaments t on t.id = r.tournament_id
      where t.organizador_id = auth.uid()
        and (
          storage.objects.name like (p.id::text || '_frontal.%')
          or storage.objects.name like (p.id::text || '_trasera.%')
        )
    )
  )
);

-- Nota: createSignedUrl requiere SELECT en storage.objects — cubierto arriba.
