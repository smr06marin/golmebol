import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, MapPin, Clock, Trophy, AlertTriangle } from 'lucide-react'
import PlanillaRapida from '../components/planillaRapida/PlanillaRapida'
import { fmtHoraDate } from '../lib/horaHelpers'

// Entrada pública (sin cuenta ni login) para que un árbitro ocasional
// planille UN partido puntual desde un link de 24h que le manda el
// organizador (ver botón "Link árbitro" en /admin/calendario).
//
// Pasos:
//  1) Se valida el token con ver_partido_por_link() (público, solo lectura)
//     y se muestra bien grande el partido — para que el árbitro confirme
//     que es el que le toca ANTES de escribir nada.
//  2) Escribe su nombre y confirma: se hace un login anónimo de Supabase
//     (requiere "Allow anonymous sign-ins" activado en el proyecto) y se
//     llama a reclamar_planilla_por_link(), que valida el token de nuevo
//     y deja registrado quién va a planillar.
//  3) Se abre PlanillaRapida (la Planilla Rápida normal, sin ningún cambio)
//     ya cargada con ese partido — el guardado es exactamente el mismo
//     código que usa cualquier árbitro con cuenta real.
export default function PlanillarLinkPage() {
  const { token } = useParams()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [nombre, setNombre] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [partido, setPartido] = useState(null)
  const [terminado, setTerminado] = useState(false)

  useEffect(() => { cargarPreview() }, [token])

  async function cargarPreview() {
    setCargando(true)
    const { data, error: err } = await supabase.rpc('ver_partido_por_link', { p_token: token })
    if (err || !data || data.vencido) {
      setError(err?.message === 'Link inválido' ? 'Este link no es válido.' : 'Este link ya venció (los links duran 24 horas).')
    } else {
      setPreview(data)
    }
    setCargando(false)
  }

  async function handleComenzar() {
    if (!nombre.trim()) return
    setEntrando(true)
    setError('')
    try {
      // Si el celular ya tiene una sesión real (un admin/árbitro probando su
      // propio link, por ejemplo), se respeta esa — no se pisa con una
      // sesión anónima nueva.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { error: errAnon } = await supabase.auth.signInAnonymously()
        if (errAnon) throw new Error('No se pudo entrar: ' + errAnon.message)
      }

      const { data, error: errReclamar } = await supabase.rpc('reclamar_planilla_por_link', {
        p_token: token, p_nombre: nombre.trim(),
      })
      if (errReclamar) throw new Error(errReclamar.message)

      const { data: match, error: errMatch } = await supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('id', data.match_id).single()
      if (errMatch || !match) throw new Error('No se pudo cargar el partido')

      setPartido(match)
    } catch (e) {
      setError(e.message || 'Error al entrar')
    } finally {
      setEntrando(false)
    }
  }

  if (partido) {
    return (
      <PlanillaRapida
        partido={partido}
        onClose={() => setTerminado(true)}
        onGuardarResultado={() => {}}
      />
    )
  }

  const wrap = { minHeight: '100vh', background: '#07070e', fontFamily: 'system-ui,sans-serif', color: '#e8f4fd', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }

  if (terminado) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✓</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>¡Listo, gracias!</div>
          <div style={{ fontSize: '.85rem', color: '#7a9ab5', marginTop: '6px' }}>Ya puedes cerrar esta página.</div>
        </div>
      </div>
    )
  }

  if (cargando) {
    return <div style={wrap}><div style={{ color: '#00ddd0', fontSize: '.9rem' }}>Cargando...</div></div>
  }

  if (error && !preview) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center', maxWidth: '340px' }}>
          <AlertTriangle size={36} color="#e8710a" style={{ marginBottom: '10px' }}/>
          <div style={{ fontSize: '1rem', fontWeight: '800' }}>{error}</div>
          <div style={{ fontSize: '.8rem', color: '#7a9ab5', marginTop: '8px' }}>Pídele al organizador que te mande un link nuevo.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '.65rem', letterSpacing: '.3em', color: '#7a9ab5', textTransform: 'uppercase' }}>GOLMEBOL · PLANILLA</div>
        </div>

        {/* Partido bien grande y claro — esto es lo primero que confirma el árbitro */}
        <div style={{ background: '#111827', border: '1px solid #1e2d3d', borderRadius: '16px', padding: '22px 18px', marginBottom: '18px' }}>
          <div style={{ textAlign: 'center', fontSize: '.75rem', color: '#f9a825', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Trophy size={13}/> {preview.torneo}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {preview.home_logo
                ? <img src={preview.home_logo} style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 6px' }}/>
                : <div style={{ width: '44px', height: '44px', margin: '0 auto 6px', borderRadius: '10px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} color="#7a9ab5"/></div>}
              <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#e8f4fd' }}>{preview.home || 'Por definir'}</div>
            </div>
            <div style={{ fontWeight: '900', fontSize: '.8rem', color: '#7a9ab5' }}>VS</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {preview.away_logo
                ? <img src={preview.away_logo} style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 6px' }}/>
                : <div style={{ width: '44px', height: '44px', margin: '0 auto 6px', borderRadius: '10px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} color="#7a9ab5"/></div>}
              <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#e8f4fd' }}>{preview.away || 'Por definir'}</div>
            </div>
          </div>

          {/* Hora y cancha — GRANDE, para que no haya duda de cuál partido es */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: 'rgba(0,221,208,.08)', border: '1px solid rgba(0,221,208,.25)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#00ddd0', fontSize: '.65rem', fontWeight: '700', marginBottom: '3px' }}><Clock size={11}/> HORA</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fff' }}>{preview.hora ? fmtHoraDate(preview.hora) : '—'}</div>
              {preview.hora && <div style={{ fontSize: '.65rem', color: '#7a9ab5', marginTop: '2px' }}>{new Date(preview.hora).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })}</div>}
            </div>
            <div style={{ flex: 1, background: 'rgba(249,168,37,.08)', border: '1px solid rgba(249,168,37,.25)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#f9a825', fontSize: '.65rem', fontWeight: '700', marginBottom: '3px' }}><MapPin size={11}/> CANCHA</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', lineHeight: 1.2 }}>{preview.cancha || 'Por confirmar'}</div>
            </div>
          </div>
        </div>

        {/* Nombre del árbitro — se pide ANTES de abrir la planilla, así queda ordenado quién planilla cada partido */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '.72rem', fontWeight: '700', color: '#7a9ab5', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Tu nombre (árbitro) *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo"
            style={{ width: '100%', background: '#1e2d3d', border: '1px solid #2a3a4a', borderRadius: '10px', padding: '12px 14px', color: '#e8f4fd', fontSize: '.95rem', outline: 'none', boxSizing: 'border-box' }}/>
        </div>

        {error && <div style={{ fontSize: '.78rem', color: '#ff6b6b', marginBottom: '10px' }}>{error}</div>}

        <button onClick={handleComenzar} disabled={!nombre.trim() || entrando}
          style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a73e8,#00ddd0)', color: '#07070e', fontSize: '.9rem', fontWeight: '800', opacity: (!nombre.trim() || entrando) ? .6 : 1 }}>
          {entrando ? 'Entrando...' : 'Comenzar planilla'}
        </button>
      </div>
    </div>
  )
}
