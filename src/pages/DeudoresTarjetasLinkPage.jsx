import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react'

// Entrada pública (sin cuenta ni login) para ver quién debe tarjeta en un
// torneo, filtrar por equipo y registrar el pago ahí mismo — el link es fijo
// por torneo (no vence como el de planilla) y lo genera el organizador desde
// Finanzas del torneo ("Link deudores de tarjetas"). El árbitro ya NO puede
// desbloquear/cobrar tarjetas desde la planilla — esto reemplaza esa función
// para quien el organizador decida darle el link (él mismo, un colaborador,
// un capitán de equipo que va a pagar, etc).
const S = {
  navy: '#07070e', card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025', green: '#22c55e', gold: '#f9a825',
}
const inp = { background: S.card2, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '9px 12px', color: S.text, fontSize: '.85rem', outline: 'none', fontFamily: 'system-ui,sans-serif' }
const iconoTipo = { Amarilla: '🟨', Azul: '🟦', Roja: '🟥' }

export default function DeudoresTarjetasLinkPage() {
  const { token } = useParams()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [equipoFiltro, setEquipoFiltro] = useState('')
  const [pagando, setPagando] = useState(null) // player_id en proceso
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [token])

  async function cargar() {
    setCargando(true); setError('')
    const { data: res, error: err } = await supabase.rpc('ver_deudores_por_link', { p_token: token })
    if (err || !res) {
      setError(err?.message === 'Link inválido' ? 'Este link no es válido.' : 'No se pudo cargar la información.')
      setData(null)
    } else {
      setData(res)
    }
    setCargando(false)
  }

  function showMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg(null), 3500)
  }

  async function pagar(deudor) {
    if (!confirm(`¿${deudor.nombre} ya pagó ${fmt(deudor.total)} en tarjetas? Esto lo desbloquea de una vez en la planilla.`)) return
    setPagando(deudor.player_id)
    const { data: res, error: err } = await supabase.rpc('pagar_tarjeta_por_link', { p_token: token, p_player_id: deudor.player_id })
    setPagando(null)
    if (err || !res) { showMsg(err?.message || 'No se pudo registrar el pago', 'error'); return }
    showMsg(`Pago de ${deudor.nombre} registrado ✓`)
    cargar()
  }

  function fmt(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }

  const deudores = data?.deudores || []
  const equipos = data?.equipos || []
  const filtrados = equipoFiltro ? deudores.filter(d => d.team_id === equipoFiltro) : deudores
  const totalGeneral = useMemo(() => filtrados.reduce((a, d) => a + (d.total || 0), 0), [filtrados])

  const wrap = { minHeight: '100vh', background: S.navy, fontFamily: 'system-ui,sans-serif', color: S.text, padding: '20px 16px 60px' }

  if (cargando) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted }}>Cargando deudores de tarjetas...</div>
    </div>
  )

  if (error) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '320px' }}>
        <AlertTriangle size={32} color={S.loss}/>
        <div style={{ marginTop: '10px', fontWeight: 700 }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: S.gold }}>
          <Shield size={18}/><span style={{ fontWeight: 800, fontSize: '.85rem' }}>Deudores de tarjetas</span>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '16px' }}>{data.torneo}</div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <select value={equipoFiltro} onChange={e => setEquipoFiltro(e.target.value)} style={{ ...inp, flex: 1, minWidth: '180px' }}>
            <option value="">Todos los equipos</option>
            {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <div style={{ fontSize: '.8rem', color: S.text2 }}>
            {filtrados.length} jugador{filtrados.length !== 1 ? 'es' : ''} · Total <b style={{ color: S.loss }}>{fmt(totalGeneral)}</b>
          </div>
        </div>

        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '.82rem', fontWeight: 700,
            background: msg.tipo === 'error' ? 'rgba(217,48,37,.15)' : 'rgba(34,197,94,.15)',
            color: msg.tipo === 'error' ? '#ff6b5e' : S.green, border: `1px solid ${msg.tipo === 'error' ? 'rgba(217,48,37,.4)' : 'rgba(34,197,94,.4)'}` }}>
            {msg.texto}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: S.muted }}>
            <CheckCircle2 size={32} color={S.green}/>
            <div style={{ marginTop: '10px', fontWeight: 700 }}>Nadie debe tarjetas{equipoFiltro ? ' en este equipo' : ''} 🎉</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtrados.map(d => (
              <div key={d.player_id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{d.nombre}</div>
                    <div style={{ fontSize: '.72rem', color: S.muted }}>{d.equipo || 'Sin equipo'}</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '1.05rem', color: S.loss, whiteSpace: 'nowrap' }}>{fmt(d.total)}</div>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(d.items || []).map((it, i) => (
                    <div key={i} style={{ fontSize: '.74rem', color: S.text2 }}>
                      {(it.tiposDelPartido || [it.tipo]).map(t => iconoTipo[t] || '🃏').join(' ')} {(it.tiposDelPartido || [it.tipo]).join(' + ')}
                      {(it.home || it.away) && <span style={{ color: S.muted }}> · {it.home || '?'} vs {it.away || '?'}</span>}
                      {it.fecha && <span style={{ color: S.muted }}> · {new Date(it.fecha).toLocaleDateString('es-CO')}</span>}
                      <span style={{ fontWeight: 700 }}> · {fmt(it.monto)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => pagar(d)} disabled={pagando === d.player_id}
                  style={{ marginTop: '12px', width: '100%', padding: '10px', background: S.green, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#07070e', fontWeight: 800, fontSize: '.82rem', opacity: pagando === d.player_id ? .6 : 1 }}>
                  {pagando === d.player_id ? 'Registrando...' : '✓ Ya pagó — Marcar como pagado'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
