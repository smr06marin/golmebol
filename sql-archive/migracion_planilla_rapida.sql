-- ── Planilla rápida (sin planillador) ───────────────────────────────────────
-- Segunda planilla, independiente de la completa (PlanillaPartido.jsx no se
-- toca). La usan los mismos árbitros cuando NO hay un planillador dedicado:
-- asignan camisetas con foto antes de iniciar y luego anotan goles/tarjetas
-- por número en una pantalla dividida por equipo, con cronómetro.

-- 1. Marca, por partido, si NO hay planillador (la coordinadora/líder la
--    activa al asignar árbitros). Decide qué pantalla ve el árbitro en
--    ArbitroHomePage: la completa de siempre, o la rápida.
alter table matches add column if not exists sin_planillador boolean not null default false;

-- 2. Snapshot en vivo PROPIO de la planilla rápida (borrador autoguardado),
--    separado de matches.live_state (que usa la planilla completa) para que
--    nunca se mezclen ni un formato le rompa la lectura al otro.
alter table matches add column if not exists live_state_rapida jsonb;
alter table matches add column if not exists live_state_rapida_updated_at timestamptz;
