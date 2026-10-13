import PlanillaRapida from '../planillaRapida/PlanillaRapida'

// Planilla de papel: la hoja sencilla (Documento, Nombre, N°, Amarilla, Roja,
// GOL, cronómetro). Usa EXACTAMENTE el mismo motor de la planilla rápida
// (guardado en vivo, cronómetro, varios celulares a la vez, cierre y
// estadísticas) — solo cambia la pantalla: ver PantallaPapel.jsx.
export default function PlanillaPapel(props) {
  return <PlanillaRapida {...props} vista="papel"/>
}
