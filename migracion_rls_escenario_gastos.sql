-- ============================================================
-- FIX: "new row violates row-level security policy for table
-- escenario_gastos" al registrar un gasto
--
-- Cómo pasó: migracion_rls_seguridad_tanda1.sql activó RLS (seguridad
-- por fila) en escenario_ventas, escenario_compras y escenario_pedidos
-- con sus políticas — pero se quedó por fuera escenario_gastos. Si en
-- algún momento se activó RLS en esa tabla (a mano, o desde el aviso de
-- seguridad de Supabase) sin política, TODO insert queda bloqueado por
-- defecto — de ahí el error.
--
-- Esta migración le pone a escenario_gastos exactamente las mismas
-- reglas que ya tienen ventas/compras: solo el encargado de ESE
-- escenario (o el admin de la plataforma) puede ver/crear/editar/borrar
-- sus gastos.
--
-- Cómo ejecutar: Supabase → SQL Editor → pegar todo → RUN
-- Es seguro ejecutarlo más de una vez.
-- ============================================================

alter table escenario_gastos enable row level security;

drop policy if exists "escenario_gastos_select" on escenario_gastos;
drop policy if exists "escenario_gastos_insert" on escenario_gastos;
drop policy if exists "escenario_gastos_update" on escenario_gastos;
drop policy if exists "escenario_gastos_delete" on escenario_gastos;

create policy "escenario_gastos_select"
on escenario_gastos for select
using (public.es_encargado_escenario(escenario_id));

create policy "escenario_gastos_insert"
on escenario_gastos for insert
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_gastos_update"
on escenario_gastos for update
using (public.es_encargado_escenario(escenario_id))
with check (public.es_encargado_escenario(escenario_id));

create policy "escenario_gastos_delete"
on escenario_gastos for delete
using (public.es_encargado_escenario(escenario_id));
