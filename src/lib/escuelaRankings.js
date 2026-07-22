import { supabase } from './supabase'

// Todas las categorías de ranking de la escuela, agrupadas por sección.
// "orden: asc" significa que el número MÁS BAJO es el mejor (ej. velocidad,
// goles recibidos). "soloPortero" limita esa categoría a jugadores con
// posicion === 'Portero'. No incluimos ranking de peso — comparar el peso
// entre niños puede hacerlos sentir mal, así que esa medida queda solo como
// dato de seguimiento individual en la ficha de evolución, no como ranking.
export const RANKING_SECCIONES = [
  {
    titulo: '⚽ Rendimiento en cancha',
    items: [
      { key: 'goles',       label: 'Goles',              icon: '⚽', campo: 'goles_escuela',       orden: 'desc', unidad: '' },
      { key: 'asistencias', label: 'Asistencias',        icon: '🎯', campo: 'asistencias_escuela', orden: 'desc', unidad: '' },
      { key: 'minutos',     label: 'Tiempo jugado',      icon: '⏱️', campo: 'minutos_escuela',     orden: 'desc', unidad: 'min' },
      { key: 'titular',     label: 'Veces titular',      icon: '★', campo: 'titular_escuela',      orden: 'desc', unidad: '' },
      { key: 'mvp',         label: 'Veces destacado (MVP)', icon: '👑', campo: 'mvp_escuela',       orden: 'desc', unidad: '' },
      { key: 'amarillas',   label: 'Tarjetas amarillas', icon: '🟨', campo: 'amarillas_escuela',    orden: 'desc', unidad: '' },
      { key: 'rojas',       label: 'Tarjetas rojas',     icon: '🟥', campo: 'rojas_escuela',        orden: 'desc', unidad: '' },
    ],
  },
  {
    titulo: '🧤 Arqueros',
    items: [
      { key: 'recibidos', label: 'Menos goles recibidos', icon: '🥅', campo: 'goles_recibidos_escuela', orden: 'asc',  unidad: '', soloPortero: true },
      { key: 'atajadas',  label: 'Más atajadas',           icon: '🧤', campo: 'atajadas_escuela',        orden: 'desc', unidad: '', soloPortero: true },
    ],
  },
  {
    titulo: '⚡ Pruebas físicas',
    items: [
      { key: 'velocidad',    label: 'Velocidad',       icon: '🏃', campo: 'velocidad_seg',     orden: 'asc',  unidad: 'seg' },
      { key: 'agilidad',     label: 'Agilidad',         icon: '🤸', campo: 'agilidad_seg',      orden: 'asc',  unidad: 'seg' },
      { key: 'resistencia',  label: 'Resistencia',      icon: '🫁', campo: 'resistencia_nivel', orden: 'desc', unidad: '' },
      { key: 'salto',        label: 'Salto vertical',   icon: '🦵', campo: 'salto_vertical_cm', orden: 'desc', unidad: 'cm' },
      { key: 'fuerza',       label: 'Fuerza',            icon: '💪', campo: 'fuerza_reps',       orden: 'desc', unidad: '' },
    ],
  },
  {
    titulo: '📏 Medidas',
    items: [
      { key: 'estatura',     label: 'Estatura',     icon: '📏', campo: 'estatura_cm',     orden: 'desc', unidad: 'cm' },
      { key: 'envergadura',  label: 'Envergadura',  icon: '📐', campo: 'envergadura_cm',  orden: 'desc', unidad: 'cm' },
    ],
  },
  {
    titulo: '📋 Evaluaciones del profesor',
    items: [
      { key: 'tecnica',    label: 'Evaluación técnica',       icon: '⚽', campo: 'nivel_tecnico',    orden: 'desc', unidad: '/10' },
      { key: 'tactica',    label: 'Evaluación táctica',       icon: '🧠', campo: 'nivel_tactico',    orden: 'desc', unidad: '/10' },
      { key: 'disciplina', label: 'Disciplina y actitud',     icon: '🤝', campo: 'nivel_disciplina', orden: 'desc', unidad: '/10' },
    ],
  },
]

function ultimoPorJugador(rows) {
  const mapa = {}
  ;(rows || []).forEach(r => { if (!mapa[r.jugador_id]) mapa[r.jugador_id] = r })
  return mapa
}

