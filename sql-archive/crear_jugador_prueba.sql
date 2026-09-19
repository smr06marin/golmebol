-- Crea un jugador de PRUEBA en tu escuela para que puedas entrar con su
-- tarjeta de identidad y ver cómo se ve la tarjeta de jugador de escuela/club
-- (que es distinta a la tarjeta de jugador de Golmebol/torneos).
--
-- Toma automáticamente el club al que perteneces como coordinador (cédula
-- 1094948980). Si por algún motivo no encuentra tu club, revisa que esa
-- cédula sea correcta o reemplázala por la tuya.

with mi_escuela as (
  select escuela_id from players where numero_cedula = '1094948980' limit 1
),
nuevo as (
  insert into players (
    name, fecha_nacimiento, numero_cedula, tipo_sangre, genero, telefono,
    posicion, pie_dominante, anios_jugando,
    acudiente_nombre, acudiente_telefono,
    es_jugador_escuela, activo_membresia, fecha_vencimiento, primer_ingreso, fecha_registro
  )
  values (
    'Jugador Prueba', '2015-05-10', '9999900001', 'O+', 'Masculino', '3000000000',
    'Delantero', 'derecho', 2,
    'Acudiente Prueba', '3000000000',
    true, true, null, false, now()
  )
  returning id
)
insert into team_players (team_id, player_id, activo)
select mi_escuela.escuela_id, nuevo.id, true
from mi_escuela, nuevo;


-- ───────────────────────────────────────────────────────────────────
-- Para verlo: entra al login de jugador con la cédula 9999900001.
-- Como es su primer ingreso, te va a pedir escribir su nombre y primer
-- apellido para verificar (escribe: Jugador Prueba) y luego crear una
-- contraseña (mínimo 6 caracteres, la que quieras). Al entrar te lleva
-- directo a su tarjeta de jugador de escuela.
-- ───────────────────────────────────────────────────────────────────

-- Cuando termines de probarlo, para borrarlo corre esto:
-- delete from team_players where player_id = (select id from players where numero_cedula = '9999900001');
-- delete from players where numero_cedula = '9999900001';
