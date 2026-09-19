-- ============================================================
-- MIGRACIÓN: foto de perfil opcional en el registro público de
-- equipo (/registro/equipo) — se le muestra al jugador como "foto
-- para el carnet del jugador", pero es la MISMA foto de perfil que
-- ya se usa en toda la plataforma (players.photo_face_url — la que
-- pide SubidaFotoJugador.jsx en el portal de jugador). Así, si el
-- jugador ya la sube acá al registrarse, no se la vuelve a pedir
-- después al entrar a su cuenta.
--
-- (Ojo: photo_url es la foto de TARJETA/uniforme, distinta — esta
-- migración NO toca esa, solo la de perfil/cara.)
--
-- Mismo patrón que las fotos del documento de identidad (cedulas):
-- el anon sube el archivo directo a Storage (bucket "players", que
-- ya es público) con un nombre restringido, y después se confirma
-- con un RPC security definer que guarda la URL en
-- players.photo_face_url — así el anon nunca necesita permiso de
-- UPDATE directo sobre la tabla players.
--
-- Solo se puede subir una vez por jugador (si ya tiene
-- photo_face_url, ni el insert en Storage ni la confirmación hacen
-- nada) — igual que ya funciona esa foto en SubidaFotoJugador.jsx.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. buscar_jugador_por_cedula: ahora también devuelve
--    photo_face_url, para que el registro sepa si el jugador
--    existente ya tiene foto de perfil o hay que pedírsela.
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
    'photo_face_url', v_p.photo_face_url,
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
-- 2. confirmar_foto_perfil(player_id, ext)
-- ────────────────────────────────────────────────────────────

drop function if exists public.confirmar_foto_carnet(uuid, text);
drop function if exists public.confirmar_foto_perfil(uuid, text);

create or replace function public.confirmar_foto_perfil(
  p_player_id uuid,
  p_ext text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p      players%rowtype;
  v_ext    text;
  v_nombre text;
  v_url    text;
  v_origin text;
  v_base   text;
begin
  if p_player_id is null then
    raise exception 'player_id obligatorio';
  end if;

  select * into v_p from players where id = p_player_id;
  if not found then raise exception 'Jugador no encontrado'; end if;

  -- Ya tiene foto de perfil: no se pisa (una sola vez, igual que la
  -- que sube el jugador ya logueado desde su cuenta).
  if v_p.photo_face_url is not null then
    return jsonb_build_object('ok', true, 'player_id', p_player_id, 'confirmada', false, 'ya_tenia', true);
  end if;

  v_ext := lower(regexp_replace(trim(coalesce(p_ext, '')), '[^a-z0-9]', '', 'g'));
  if v_ext = '' or v_ext !~ '^(jpe?g|png|webp|gif|heic)$' then
    raise exception 'Extensión de foto inválida';
  end if;

  v_nombre := 'fotos/' || p_player_id::text || '_cara.' || v_ext;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'players' and name = v_nombre
  ) then
    raise exception 'Archivo no encontrado, subilo primero';
  end if;

  -- Origen para armar la URL pública (mismo formato que getPublicUrl).
  select (regexp_match(u, '^(https?://[^/]+)'))[1]
    into v_origin
  from (
    (select photo_url as u from players where photo_url ~ '^https?://' limit 1)
    union all
    (select photo_face_url as u from players where photo_face_url ~ '^https?://' limit 1)
  ) s
  limit 1;

  v_base := coalesce(v_origin, '') || '/storage/v1/object/public/players/';
  v_url  := v_base || v_nombre;

  update players set photo_face_url = v_url
  where id = p_player_id and photo_face_url is null;

  return jsonb_build_object('ok', true, 'player_id', p_player_id, 'confirmada', true, 'ya_tenia', false);
end;
$$;

revoke all on function public.confirmar_foto_perfil(uuid, text) from public;
grant execute on function public.confirmar_foto_perfil(uuid, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. Storage "players" — permitir que el anon suba la foto de
--    perfil durante el registro público, solo con el nombre
--    fotos/{player_id}_cara.{ext} y solo si ese jugador todavía no
--    tiene photo_face_url (para que no se pueda pisar una ya subida).
--
--    OJO: la condición NO puede consultar la tabla "players"
--    directamente dentro de la política — eso necesita que el rol
--    "anon" tenga permiso de SELECT sobre esa tabla, y ya se lo
--    quitamos (ver migracion_rls_seguridad_tanda1.sql, "anon pierde
--    SELECT en players"). Por eso el chequeo va adentro de una
--    función security definer: así corre con permisos elevados y
--    "anon" nunca necesita acceso directo a "players".
-- ────────────────────────────────────────────────────────────

create or replace function public.puede_subir_foto_perfil_registro(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from players p
    where p.id::text = split_part(split_part(p_name, 'fotos/', 2), '_cara.', 1)
      and p.photo_face_url is null
  );
$$;

grant execute on function public.puede_subir_foto_perfil_registro(text) to anon, authenticated;

drop policy if exists "players_insert_carnet_registro" on storage.objects;
drop policy if exists "players_insert_perfil_registro" on storage.objects;

create policy "players_insert_perfil_registro"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'players'
  and storage.objects.name ~* '^fotos/[0-9a-f-]{36}_cara\.[a-z0-9]+$'
  and public.puede_subir_foto_perfil_registro(storage.objects.name)
);


-- ────────────────────────────────────────────────────────────
-- 4. Storage "cedulas" — mismo problema, ya existía desde antes:
--    la política "cedulas_insert_registro" (migracion_rpc_registro.sql)
--    también consulta "players" directo, así que hoy también le
--    fallaría a "anon" si ya se le quitó el SELECT sobre players.
--    Se redefine acá con el mismo arreglo (función security definer),
--    manteniendo exactamente la misma regla (frontal/trasera, y solo
--    si esa cara todavía no tiene URL guardada).
-- ────────────────────────────────────────────────────────────

create or replace function public.puede_subir_cedula_registro(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when p_name ~* '^[0-9a-f-]{36}_frontal\.[a-z0-9]+$' then exists (
        select 1 from players p
        where p.id::text = split_part(p_name, '_frontal.', 1)
          and p.cedula_frontal_url is null
      )
      when p_name ~* '^[0-9a-f-]{36}_trasera\.[a-z0-9]+$' then exists (
        select 1 from players p
        where p.id::text = split_part(p_name, '_trasera.', 1)
          and p.cedula_trasera_url is null
      )
      else false
    end;
$$;

grant execute on function public.puede_subir_cedula_registro(text) to anon, authenticated;

drop policy if exists "cedulas_insert_registro" on storage.objects;
create policy "cedulas_insert_registro"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'cedulas'
  and public.puede_subir_cedula_registro(storage.objects.name)
);
