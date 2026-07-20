# Escuelas Deportivas — Golmebol

Golmebol no es solo para torneos de adultos: también quiere servir a escuelas de
fútbol (jugadores menores de edad) que quieren llevar su plantilla y jugar sus
partidos con la misma app. Esto agrega un nuevo tipo de usuario ("profesor")
sobre la base de datos que ya existe, reutilizando todo lo posible.

## 1. Roles

- **Profesor coordinador**: el único que puede crear la escuela (nombre +
  categoría), agregar jugadores menores, y agregar otros profesores a su
  escuela. Es al primero al que el admin le da acceso.
- **Profesor** (regular): puede ver la plantilla de su escuela y usar la
  herramienta de día de partido (convocatoria, formación, partido en vivo).
  No puede crear jugadores ni otros profesores.

Ambos inician sesión con el mismo login por cédula que ya usan jugadores y
árbitros (`/jugador/login`), y son redirigidos a `/escuela` en vez de
`/jugador` o `/arbitro`.

## 2. Modelo de datos (reutiliza `teams` y `players`, sin tablas nuevas)

- `teams.tipo` ('club' | 'escuela') y `teams.categoria` (texto libre, ej.
  "Sub-10") — una escuela ES un equipo, solo que marcado distinto.
- `players.es_profesor`, `players.es_profesor_coordinador` (mismo patrón que
  `es_arbitro` / `es_arbitro_lider` que ya existe para árbitros).
- `players.escuela_id` → a qué escuela (equipo tipo='escuela') pertenece ese
  profesor.
- `players.acudiente_nombre`, `players.acudiente_telefono` — contacto del
  acudiente, dato razonable a pedir siendo menores de edad.
- La "tarjeta de identidad" del menor reutiliza los campos que ya existían
  para cédula de adultos (`numero_cedula`, `cedula_frontal_url`,
  `cedula_trasera_url`): es el mismo tipo de dato (número + foto de ambos
  lados), solo que la etiqueta en pantalla cambia a "Tarjeta de identidad"
  automáticamente cuando `fecha_nacimiento` indica que es menor de edad.
- Los jugadores de la escuela se vinculan al equipo con la tabla
  `team_players` que ya existe — no hace falta ninguna tabla nueva ahí.

## 3. Fases

**Fase 1 — Base (esta entrega)**
- Migración de columnas nuevas.
- Admin: nueva sección "Escuelas" (`/admin/escuelas`) para darle acceso al
  primer profesor coordinador de una escuela nueva (por cédula, igual que
  Árbitros).
- Portal del profesor (`/escuela`): si el coordinador todavía no tiene
  escuela, primero la crea (nombre + categoría). Luego ve un panel con
  accesos a Jugadores y Profesores.
- `/escuela/jugadores`: alta de jugadores menores con tarjeta de identidad,
  foto, datos del acudiente. Coordinador crea/edita, profesor regular solo
  ve.
- `/escuela/profesores`: coordinador agrega otros profesores a su escuela.

**Fase 2 — Día de partido (pendiente, siguiente entrega)**
- Adaptar la pizarra táctica (el archivo que Sebas compartió:
  convocatoria → formación → partido en vivo con cronómetro, eventos,
  cambios por arrastre, resumen final) a React, conectada a los jugadores
  reales de la escuela en vez de datos de prueba, con historial guardado en
  Supabase (no en localStorage, para que no se pierda si cambian de
  celular).

## 4. Cómo ejecutar la migración

Supabase → SQL Editor → pegar `migracion_escuelas.sql` → RUN. Es seguro
ejecutarlo más de una vez.