function promedio(row, campos) {
  if (!row) return null
  const vals = campos.map(c => row[c]).filter(v => v != null)
  if (vals.length === 0) return null
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
}

// Arma la plantilla de la escuela con todo lo necesario para calcular
// cualquiera de los rankings de arriba: los acumulados de players() más el
// último registro de cada evaluación (físicas, técnica, táctica, disciplina,
// medidas) por jugador.
export async function fetchRosterConRanking(escuelaId) {
  const { data: tp } = await supabase.from('team_players').select('*, players(*)').eq('team_id', escuelaId)
  const roster = (tp || []).map(t => t.players).filter(Boolean)
  const ids = roster.map(j => j.id)
  if (ids.length === 0) return []

  const [fis, tec, tac, disc, med] = await Promise.all([
    supabase.from('escuela_pruebas_fisicas').select('*').in('jugador_id', ids).order('fecha', { ascending: false }),
    supabase.from('escuela_tecnica').select('*').in('jugador_id', ids).order('fecha', { ascending: false }),
    supabase.from('escuela_tactica').select('*').in('jugador_id', ids).order('fecha', { ascending: false }),
    supabase.from('escuela_disciplina').select('*').in('jugador_id', ids).order('fecha', { ascending: false }),
    supabase.from('escuela_medidas').select('*').in('jugador_id', ids).order('fecha', { ascending: false }),
  ])

  const fisPorId = ultimoPorJugador(fis.data)
  const tecPorId = ultimoPorJugador(tec.data)
  const tacPorId = ultimoPorJugador(tac.data)
  const discPorId = ultimoPorJugador(disc.data)
  const medPorId = ultimoPorJugador(med.data)

  return roster.map(j => {
    const f = fisPorId[j.id], t = tecPorId[j.id], ta = tacPorId[j.id], d = discPorId[j.id], m = medPorId[j.id]
    return {
      id: j.id,
      nombre: j.name,
      foto: j.photo_face_url || j.photo_url || null,
      esPortero: j.posicion === 'Portero',
      goles_escuela: j.goles_escuela || 0,
      asistencias_escuela: j.asistencias_escuela || 0,
      amarillas_escuela: j.amarillas_escuela || 0,
      rojas_escuela: j.rojas_escuela || 0,
      minutos_escuela: j.minutos_escuela || 0,
      titular_escuela: j.titular_escuela || 0,
      mvp_escuela: j.mvp_escuela || 0,
      atajadas_escuela: j.atajadas_escuela || 0,
      goles_recibidos_escuela: j.goles_recibidos_escuela || 0,
      partidos_escuela: j.partidos_escuela || 0,
      velocidad_seg: f?.velocidad_seg ?? null,
      agilidad_seg: f?.agilidad_seg ?? null,
      resistencia_nivel: f?.resistencia_nivel ?? null,
      salto_vertical_cm: f?.salto_vertical_cm ?? null,
      fuerza_reps: f?.fuerza_reps ?? null,
      estatura_cm: m?.estatura_cm ?? null,
      envergadura_cm: m?.envergadura_cm ?? null,
      nivel_tecnico: promedio(t, ['control', 'pase_corto', 'pase_largo', 'conduccion', 'regate', 'remate', 'cabeceo']),
      nivel_tactico: promedio(ta, ['posicionamiento', 'decisiones', 'comprension', 'marcacion', 'movimientos_sin_balon']),
      nivel_disciplina: promedio(d, ['puntualidad', 'asistencia', 'actitud', 'trabajo_equipo', 'liderazgo', 'respeto', 'esfuerzo']),
    }
  })
}

// Devuelve { puesto, total } de un jugador en una categoría, o null si no
// tiene datos todavía en esa categoría.
export function posicionDe(roster, item, playerId) {
  const filtrado = roster.filter(j => (!item.soloPortero || j.esPortero) && j[item.campo] != null)
  if (filtrado.length === 0) return null
  const ordenado = [...filtrado].sort((a, b) => item.orden === 'asc' ? a[item.campo] - b[item.campo] : b[item.campo] - a[item.campo])
  const idx = ordenado.findIndex(j => j.id === playerId)
  if (idx === -1) return null
  return { puesto: idx + 1, total: ordenado.length }
}
