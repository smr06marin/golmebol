-- =====================================================================
-- CUÁNTAS PERSONAS INSTALARON GOLMEBOL EN EL CELULAR
-- Pegar COMPLETO en Supabase → SQL Editor → RUN. Se puede correr más de una vez.
--
-- Qué guarda: eventos anónimos (sin nombre, correo ni teléfono). Cada celular se identifica con un
-- código al azar guardado en el propio celular.
--   banner_visto · ver_como · instalar_toque · ahora_no  → el recorrido de quien ve el aviso
--   instalada  → el navegador avisó que se instaló (Android / Chrome)
--   abre_app   → alguien abrió Golmebol DESDE el ícono de su pantalla (1 vez al día por celular).
--                Así se cuentan también los iPhone, que no avisan al instalar.
-- Solo los administradores principales pueden leer los números (función de abajo).
-- =====================================================================

create table if not exists app_instalaciones (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_id  text not null check (char_length(device_id) between 8 and 64),
  evento     text not null check (evento in ('banner_visto', 'ver_como', 'instalar_toque', 'instalada', 'abre_app', 'ahora_no')),
  sistema    text check (sistema in ('ios', 'android', 'otro')),
  navegador  text check (char_length(navegador) <= 30)
);
create index if not exists app_instalaciones_evento_idx on app_instalaciones (evento, created_at);
create index if not exists app_instalaciones_device_idx on app_instalaciones (device_id);

alter table app_instalaciones enable row level security;

-- Cualquiera puede ANOTAR un evento (el visitante no tiene cuenta). Nadie puede leer la tabla directamente.
drop policy if exists "app_instalaciones_insert" on app_instalaciones;
create policy "app_instalaciones_insert" on app_instalaciones
  for insert to anon, authenticated with check (true);

-- Resumen para el panel (solo administradores principales)
create or replace function app_instalaciones_resumen()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) not in ('golmebol@gmail.com', 'smr06marin@gmail.com') then
    raise exception 'sin permiso';
  end if;

  with inst as (
    select device_id,
           min(created_at) as primera,
           max(created_at) as ultima,
           (array_agg(sistema order by created_at desc))[1] as sistema
    from app_instalaciones
    where evento in ('instalada', 'abre_app')
    group by device_id
  ), emb as (
    select evento, count(distinct device_id) as n
    from app_instalaciones
    where created_at >= now() - interval '30 days'
      and evento in ('banner_visto', 'ver_como', 'instalar_toque', 'instalada', 'ahora_no')
    group by evento
  )
  select jsonb_build_object(
    'instalados',  (select count(*) from inst),
    'nuevos_hoy',  (select count(*) from inst where primera >= date_trunc('day', now())),
    'nuevos_7d',   (select count(*) from inst where primera >= now() - interval '7 days'),
    'activos_7d',  (select count(*) from inst where ultima  >= now() - interval '7 days'),
    'ios',         (select count(*) from inst where sistema = 'ios'),
    'android',     (select count(*) from inst where sistema = 'android'),
    'embudo',      coalesce((select jsonb_object_agg(evento, n) from emb), '{}'::jsonb)
  ) into r;
  return r;
end;
$$;

revoke all on function app_instalaciones_resumen() from public;
grant execute on function app_instalaciones_resumen() to authenticated;
