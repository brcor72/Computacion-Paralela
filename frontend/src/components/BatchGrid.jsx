/**
 * BatchGrid
 * Muestra una cuadrícula de miniaturas del lote de imágenes.
 * Cada tarjeta muestra el estado de la imagen (pendiente / procesando / done / error)
 * y al hacer clic en las completadas muestra el detalle en el Dashboard.
 */

const ESTADO_CONFIG = {
  pendiente:   { bg: 'border-slate-700',       badge: 'bg-slate-700 text-slate-400',     texto: 'Pendiente' },
  subiendo:    { bg: 'border-yellow-600/50',    badge: 'bg-yellow-900/60 text-yellow-400', texto: 'Subiendo...' },
  analizando:  { bg: 'border-blue-600/60',      badge: 'bg-blue-900/60 text-blue-400',    texto: 'Analizando...' },
  done:        { bg: 'border-green-600/50',     badge: 'bg-green-900/50 text-green-400',  texto: 'Completado' },
  error:       { bg: 'border-red-600/50',       badge: 'bg-red-900/50 text-red-400',      texto: 'Error' },
}

export default function BatchGrid({ lote, seleccionado, onSeleccionar, onQuitar, procesando }) {
  if (lote.length === 0) return null

  return (
    <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto">
      {lote.map((item, idx) => {
        const cfg      = ESTADO_CONFIG[item.estado] ?? ESTADO_CONFIG.pendiente
        const activo   = seleccionado === idx
        const clickable = item.estado === 'done'

        return (
          <div
            key={idx}
            onClick={() => clickable && onSeleccionar(activo ? null : idx)}
            className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-150 ${cfg.bg} ${
              activo ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900' : ''
            } ${clickable ? 'cursor-pointer hover:scale-105 hover:border-green-500/70' : 'cursor-default'}`}
          >
            {/* Miniatura */}
            <div className="aspect-square bg-slate-800">
              <img
                src={item.preview}
                alt={item.file.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Overlay de estado */}
            <div className="absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none">

              {/* Badge de estado (arriba) */}
              <div className={`self-start text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.badge} leading-tight`}>
                {(item.estado === 'subiendo' || item.estado === 'analizando')
                  ? <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block"/>
                      {cfg.texto}
                    </span>
                  : cfg.texto
                }
              </div>

              {/* Botón quitar (arriba derecha) — solo si no está procesando */}
              {!procesando && item.estado !== 'analizando' && item.estado !== 'subiendo' && (
                <button
                  onClick={e => { e.stopPropagation(); onQuitar(idx) }}
                  className="absolute top-1 right-1 pointer-events-auto w-5 h-5 rounded-full bg-slate-900/80 hover:bg-red-900/80 text-slate-400 hover:text-red-300 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Quitar imagen"
                >✕</button>
              )}

              {/* Métrica rápida (abajo) — solo para completadas */}
              {item.estado === 'done' && item.resultado && (
                <div className="bg-black/60 rounded-md px-1.5 py-1 text-[9px] leading-tight">
                  <div className="text-red-400 font-semibold">
                    {item.resultado.anomalous_pixels != null
                      ? `${((item.resultado.anomalous_pixels / item.resultado.total_pixels) * 100).toFixed(1)}% def.`
                      : '—'}
                  </div>
                  <div className="text-slate-400">
                    {item.resultado.processing_time?.toFixed(0)} ms
                  </div>
                </div>
              )}

              {/* Error (abajo) */}
              {item.estado === 'error' && (
                <div className="bg-red-950/80 rounded-md px-1.5 py-1 text-[9px] text-red-300 leading-tight line-clamp-2">
                  {item.error}
                </div>
              )}
            </div>

            {/* Spinner de carga */}
            {(item.estado === 'subiendo' || item.estado === 'analizando') && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
