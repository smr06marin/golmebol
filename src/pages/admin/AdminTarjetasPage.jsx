import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CARD_DESIGNS } from '../../components/card/designs/cardDesigns'
import PlayerCard from '../../components/card/PlayerCard'

const TIPOS = [
  { value: 'pj',        label: 'Partidos jugados' },
  { value: 'goles',     label: 'Goles anotados'   },
  { value: 'victorias', label: 'Victorias'         },
  { value: 'eficacia',  label: '% Eficacia'        },
  { value: 'racha',     label: 'Victorias seguidas'},
  { value: 'titulos',   label: 'Títulos ganados'   },
]

const GRUPOS = [
  { label: 'Nivel 1 — Inicio', ids: ['nivel1_verde','nivel1_azul','nivel1_bronce','nivel1_plata','nivel1_oro'], color: '#1e8e3e' },
  { label: 'Nivel 2 — 10 PJ',  ids: ['nivel2_inicio','nivel2_bronce','nivel2_plata','nivel2_oro','nivel2_legendario'], color: '#1a73e8' },
  { label: 'Nivel 3 — 25 PJ',  ids: ['nivel3_inicio','nivel3_bronce','nivel3_plata','nivel3_oro','nivel3_legendario'], color: '#6c35de' },
  { label: 'Premium',           ids: ['premium_inicio','premium_bronce','premium_plata','premium_oro','premium_legendario'], color: '#e8710a' },
]

const inp = {
  background: '#fff', border: '1px solid #dadce0', borderRadius: '8px',
  padding: '7px 10px', color: '#202124', fontSize: '.82rem', outline: 'none',
  fontFamily: 'system-ui, sans-serif', width: '100%', boxSizing: 'border-box',
}

export default function AdminTarjetasPage() {
  const [requisitos, setRequisitos] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editando,   setEditando]   = useState(null) // id de la tarjeta editando
  const [form,       setForm]       = useState({})
  const [guardando,  setGuardando]  = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [preview,    setPreview]    = useState(null) // id tarjeta para previsualizar

  useEffect(() => { fetchRequisitos() }, [])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchRequisitos() {
    setLoading(true)
    const { data } = await supabase.from('card_requisitos').select('*')
    setRequisitos(data || [])
    setLoading(false)
  }

  function handleEdit(req) {
    setEditando(req.id)
    setForm({
      requisito_tipo: req.requisito_tipo,
      requisito_meta: req.requisito_meta,
      descripcion:    req.descripcion,
    })
    setPreview(null)
  }

  async function handleGuardar(id) {
    setGuardando(true)
    const { error } = await supabase.from('card_requisitos').update({
      requisito_tipo: form.requisito_tipo,
      requisito_meta: parseInt(form.requisito_meta),
      descripcion:    form.descripcion,
      updated_at:     new Date().toISOString(),
    }).eq('id', id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Requisito actualizado ✓'); setEditando(null) }
    setGuardando(false)
    fetchRequisitos()
  }

  function getReq(id) {
    return requisitos.find(r => r.id === id)
  }

  function getDesign(id) {
    return CARD_DESIGNS.find(d => d.id === id)
  }

  const statsDemo = { pj: 99, golesContra: 45, promedio: 2.1, eficacia: 88, pg: 70, pe: 10, pp: 19 }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px' }}>Tarjetas de jugador</h1>
        <p style={{ color: '#5f6368', margin: 0, fontSize: '.875rem' }}>Define los requisitos para desbloquear cada tarjeta</p>
      </div>

      {/* Preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setPreview(null)}>
          <div style={{ width: '100%', maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
            <PlayerCard
              playerName="JUGADOR"
              stats={statsDemo}
              cardType={preview}
              hideShields={true}
            />
            <button onClick={() => setPreview(null)}
              style={{ display: 'block', margin: '16px auto 0', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '8px', padding: '8px 24px', cursor: 'pointer', color: '#fff', fontSize: '.85rem' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Grupos de tarjetas */}
      {GRUPOS.map(grupo => (
        <div key={grupo.label} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: grupo.color }}/>
            <span style={{ fontSize: '.9rem', fontWeight: '600', color: '#202124' }}>{grupo.label}</span>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            {grupo.ids.map((cardId, i) => {
              const design = getDesign(cardId)
              const req    = getReq(cardId)
              const esEdit = editando === cardId
              if (!design || !req) return null

              return (
                <div key={cardId} style={{ borderBottom: i < grupo.ids.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                  {/* Fila principal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}>
                    {/* Color swatch */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `linear-gradient(135deg, ${design.color}, ${design.colorSecundario || design.color})`, flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }}/>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{design.nombre}</div>
                      <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>
                        {req.requisito_meta === 0
                          ? '🟢 Disponible desde el inicio'
                          : `${TIPOS.find(t => t.value === req.requisito_tipo)?.label || req.requisito_tipo}: ${req.requisito_meta}${req.requisito_tipo === 'eficacia' ? '%' : ''}`
                        }
                      </div>
                      {req.descripcion && <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '2px' }}>{req.descripcion}</div>}
                    </div>

                    {/* Botones */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => setPreview(cardId)}
                        style={{ padding: '5px 10px', background: '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem', fontWeight: '500' }}>
                        👁 Ver
                      </button>
                      {req.requisito_meta > 0 && (
                        <button onClick={() => esEdit ? setEditando(null) : handleEdit(req)}
                          style={{ padding: '5px 10px', background: esEdit ? '#f1f3f4' : '#e8f0fe', border: 'none', borderRadius: '6px', cursor: 'pointer', color: esEdit ? '#5f6368' : '#1a73e8', fontSize: '.75rem', fontWeight: '500' }}>
                          {esEdit ? 'Cancelar' : '✏️ Editar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formulario de edición */}
                  {esEdit && (
                    <div style={{ padding: '0 16px 16px', background: '#f8f9fa', borderTop: '1px solid #f1f3f4' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px', marginTop: '12px' }}>
                        <div>
                          <label style={{ fontSize: '.72rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Tipo de requisito</label>
                          <select value={form.requisito_tipo} onChange={e => setForm(f => ({ ...f, requisito_tipo: e.target.value }))} style={inp}>
                            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '.72rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }}>
                            Meta {form.requisito_tipo === 'eficacia' ? '(%)' : ''}
                          </label>
                          <input type="number" min="1" value={form.requisito_meta} onChange={e => setForm(f => ({ ...f, requisito_meta: e.target.value }))} style={inp}/>
                        </div>
                        <div>
                          <label style={{ fontSize: '.72rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Descripción</label>
                          <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={inp} placeholder="Ej: Anota 10 goles"/>
                        </div>
                      </div>
                      <button onClick={() => handleGuardar(cardId)} disabled={guardando}
                        style={{ marginTop: '10px', padding: '7px 18px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.82rem', fontWeight: '600', opacity: guardando ? .7 : 1 }}>
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
