// Ubicación estructurada de un torneo: país → departamento → municipio (+ vereda/barrio opcional).
//
// Antes la ciudad era un texto libre y quedaban duplicados ("ARMENIA", "Armenia",
// "ARMENIA-QUINDIO/ COLOMBIA", "CORDOBA" y "Córdoba"). Para Colombia ahora se elige
// de la lista oficial (DANE): cada municipio tiene un código único, así dos
// "Córdoba" (Quindío, Bolívar, Nariño…) o dos "Armenia" (Quindío y Antioquia)
// nunca se confunden ni se duplican. Para otros países se escribe el estado/ciudad
// y se unifican por texto (sin tildes ni mayúsculas).
import { DEPARTAMENTOS_CO } from './ubicacionesColombiaData'

export { DEPARTAMENTOS_CO }

// Colombia primero, "Otro" al final, el resto por orden alfabético.
export const PAISES = [
  ['CO', 'Colombia'],
  ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brasil'], ['CL', 'Chile'], ['CR', 'Costa Rica'],
  ['CU', 'Cuba'], ['EC', 'Ecuador'], ['SV', 'El Salvador'], ['ES', 'España'], ['US', 'Estados Unidos'],
  ['GT', 'Guatemala'], ['HN', 'Honduras'], ['MX', 'México'], ['NI', 'Nicaragua'], ['PA', 'Panamá'],
  ['PY', 'Paraguay'], ['PE', 'Perú'], ['DO', 'República Dominicana'], ['UY', 'Uruguay'], ['VE', 'Venezuela'],
  ['OT', 'Otro país'],
]
const NOMBRE_PAIS = Object.fromEntries(PAISES)
export const nombrePais = codigo => NOMBRE_PAIS[String(codigo || 'CO').toUpperCase()] || String(codigo || '')

