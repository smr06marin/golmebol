import { useState } from 'react'
import PlanillaPartido from './PlanillaPartido'
import PlanillaPapel from './planillaPapel/PlanillaPapel'
import { usaPlanillaCompleta } from '../lib/tipoPlanilla'

// Punto único de entrada a "llenar planilla": decide cuál planilla abrir
// (ver src/lib/tipoPlanilla.js). Se decide UNA vez por partido al abrirla:
// aunque la planilla empiece a guardar borradores, no cambia de tipo a mitad.
// contexto: 'arbitro' (cuenta propia de árbitro/coordinador → planilla profesional) o nada (admin/organizador → planilla normal).
function PlanillaDecidida({ contexto, ...props }) {
  // Se decide una sola vez (el padre la vuelve a montar con `key` si cambia el partido).
  const [completa, setCompleta] = useState(() => usaPlanillaCompleta(props.partido, contexto))
  if (completa) return <PlanillaPartido {...props}/>
  // El organizador / admin abre la planilla normal, pero puede PASARSE a la profesional con un botón (solo en un partido
  // sin terminar). La planilla normal solo muestra ese botón mientras no se haya llenado nada, para no perder trabajo.
  // Al pasarse, el partido queda con la profesional: la próxima vez que se abra, abre esa.
  const puedeCambiar = contexto !== 'arbitro' && props.partido?.status !== 'finished'
  return <PlanillaPapel {...props} onCambiarProfesional={puedeCambiar ? () => setCompleta(true) : undefined}/>
}

export default function PlanillaSegunPartido({ contexto, ...props }) {
  return <PlanillaDecidida key={props.partido?.id} contexto={contexto} {...props}/>
}
