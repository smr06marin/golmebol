-- Permite configurar VARIOS links de transmisión en vivo a la vez (por si
-- hay varios partidos jugándose a la misma hora, en canchas distintas),
-- en vez de un solo link como antes (en_vivo_url/en_vivo_titulo/
-- en_vivo_activo/en_vivo_match_id, que se dejan en la tabla sin usar por si
-- hace falta volver atrás). Cada elemento del arreglo es:
--   { id, url, titulo, match_id, activo }
alter table site_config add column if not exists en_vivo_streams jsonb default '[]'::jsonb;

-- Migra el link único que ya hubiera configurado, para no perder lo que ya
-- estaba guardado (solo corre si todavía no hay nada en en_vivo_streams).
update site_config
set en_vivo_streams = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'url', en_vivo_url,
    'titulo', en_vivo_titulo,
    'match_id', en_vivo_match_id,
    'activo', coalesce(en_vivo_activo, false)
  )
)
where coalesce(en_vivo_url, '') <> ''
  and (en_vivo_streams is null or en_vivo_streams = '[]'::jsonb);
