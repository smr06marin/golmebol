import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { CANAL_PRESENCIA, contarPresencia } from '../lib/presenciaSitio'

// SEMÁFORO DEL SISTEMA — solo administrador principal, arriba del panel.
// Cada 30 s (y solo con la pantalla a la vista) mide qué tan rápido responde la base de datos y, si se corrió
// migracion_estado_sistema.sql, cuántas conexiones y consultas lentas hay. Verde = sano · Amarillo = vigilar · Rojo = saturado.

const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']
const CADA_MS = 30000
const COLOR = { verde: '#1e8e3e', amarillo: '#f9ab00', rojo: '#d93025' }
const FONDO = { verde: '#e6f4ea', amarillo: '#fef7e0', rojo: '#fce8e6' }

function nivelMayor(a, b) { const o = ['verde', 'amarillo', 'rojo']; return o[Math.max(o.indexOf(a), o.indexOf(b))] }

function evaluar({ ms, error, est }) {
  if (error) return { nivel: 'rojo', titulo: 'No responde', motivos: ['La base de datos no contestó. Revisa Supabase → Infrastructure.'] }
  let nivel = ms < 700 ? 'verde' : ms < 2000 ? 'amarillo' : 'rojo'
  const motivos = []
  if (ms >= 700) motivos.push(`Responde lento (${(ms / 1000).toFixed(1)} s)`)
  if (est) {
    const uso = est.max_conexiones ? est.conexiones / est.max_conexiones : 0
    if (uso >= 0.8) { nivel = nivelMayor(nivel, 'rojo'); motivos.push(`Conexiones casi llenas (${est.conexiones} de ${est.max_conexiones})`) }
    else if (uso >= 0.6) { nivel = nivelMayor(nivel, 'amarillo'); motivos.push(`Conexiones altas (${est.conexiones} de ${est.max_conexiones})`) }
    if (est.consultas_lentas >= 8) { nivel = nivelMayor(nivel, 'rojo'); motivos.push(`${est.consultas_lentas} consultas atascadas`) }
    else if (est.consultas_lentas >= 3) { nivel = nivelMayor(nivel, 'amarillo'); motivos.push(`${est.consultas_lentas} consultas lentas`) }
  }
  const titulo = nivel === 'verde' ? 'Sistema sano' : nivel === 'amarillo' ? 'Vigilar: va un poco cargado' : 'Sistema saturado'
  return { nivel, titulo, motivos }
}

function Dato({ titulo, valor, nota }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.7)', borderRadius: '10px', padding: '8px 10px' }}>
      <div style={{ fontSize: '.68rem', color: '#5f6368', fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#202124', lineHeight: 1.2 }}>{valor}</div>
      {nota ? <div style={{ fontSize: '.68rem', color: '#80868b' }}>{nota}</div> : null}
    </div>
  )
}

