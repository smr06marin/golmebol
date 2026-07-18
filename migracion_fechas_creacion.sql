-- ── Fecha de creación SIEMPRE, para equipos y jugadores ─────────────────────

-- Equipos: fecha de creación con default automático + rellenar los viejos
alter table teams add column if not exists created_at timestamptz default now();
update teams set created_at = now() where created_at is null;

-- Jugadores: asegurar que fecha_registro siempre quede (default + rellenar
-- los viejos). Guardado con tolerancia por si la columna es de tipo texto.
do $$ begin
  alter table players alter column fecha_registro set default now();
exception when others then null; end $$;

do $$ begin
  update players set fecha_registro = now() where fecha_registro is null;
exception when others then
  update players set fecha_registro = now()::text where fecha_registro is null;
end $$;
