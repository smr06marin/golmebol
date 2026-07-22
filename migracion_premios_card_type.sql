-- Permite que un premio de escuela (escuela_premios) también desbloquee un
-- diseño de tarjeta FIFA para el jugador. Si card_type es null, el premio
-- sigue siendo solo una insignia visual como hasta ahora (sin cambios de
-- comportamiento). Si el coordinador le pone un card_type (el id de un
-- diseño de src/components/card/designs/cardDesigns.js), cuando el jugador
-- alcanza el umbral de ese premio, ese diseño aparece disponible para elegir
-- en su tarjeta (MiTarjetaEscuelaPage.jsx calcula esto en el cliente,
-- comparando el stat del jugador contra el umbral — no hay trigger en la
-- base de datos, todo se calcula al cargar la tarjeta).

alter table escuela_premios add column if not exists card_type text;