export default function EstadoSistema() {
  const { user } = useAuthStore()
  const esPrincipal = ADMINS_PRINCIPALES.includes((user?.email || '').toLowerCase())
  const [lectura, setLectura] = useState(null) // { nivel, titulo, motivos, ms, est, hora }
  const [abierto, setAbierto] = useState(false)
  const ocupado = useRef(false)
  const [gente, setGente] = useState(null) // { enSitio, viendoVivo } — personas con la portada abierta ahora

  // Cuenta de personas en el sitio AHORA (canal de presencia; este panel solo cuenta, no se anota)
  useEffect(() => {
    if (!esPrincipal) return undefined
    let canal = null
    try {
      canal = supabase.channel(CANAL_PRESENCIA)
      const actualizar = () => { try { setGente(contarPresencia(canal.presenceState())) } catch { /* nada */ } }
      canal.on('presence', { event: 'sync' }, actualizar).subscribe()
    } catch { /* sin presencia: no se muestra la cuenta */ }
    return () => { try { if (canal) supabase.removeChannel(canal) } catch { /* nada */ } }
  }, [esPrincipal])

  useEffect(() => {
    if (!esPrincipal) return undefined
    let vivo = true
    async function medir() {
      if (!vivo || ocupado.current || document.hidden) return
      ocupado.current = true
      const t0 = performance.now()
      let error = false
      try {
        const { error: e } = await supabase.from('tournaments').select('id').limit(1)
        if (e) error = true
      } catch { error = true }
      const ms = performance.now() - t0
      let est = null
      if (!error) {
        try {
          const { data, error: e2 } = await supabase.rpc('estado_sistema')
          if (!e2 && data) est = data
        } catch { /* sin la función: solo se mide la velocidad */ }
      }
      ocupado.current = false
      if (vivo) setLectura({ ...evaluar({ ms, error, est }), ms, est, hora: new Date() })
    }
    medir()
    const t = setInterval(medir, CADA_MS)
    const v = () => { if (!document.hidden) medir() }
    document.addEventListener('visibilitychange', v)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [esPrincipal])

  if (!esPrincipal) return null
  const n = lectura?.nivel || 'verde'
  return (
    <div style={{ background: lectura ? FONDO[n] : '#f1f3f4', border: `1px solid ${lectura ? COLOR[n] : '#dadce0'}`, borderRadius: '12px', padding: '10px 14px', marginBottom: '14px', fontFamily: 'system-ui, sans-serif' }}>
      <button onClick={() => setAbierto(a => !a)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: lectura ? COLOR[n] : '#9aa0a6', flexShrink: 0 }}/>
        <span style={{ fontWeight: 800, fontSize: '.92rem', color: '#202124', flex: 1 }}>{lectura ? lectura.titulo : 'Revisando el sistema…'}</span>
        {lectura && <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{gente ? `👥 ${gente.enSitio} · ` : ''}{lectura.est ? `${lectura.est.conexiones}/${lectura.est.max_conexiones} conexiones · ` : ''}{(lectura.ms / 1000).toFixed(1)} s</span>}
        <span style={{ fontSize: '.8rem', color: '#5f6368' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && lectura && (
        <div style={{ marginTop: '10px', fontSize: '.82rem', color: '#202124', lineHeight: 1.5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            <Dato titulo="Personas en el sitio ahora" valor={gente ? gente.enSitio : '—'} nota={gente ? 'con la portada abierta' : 'conectando…'}/>
            <Dato titulo="Viendo el en vivo" valor={gente ? gente.viendoVivo : '—'} nota="con la transmisión a la vista"/>
            <Dato titulo="Conexiones a la base" valor={lectura.est ? `${lectura.est.conexiones} / ${lectura.est.max_conexiones}` : '—'} nota={lectura.est ? `${Math.round(100 * lectura.est.conexiones / Math.max(1, lectura.est.max_conexiones))} % en uso` : 'falta correr el SQL'}/>
            <Dato titulo="Respuesta de la base" valor={`${(lectura.ms / 1000).toFixed(1)} s`} nota={lectura.est ? `${lectura.est.consultas_lentas} consultas lentas` : ''}/>
          </div>
          {lectura.motivos.length > 0 && <div style={{ marginBottom: '6px' }}>{lectura.motivos.map(m => <div key={m}>• {m}</div>)}</div>}
          {n === 'verde' && <div>Todo normal. Se actualiza solo cada 30 segundos.</div>}
          {n === 'amarillo' && <div>Aún funciona. Si sigue así, no recarguen las planillas y revisa Supabase → Infrastructure.</div>}
          {n === 'rojo' && <div><b>Qué hacer:</b> avisa a los árbitros que NO cierren ni recarguen la planilla (lo anotado queda en su celular), y revisa Supabase → Infrastructure. Si la CPU está arriba de 80 %, hay que subir el servidor o reiniciarlo.</div>}
          {!lectura.est && <div style={{ marginTop: '6px', color: '#5f6368' }}>Solo mide la velocidad. Para ver también conexiones y consultas atascadas, corre <b>migracion_estado_sistema.sql</b> en Supabase.</div>}
          <div style={{ marginTop: '6px', color: '#80868b', fontSize: '.72rem' }}>Última revisión: {lectura.hora.toLocaleTimeString('es-CO')}</div>
        </div>
      )}
    </div>
  )
}
