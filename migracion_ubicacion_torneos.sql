-- Ubicación estructurada de los torneos: país → departamento → municipio (+ vereda/barrio).
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo (IF NOT EXISTS).
--
-- `city` NO se toca ni se borra: sigue guardando el nombre de la ciudad/municipio
-- (la usan la planilla, los flyers y las páginas públicas). Las columnas nuevas
-- permiten filtrar sin duplicados: el código DANE del municipio es único
-- (dos "Córdoba" o dos "Armenia" ya no se confunden).

alter table public.tournaments
  add column if not exists pais             text default 'CO',   -- código de país (CO = Colombia)
  add column if not exists departamento     text,                -- nombre del departamento (o estado/provincia en otros países)
  add column if not exists municipio_codigo text,                -- código DANE de 5 dígitos (solo Colombia), ej. 63001 = Armenia, Quindío
  add column if not exists vereda           text;                -- vereda, corregimiento o barrio (opcional)

create index if not exists tournaments_municipio_codigo_idx on public.tournaments (municipio_codigo);

-- ── Completar torneos que ya existen (opcional, solo los casos que no tienen duda) ──
-- Los demás se pueden completar editando el torneo: al abrirlo, la ubicación ya sale
-- elegida si se pudo detectar, y solo hay que verificarla y guardar.
update public.tournaments
   set pais = 'CO', departamento = 'Quindío', municipio_codigo = '63001', city = 'Armenia'
 where municipio_codigo is null
   and upper(trim(city)) in ('ARMENIA', 'ARMENIA-QUINDIO/ COLOMBIA');

update public.tournaments
   set pais = 'CO', departamento = 'Quindío', municipio_codigo = '63470', city = 'Montenegro'
 where municipio_codigo is null
   and upper(trim(city)) = 'MONTENEGRO';

-- Hay tres municipios llamados "Córdoba" en Colombia (Quindío 63212, Bolívar 13212 y Nariño 52215;
-- además existe "Los Córdobas" 23419, en el departamento de Córdoba). Si los tuyos son los de
-- Quindío, quita los dos guiones del inicio de las líneas de abajo y ejecútalas:
-- update public.tournaments
--    set pais = 'CO', departamento = 'Quindío', municipio_codigo = '63212', city = 'Córdoba'
--  where municipio_codigo is null
--    and upper(trim(city)) in ('CORDOBA', 'CÓRDOBA');
