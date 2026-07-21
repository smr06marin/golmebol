-- ══════════════════════════════════════════════════════════════════
-- Cupo de equipos por torneo (para organizadores)
-- ══════════════════════════════════════════════════════════════════
-- Un organizador de torneos NO puede crear ni agregar equipos libremente.
-- Debe pedirle permiso a Golmebol por WhatsApp, y el admin principal
-- habilita cuántos equipos puede tener EN ESE TORNEO específico
-- (el cupo es por torneo, no total del organizador — cada torneo nuevo
-- arranca en 0 y hay que pedir cupo de nuevo).
--
-- El admin principal (rol='admin') no está sujeto a este límite nunca.

alter table tournaments
  add column if not exists equipos_permitidos integer not null default 0;

comment on column tournaments.equipos_permitidos is
  'Cupo de equipos que el organizador de este torneo puede crear/agregar. Solo aplica si el torneo tiene organizador_id. El admin principal no tiene límite. Se habilita manualmente por Golmebol tras solicitud por WhatsApp.';

-- Torneos ya existentes de organizadores: si quieres que sigan pudiendo
-- agregar equipos sin pedir permiso de nuevo, sube este número a mano
-- para esos torneos puntuales, por ejemplo:
-- update tournaments set equipos_permitidos = 20 where id = '<id-del-torneo>';
