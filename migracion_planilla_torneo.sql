-- ============================================================
-- PLANILLA DEL TORNEO
-- Al crear un torneo el admin/organizador escoge con qué planilla se maneja:
--   'salon'    = Fútbol de salón (planilla profesional completa)
--   'futbol11' = Fútbol 11 (hoja de papel digital, una sola pantalla)
-- NULL = torneos creados antes de esto: siguen como siempre (admin → Fútbol 11,
-- árbitro/coordinador → Fútbol de salón).
-- Un partido que ya tenga su propia planilla (matches.planilla_tipo) mantiene esa.
-- Se puede ejecutar varias veces sin problema.
-- ============================================================

alter table public.tournaments
  add column if not exists planilla_tipo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_planilla_tipo_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_planilla_tipo_check
      check (planilla_tipo is null or planilla_tipo in ('salon', 'futbol11'));
  end if;
end $$;

comment on column public.tournaments.planilla_tipo is
  'Planilla del torneo: salon (profesional completa) | futbol11 (hoja de papel digital) | null (sin elegir, comportamiento anterior)';
