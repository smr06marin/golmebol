import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PlanillaPartido from './PlanillaPartido'
import PlanillaPapel from './planillaPapel/PlanillaPapel'
import { usaPlanillaCompleta } from '../lib/tipoPlanilla'

// Punto único de entrada a "llenar planilla": decide cuál planilla abrir
// (ver src/lib/tipoPlanilla.js). Se decide UNA vez por partido al abrirla:
// aunque la planilla empiece a guardar borradores, no cambia de tipo a mitad.
// contexto: 'arbitro' (cuenta de árbitro/coordinador) o nada (admin/organizador); ver tipoPlanilla.js
//
// Para admin/organizador, si el partido no tiene planilla propia se consulta la
// que se escogió al crear el torneo (tournaments.planilla_tipo). Se guarda en
// memoria para no volver a preguntar en cada partido del mismo torneo.
const cacheTipoTorneo = new Map() // tournament_id -> 'salon' | 'futbol11' | null

async function tipoDelTorneo(torneoId) {
  try {
    const { data, error } = await supabase.from('tournaments').select('planilla_tipo').eq('id', torneoId).maybeSingle()
    if (error) return null // sin columna / sin permiso: comportamiento de siempre (no se guarda en caché)
    const tipo = data?.planilla_tipo === 'salon' || data?.planilla_tipo === 'futbol11' ? data.planilla_tipo : null
    cacheTipoTorneo.set(torneoId, tipo)
    return tipo
  } catch {
    return null
  }
}

function PlanillaDecidida({ contexto, tipoTorneo, ...props }) {
  // Se decide una sola vez (el padre la vuelve a montar con `key` si cambia el partido).
  const [completa] = useState(() => usaPlanillaCompleta(props.partido, contexto, tipoTorneo))
  return completa ? <PlanillaPartido {...props}/> : <PlanillaPapel {...props}/>
}

export default function PlanillaSegunPartido({ contexto, ...props }) {
  const p = props.partido
  const idActual = p?.id
  const torneoId = contexto !== 'arbitro' && p && !p.planilla_tipo ? (p.tournament_id || null) : null
  const [resuelto, setResuelto] = useState({ torneoId: null, tipo: null })

  useEffect(() => {
    if (!torneoId || cacheTipoTorneo.has(torneoId)) return undefined
    let vivo = true
    tipoDelTorneo(torneoId).then(tipo => { if (vivo) setResuelto({ torneoId, tipo }) })
    return () => { vivo = false }
  }, [torneoId])

  let tipoTorneo = null
  if (torneoId) {
    if (cacheTipoTorneo.has(torneoId)) tipoTorneo = cacheTipoTorneo.get(torneoId)
    else if (resuelto.torneoId === torneoId) tipoTorneo = resuelto.tipo
    else tipoTorneo = undefined // todavía consultando
  }

  if (tipoTorneo === undefined) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368', fontSize: '1rem', fontFamily: 'system-ui, sans-serif' }}>
        Cargando planilla…
      </div>
    )
  }
  return <PlanillaDecidida key={idActual} contexto={contexto} tipoTorneo={tipoTorneo} {...props}/>
}
