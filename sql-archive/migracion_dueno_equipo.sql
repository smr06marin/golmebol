-- ── Dueño / representante del equipo con cédula ─────────────────────────────
-- Cada equipo tiene un dueño identificado con cédula y teléfono. El dueño se
-- muestra debajo del equipo en todas las listas para que nadie se apropie de
-- un equipo ajeno. Solo el ADMIN PRINCIPAL puede cambiar quién es el dueño.

alter table teams add column if not exists representante_cedula text;
