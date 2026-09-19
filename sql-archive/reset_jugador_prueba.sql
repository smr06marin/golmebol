-- Resetea por completo la cuenta de acceso del jugador de prueba (cédula
-- 9999900001) para poder probar el login desde cero, ya con el arreglo del
-- bug de "cuenta huérfana" puesto.
--
-- Corre este script completo en el SQL Editor de Supabase. Después de
-- correrlo, entra de nuevo al login de jugador con la cédula 9999900001 —
-- te va a pedir el nombre para verificar (escribe: Jugador Prueba) y crear
-- una contraseña nueva desde cero.

-- 1) Diagnóstico: mira esto primero para confirmar qué había pasado
select id, name, numero_cedula, user_id, es_jugador_escuela, primer_ingreso
from players
where numero_cedula = '9999900001';

select id, email, created_at
from auth.users
where email = '9999900001@golmebol.com';

-- 2) Reset: borra la cuenta de acceso vieja (si existe) y desvincula al jugador
delete from auth.users where email = '9999900001@golmebol.com';

update players
set user_id = null
where numero_cedula = '9999900001';