// ── Texto ────────────────────────────────────────────────────────────────
export const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
// Clave para comparar: sin tildes, minúsculas y sin signos ni espacios.
// "ARMENIA" = "Armenia " ; "2014-2015" = "2014/2015" = "*2014-2015*".
export const claveTexto = s => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
// Quita signos sobrantes en los extremos ("*2012-2013*") y espacios dobles.
export const limpiarTexto = s => String(s ?? '').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim()
const PEQUENAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en'])
// Si todo está en MAYÚSCULAS lo pasa a Título ("PUEBLO TAPAO" → "Pueblo Tapao"); si no, lo deja igual.
export function tituloSiGrita(s) {
  const t = limpiarTexto(s)
  if (!t || t !== t.toUpperCase() || t === t.toLowerCase()) return t
  return t.toLowerCase().split(' ').map((p, i) => (i > 0 && PEQUENAS.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// ── Índices de Colombia ───────────────────────────────────────────────────
const DEP_POR_CODIGO = new Map()
const DEP_POR_CLAVE = new Map()
const MUN_POR_CODIGO = new Map()
const MUN_POR_CLAVE = new Map() // clave de nombre → [códigos]
DEPARTAMENTOS_CO.forEach(([dc, dn, ms]) => {
  DEP_POR_CODIGO.set(dc, { codigo: dc, nombre: dn })
  DEP_POR_CLAVE.set(claveTexto(dn), dc)
  ms.forEach(([mc, mn]) => {
    MUN_POR_CODIGO.set(mc, { codigo: mc, nombre: mn, depCodigo: dc, depNombre: dn })
    const k = claveTexto(mn)
    if (!MUN_POR_CLAVE.has(k)) MUN_POR_CLAVE.set(k, [])
    MUN_POR_CLAVE.get(k).push(mc)
  })
})
// Nombres con los que la gente suele escribir algunos departamentos.
;[['bogota', '11'], ['bogotadc', '11'], ['valle', '76'], ['sanandres', '88'], ['guajira', '44'], ['nortedesantander', '54']]
  .forEach(([k, c]) => { if (!DEP_POR_CLAVE.has(k)) DEP_POR_CLAVE.set(k, c) })

export const municipioPorCodigo = codigo => MUN_POR_CODIGO.get(String(codigo || '')) || null
export const departamentoPorCodigo = codigo => DEP_POR_CODIGO.get(String(codigo || '')) || null
export const municipiosDeDepartamento = depCodigo => (DEPARTAMENTOS_CO.find(d => d[0] === depCodigo)?.[2] || []).map(([codigo, nombre]) => ({ codigo, nombre }))

const DEP_PREFERIDO = '63' // Quindío: si un nombre es ambiguo (Córdoba, Armenia…) y no hay otra pista, se asume de acá

// Intenta adivinar el municipio de un texto libre viejo ("ARMENIA-QUINDIO/ COLOMBIA", "Córdoba", "calarca").
// Devuelve el municipio o null si no lo puede decir con seguridad.
export function inferirMunicipioCO(ciudad, departamento) {
  const partes = String(ciudad || '').split(/[-/,()]+/).map(claveTexto).filter(Boolean)
  const depExplicito = DEP_POR_CLAVE.get(claveTexto(departamento))
  for (let i = 0; i < partes.length; i++) {
    const codigos = MUN_POR_CLAVE.get(partes[i])
    if (!codigos) continue
    // Pistas de departamento: el campo departamento y las OTRAS partes del texto ("ARMENIA-QUINDIO/ COLOMBIA" → Quindío).
    // Ojo: "Córdoba" también es un departamento, por eso la propia parte no cuenta como pista de sí misma.
    const pistas = [depExplicito, ...partes.filter((_, j) => j !== i).map(x => DEP_POR_CLAVE.get(x))].filter(Boolean)
    const conPista = codigos.filter(c => pistas.includes(c.slice(0, 2)))
    const candidatos = conPista.length > 0 ? conPista : codigos
    if (candidatos.length === 1) return MUN_POR_CODIGO.get(candidatos[0])
    const pref = candidatos.filter(c => c.slice(0, 2) === DEP_PREFERIDO)
    if (pref.length === 1) return MUN_POR_CODIGO.get(pref[0])
  }
  return null
}

// Ubicación normalizada de un torneo (sirve también para filtrar en la landing).
// Las claves (…Key) son las que se comparan; las etiquetas (…Label) son las que se muestran.
export function ubicacionDeTorneo(t) {
  const pais = String(t?.pais || 'CO').toUpperCase()
  const vereda = limpiarTexto(t?.vereda)
  if (pais === 'CO') {
    let mun = t?.municipio_codigo ? municipioPorCodigo(t.municipio_codigo) : null
    let inferida = false
    if (!mun) { mun = inferirMunicipioCO(t?.city, t?.departamento); inferida = !!mun }
    if (mun) {
      return { pais, paisLabel: 'Colombia', depKey: 'CO-' + mun.depCodigo, depLabel: mun.depNombre, munKey: 'CO-' + mun.codigo, munLabel: mun.nombre, munCodigo: mun.codigo, depCodigo: mun.depCodigo, vereda, inferida }
    }
    const txt = tituloSiGrita(t?.city)
    return { pais, paisLabel: 'Colombia', depKey: '', depLabel: '', munKey: txt ? 'txt-' + claveTexto(txt) : '', munLabel: txt, munCodigo: '', depCodigo: '', vereda, inferida: false }
  }
  const dep = tituloSiGrita(t?.departamento)
  const mun = tituloSiGrita(t?.city)
  return {
    pais, paisLabel: nombrePais(pais),
    depKey: dep ? `${pais}-${claveTexto(dep)}` : '', depLabel: dep,
    munKey: mun ? `${pais}-${claveTexto(mun)}` : '', munLabel: mun,
    munCodigo: '', depCodigo: '', vereda, inferida: false,
  }
}

// "Armenia, Quindío" (o "Armenia · La Tebaida" si hay vereda) para mostrar en tarjetas.
export function textoUbicacion(t) {
  const u = ubicacionDeTorneo(t)
  const lugar = [u.vereda, u.munLabel].filter(Boolean).join(', ')
  return [lugar, u.depLabel].filter(Boolean).join(' · ')
}
