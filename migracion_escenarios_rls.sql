-- ============================================================
-- FIX: Row Level Security en las tablas de Escenarios Deportivos
--
-- Supabase activó RLS automáticamente en las tablas nuevas (escenarios,
-- escenario_productos, etc.) y sin políticas eso bloquea TODO acceso,
-- incluso al admin — por eso salía "row-level security policy" al crear
-- un escenario. El resto de la plataforma (tournaments, matches, teams,
-- players...) no usa RLS, así que acá se desactiva para que estas tablas
-- se comporten igual que todas las demás.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenarios           disable row level security;
alter table escenario_productos  disable row level security;
alter table escenario_ventas     disable row level security;
alter table escenario_compras    disable row level security;
alter table escenario_reservas   disable row level security;
alter table escenario_pedidos    disable row level security;
