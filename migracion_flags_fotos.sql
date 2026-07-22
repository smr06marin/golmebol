-- Permite al admin/coordinador marcar una foto específica del jugador (tarjeta,
-- perfil, cédula frontal o cédula trasera) como "debe cambiarla" — por ejemplo
-- si la foto no cumple la recomendación (mala calidad, no se ve bien, etc).
-- Cuando el jugador sube una foto nueva de ese tipo, la app limpia el aviso
-- automáticamente. El aviso se muestra en el perfil del jugador y en la
-- planilla del próximo partido.
alter table players add column if not exists foto_cambiar_tarjeta boolean default false;
alter table players add column if not exists foto_cambiar_perfil boolean default false;
alter table players add column if not exists foto_cambiar_cedula_frontal boolean default false;
alter table players add column if not exists foto_cambiar_cedula_trasera boolean default false;
