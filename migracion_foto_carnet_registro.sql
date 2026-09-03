-- ============================================================
-- MIGRACIÓN: foto para el carnet del jugador, opcional, en el
-- registro público de equipo (/registro/equipo).
--
-- Sigue el mismo patrón ya usado para las fotos del documento de
-- identidad (cedulas): el anon sube el archivo directo a Storage
-- (bucket "players", que ya es público — ahí ya viven las fotos de
-- perfil/tarjeta de jugadores existentes) con un nombre restringido,
-- y después se confirma con un RPC security definer que guarda la
-- URL en players.photo_url — así el anon nunca necesita permiso de
-- UPDATE directo sobre la tabla players.
--
-- Solo se puede subir una vez por jugador (si ya tiene photo_url, ni
-- el insert en Storage ni la confirmación hacen nada) — igual que ya
-- funciona la foto de tarjeta/perfil en SubidaFotoJugador.jsx.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. confirmar_foto_carnet(player_id, ext)
-- ────────────────────────────────────────────────────────────

drop function if exists public.confirmar_foto_carnet(uuid, text);

create or replace function public.confirmar_foto_carnet(
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

  -- Ya tiene foto de carnet: no se pisa (una sola vez, igual que la
  -- que sube el jugador ya logueado desde su perfil).
  if v_p.photo_url is not null then
    return jsonb_build_object('ok', true, 'player_id', p_player_id, 'confirmada', false, 'ya_tenia', true);
  end if;

  v_ext := lower(regexp_replace(trim(coalesce(p_ext, '')), '[^a-z0-9]', '', 'g'));
  if v_ext = '' or v_ext !~ '^(jpe?g|png|webp|gif|heic)$' then
    raise exception 'Extensión de foto inválida';
  end if;

  v_nombre := 'fotos/' || p_player_id::text || '_tarjeta.' || v_ext;
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

  update players set photo_url = v_url
  where id = p_player_id and photo_url is null;

  return jsonb_build_object('ok', true, 'player_id', p_player_id, 'confirmada', true, 'ya_tenia', false);
end;
$$;

revoke all on function public.confirmar_foto_carnet(uuid, text) from public;
grant execute on function public.confirmar_foto_carnet(uuid, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. Storage "players" — permitir que el anon suba la foto de
--    carnet durante el registro público, solo con el nombre
--    fotos/{player_id}_tarjeta.{ext} y solo si ese jugador todavía
--    no tiene photo_url (para que no se pueda pisar una ya subida).
-- ────────────────────────────────────────────────────────────

drop policy if exists "players_insert_carnet_registro" on storage.objects;

create policy "players_insert_carnet_registro"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'players'
  and storage.objects.name ~* '^fotos/[0-9a-f-]{36}_tarjeta\.[a-z0-9]+$'
  and exists (
    select 1 from players p
    where p.id::text = split_part(split_part(storage.objects.name, 'fotos/', 2), '_tarjeta.', 1)
      and p.photo_url is null
  )
);
