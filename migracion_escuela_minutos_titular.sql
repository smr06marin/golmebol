-- Al finalizar un partido de escuela: quiénes fueron titulares queda guardado
-- en el partido, y el tiempo jugado de cada jugador (desde que entró hasta
-- que salió) se calcula solo a partir de los cambios registrados. Ambos datos
-- se suman a la "vida futbolística" del jugador (tabla players), además de
-- quedar el detalle de ese partido en escuela_partido_stats.
alter table escuela_partidos add column if not exists titulares jsonb not null default '[]';
alter table escuela_partido_stats add column if not exists titular boolean;

alter table players add column if not exists titular_escuela int not null default 0;
alter table players add column if not exists minutos_escuela int not null default 0;
-- Estas dos ya se registraban por partido (atajadas y goles recibidos del
-- portero) pero no se estaban sumando a la ficha del jugador — se agregan
-- aquí para que también queden guardadas de forma acumulada.
alter table players add column if not exists atajadas_escuela int not null default 0;
alter table players add column if not exists goles_recibidos_escuela int not null default 0;
