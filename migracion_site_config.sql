-- Configuración general del sitio (fila única) — por ahora solo el link de
-- "en vivo" que se muestra en la página de inicio (YouTube, Facebook o
-- Instagram live). Se deja como tabla de fila única en vez de una columna
-- suelta en otra tabla para poder sumar más ajustes del sitio más adelante
-- sin tener que migrar de nuevo.
create table if not exists site_config (
  id boolean primary key default true,
  en_vivo_activo boolean default false,
  en_vivo_url text,
  en_vivo_titulo text,
  updated_at timestamptz default now(),
  constraint site_config_una_fila check (id)
);

insert into site_config (id) values (true) on conflict (id) do nothing;

alter table site_config disable row level security;
