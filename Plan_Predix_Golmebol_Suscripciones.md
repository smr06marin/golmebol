# Plan: Predix Golmebol con suscripciones

## 1. Qué cambia

Hoy todo lo relacionado con predicciones vive en `PlayerApuestasPage.jsx` y `PredixApuestasPage.jsx`: predicciones de resultados (`predicciones`), duelos 1v1 (`predix_apuestas` + `predix_cruces`) y el ranking combinado — todo gratis y todo suma para el mismo ranking.

El resto de Golmebol sigue 100% gratis (torneos, planillas, tarjetas de logros, perfil, etc.). Predix Golmebol pasa a ser **freemium**, no un muro cerrado: cualquier jugador puede seguir prediciendo gratis, pero solo los suscritos compiten por premios reales. Se mantiene el nombre **Predix Golmebol**.

## 2. Dos mundos separados: Demo vs. Pagos

Cada jugador tiene **dos contadores de puntos independientes**:

- **Puntos Demo**: los gana cualquiera, sin pagar nada. No dan premio.
- **Puntos Pagos**: solo se ganan mientras el jugador tiene una suscripción activa. Son los que compiten por los premios reales.

Si un jugador free decide suscribirse, sus puntos demo NO se convierten en puntos pagos — arranca en 0 en la parte de pagos. Los dos contadores conviven, pero no se mezclan.

En el perfil del jugador se muestra claramente en cuál modo está acumulando ("Puntos Demo" / "Puntos Pagos"), y si está en modo pagos pero la suscripción ya venció, se le avisa que debe pagar/renovar para seguir sumando ahí.

**Duelos 1v1**: solo se pueden armar entre jugadores del mismo mundo — pago contra pago, o demo contra demo. Nunca se cruzan.

## 3. Planes de suscripción

Dos tipos:

- **Por torneo**: habilita predicciones/duelos solo de ese torneo. El jugador elige cuánto paga, entre **$10.000 y $50.000**. Premio al 1er lugar: **4 veces** lo que pagó.
- **Completa**: habilita todos los torneos activos de Golmebol. El jugador elige cuánto paga, entre **$10.000 y $30.000**. Premio al 1er lugar: **10 veces** lo que pagó.

Como cada jugador paga un monto distinto dentro del rango, lo que pagó queda visible en su página principal/perfil ("Suscripción: $XX.XXX"), y también lo puede ver el admin principal desde el panel.

El pago es manual: un botón "Quiero suscribirme" abre WhatsApp con mensaje prellenado (mismo número que ya usan: `573226490055`, salvo que me digas otro). Ustedes coordinan el pago por fuera de la app y un admin activa/renueva la suscripción manualmente desde el panel (jugador, plan, torneo si aplica, **monto que pagó dentro del rango**, fecha de inicio) — el sistema calcula el vencimiento.

## 4. Rondas con fechas fijas, controladas por el admin principal

Cada ronda de predicciones (jornada, fase, o torneo completo) tiene fecha de apertura de inscripción, fecha de cierre, y fecha de finalización. Estas fechas las coloca el admin principal.

Cuando se acerca la apertura de una ronda, se manda una notificación a **todos los jugadores** avisando algo como "Las predicciones se habilitan el [fecha] — adelanta tu suscripción". Se puede reutilizar la tabla `notificaciones` que ya existe (la misma que usan para reclamos de árbitros).

## 5. Premios mensuales y bono de tarjetas

- **Ranking de premios**: separado por tipo de suscripción — un ranking para "por torneo" y otro para "completa" (no se mezclan). El 1er lugar de cada uno gana el premio en dinero (4x / 10x lo que pagó). El 2do y 3er lugar también ganan premio, pero son **premios sorpresa de patrocinadores** — no tienen un monto fijo en la app, se revelan por fuera.
- **Bono por tarjeta desbloqueada**: si el jugador desbloquea una tarjeta Golmebol (sistema de logros que ya existe) mientras lleva **mínimo 3 meses pagados seguidos**, también entra a premio.
- **Margen de gracia en la racha de meses**: si en algún mes no hay ningún torneo activo en el que el jugador pueda predecir, ese mes no rompe la racha (no es su culpa que no haya torneo).
- Qué se gana en concreto no vive en la app — el mensaje sigue siendo "escríbenos por WhatsApp para conocer los premios del mes".

## 6. Datos actuales = pruebas

Los jugadores y predicciones que ya existen en Predix hoy son datos de prueba (todavía no ha terminado ningún torneo con este sistema corriendo). No hace falta migración especial ni período de gracia para ellos — se resetea limpio cuando esto entre en producción.

## 7. Tablas nuevas en Supabase (propuesta)

- `predix_planes`: id, nombre, tipo (`torneo` | `completa`), tournament_id (si aplica), precio, duracion_dias, activo
- `predix_suscripciones`: id, player_id, plan_id, tournament_id (null si es "completa"), precio_pagado, fecha_inicio, fecha_fin, estado (activa/vencida/cancelada), meses_seguidos
- `predix_rondas`: id, tournament_id, nombre, fecha_apertura, fecha_cierre, fecha_fin, estado
- `predix_premios_mensuales`: id, mes, tipo (top3_torneo / top3_completa / tarjeta), player_id, posicion, monto, entregado (bool)

En `predicciones` y `predix_apuestas` se agrega un campo `modo` (`demo` | `pago`) para separar los dos mundos de puntos, y en `players` (o en una tabla aparte) dos contadores: `puntos_demo`, `puntos_pagos`.

## 8. Pantallas afectadas

**Jugador:**
- Predix/Apuestas: banner de "Puntos Demo" o "Puntos Pagos" según el modo. Si predice en modo pagos sin suscripción activa/vigente, aviso para suscribirse/renovar (no le bloquea seguir en modo demo).
- Pantalla de planes (por torneo / completa) con botón WhatsApp.
- "Mi suscripción": plan activo, vence el [fecha], racha de meses seguidos.
- Countdown de la próxima ronda cuando está cerrada.

**Admin:**
- Gestión de planes (crear por torneo o completa, precio dentro del rango, activar/desactivar).
- Gestión de suscripciones (activar, renovar, cancelar, ver vencidas).
- Gestión de rondas por torneo (fechas de apertura/cierre) — dispara la notificación masiva al abrir.
- Vista de premios del mes: ranking top 3 por torneo, top 3 completa, y lista de bonos por tarjeta desbloqueada.

## 9. Ya está todo definido

Con las respuestas de las secciones anteriores no quedan preguntas abiertas — puedo armar la base de datos completa y el panel de admin sin más vueltas.

## 10. Fases sugeridas de implementación

1. Tablas nuevas + panel admin para planes y suscripciones (sin tocar aún las pantallas de jugador).
2. Puntos Demo vs. Puntos Pagos en Predix/Apuestas del jugador + pantalla de planes con botón WhatsApp + candado de emparejamiento en duelos 1v1 (pago con pago, demo con demo).
3. Rondas con fechas de apertura/cierre por torneo + notificación masiva al abrir.
4. Racha de meses seguidos (con margen de gracia sin torneo activo) + vista de premios mensuales para el admin.
