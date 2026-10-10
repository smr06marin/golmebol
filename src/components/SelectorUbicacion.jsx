import { useState } from 'react'
import { PAISES, DEPARTAMENTOS_CO, municipiosDeDepartamento, municipioPorCodigo, departamentoPorCodigo } from '../lib/ubicaciones'

// Selector en cascada: País → Departamento → Municipio (+ vereda/corregimiento/barrio opcional).
// Para Colombia se escoge de la lista oficial (código DANE); para otro país se escribe
// el estado/provincia y la ciudad. No guarda nada solo: avisa los cambios con onChange.
//
// value:    { pais, departamento, municipio_codigo, city, vereda }
// onChange: recibe SOLO los campos que cambiaron (se mezclan con el formulario del padre).
// inferida: true si el valor se adivinó de un texto viejo (muestra un aviso "verifícalo").
export default function SelectorUbicacion({ value = {}, onChange, inputStyle, labelStyle, columnas = '1fr 1fr 1fr', inferida = false }) {
  const pais = String(value.pais || 'CO').toUpperCase()
  const munSel = value.municipio_codigo ? municipioPorCodigo(value.municipio_codigo) : null
  // Departamento elegido: el del municipio si ya hay uno, si no el que se escogió en pantalla.
  const [depLocal, setDepLocal] = useState(() => munSel?.depCodigo || '')
  const depCodigo = munSel?.depCodigo || depLocal
  const municipios = depCodigo ? municipiosDeDepartamento(depCodigo) : []

  function cambiarPais(p) {
    setDepLocal('')
    onChange({ pais: p, departamento: '', municipio_codigo: '', city: '' })
  }
  function cambiarDepartamento(codigo) {
    setDepLocal(codigo)
    onChange({ pais: 'CO', departamento: departamentoPorCodigo(codigo)?.nombre || '', municipio_codigo: '', city: '' })
  }
  function cambiarMunicipio(codigo) {
    const m = municipioPorCodigo(codigo)
    onChange({ pais: 'CO', departamento: m?.depNombre || '', municipio_codigo: codigo, city: m?.nombre || '' })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: columnas, gap: '16px' }}>
        <div>
          <label style={labelStyle}>País *</label>
          <select value={pais} onChange={e => cambiarPais(e.target.value)} style={inputStyle}>
            {PAISES.map(([cod, nom]) => <option key={cod} value={cod}>{nom}</option>)}
          </select>
        </div>
        {pais === 'CO' ? (
          <>
            <div>
              <label style={labelStyle}>Departamento *</label>
              <select value={depCodigo} onChange={e => cambiarDepartamento(e.target.value)} style={inputStyle}>
                <option value="">Selecciona…</option>
                {DEPARTAMENTOS_CO.map(([cod, nom]) => <option key={cod} value={cod}>{nom}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ciudad o municipio *</label>
              <select value={value.municipio_codigo || ''} onChange={e => cambiarMunicipio(e.target.value)} disabled={!depCodigo} style={{ ...inputStyle, opacity: depCodigo ? 1 : .6 }}>
                <option value="">{depCodigo ? 'Selecciona…' : 'Primero elige el departamento'}</option>
                {municipios.map(m => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Estado / provincia</label>
              <input value={value.departamento || ''} onChange={e => onChange({ departamento: e.target.value })} style={inputStyle} placeholder="Estado o provincia"/>
            </div>
            <div>
              <label style={labelStyle}>Ciudad *</label>
              <input value={value.city || ''} onChange={e => onChange({ city: e.target.value })} style={inputStyle} placeholder="Ciudad"/>
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: '12px' }}>
        <label style={labelStyle}>Vereda, corregimiento o barrio (opcional)</label>
        <input value={value.vereda || ''} onChange={e => onChange({ vereda: e.target.value })} style={inputStyle} placeholder="Ej: Vereda La Julia, barrio Los Fundadores…"/>
      </div>
      {inferida && (
        <div style={{ marginTop: '8px', fontSize: '.72rem', color: '#b06000', background: '#fef7e0', border: '1px solid #fde293', borderRadius: '8px', padding: '7px 10px' }}>
          Detectamos esta ubicación a partir de lo que se había escrito antes. Verifica que sea la correcta y guarda el torneo.
        </div>
      )}
    </div>
  )
}
