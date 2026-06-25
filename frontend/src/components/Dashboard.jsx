import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import MetricsCard from './MetricsCard.jsx'
import ImageComparison from './ImageComparison.jsx'
import AmdahlChart from './AmdahlChart.jsx'
import ParallelismDiagram from './ParallelismDiagram.jsx'
import BatchGrid from './BatchGrid.jsx'

const API = ''

export default function Dashboard({ onAnalysisDone }) {
  const [mpiProcs, setMpiProcs]     = useState(2)
  const [lote, setLote]             = useState([])        // array de {file, preview, estado, resultado}
  const [procesando, setProcesando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)  // índice de imagen seleccionada para ver detalle

  // ── Drag & Drop: acepta múltiples archivos ──────────────────────────────
  const onDrop = useCallback((archivos) => {
    if (procesando) return
    const nuevos = archivos.map(f => ({
      file:      f,
      preview:   URL.createObjectURL(f),
      estado:    'pendiente',   // pendiente | subiendo | analizando | done | error
      resultado: null,
      error:     '',
    }))
    setLote(prev => [...prev, ...nuevos])
    setSeleccionado(null)
  }, [procesando])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'] },
    disabled: procesando,
    multiple: true,
  })

  // ── Procesar todo el lote secuencialmente ────────────────────────────────
  const procesarLote = useCallback(async () => {
    if (procesando || lote.length === 0) return
    setProcesando(true)
    setSeleccionado(null)

    for (let i = 0; i < lote.length; i++) {
      if (lote[i].estado === 'done') continue   // saltar las ya procesadas

      // Marcar como "subiendo"
      setLote(prev => prev.map((item, idx) =>
        idx === i ? { ...item, estado: 'subiendo' } : item
      ))

      try {
        // 1. Upload
        const form = new FormData()
        form.append('file', lote[i].file)
        const { data: upload } = await axios.post(`${API}/api/upload`, form)

        // Marcar como "analizando"
        setLote(prev => prev.map((item, idx) =>
          idx === i ? { ...item, estado: 'analizando' } : item
        ))

        // 2. Analizar
        const { data: resultado } = await axios.post(
          `${API}/api/analyze/${upload.image_id}?mpi_processes=${mpiProcs}`
        )

        setLote(prev => prev.map((item, idx) =>
          idx === i ? { ...item, estado: 'done', resultado } : item
        ))
        onAnalysisDone()

      } catch (err) {
        const msg = err.response?.data?.detail || 'Error de conexión'
        setLote(prev => prev.map((item, idx) =>
          idx === i ? { ...item, estado: 'error', error: msg } : item
        ))
      }
    }

    setProcesando(false)
  }, [lote, procesando, mpiProcs, onAnalysisDone])

  const limpiarLote = () => {
    if (procesando) return
    setLote([])
    setSeleccionado(null)
  }

  const quitarImagen = (idx) => {
    if (procesando) return
    setLote(prev => prev.filter((_, i) => i !== idx))
    if (seleccionado === idx) setSeleccionado(null)
  }

  const pendientes  = lote.filter(i => i.estado === 'pendiente').length
  const completadas = lote.filter(i => i.estado === 'done').length
  const errores     = lote.filter(i => i.estado === 'error').length
  const enCurso     = lote.filter(i => i.estado === 'subiendo' || i.estado === 'analizando').length

  const itemSeleccionado = seleccionado !== null ? lote[seleccionado] : null

  return (
    <div className="space-y-6">

      {/* ── Cabecera de controles ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Análisis de Imágenes Textiles</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Arrastra múltiples imágenes · El motor las procesará en lote
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Procesos MPI:</label>
          <select
            value={mpiProcs}
            onChange={e => setMpiProcs(Number(e.target.value))}
            disabled={procesando}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {[1,2,3,4].map(n => (
              <option key={n} value={n}>{n} proceso{n>1?'s':''} MPI</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Zona Drag & Drop ─────────────────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-950/30 scale-[1.01]'
            : procesando
            ? 'border-slate-700 bg-slate-900/20 cursor-not-allowed opacity-50'
            : 'border-slate-700 bg-slate-900/40 hover:border-blue-500/50 hover:bg-slate-900/70'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">{isDragActive ? '📂' : '🖼️'}</div>
          <div>
            <p className="text-base font-medium text-slate-200">
              {isDragActive
                ? 'Suelta aquí todas las imágenes'
                : 'Arrastra imágenes aquí o haz clic para seleccionar'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Puedes seleccionar <span className="text-blue-400 font-medium">múltiples archivos</span> a la vez · JPG · PNG
            </p>
          </div>
          {lote.length === 0 && !procesando && (
            <div className="flex gap-6 mt-2 text-xs text-slate-600">
              <span>✓ Sin límite de archivos</span>
              <span>✓ Se procesan en secuencia</span>
              <span>✓ Resultados en tiempo real</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel del lote ───────────────────────────────────────────── */}
      {lote.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

          {/* Barra de estado del lote */}
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-300 font-medium">{lote.length} imagen{lote.length > 1 ? 'es' : ''}</span>
              {pendientes  > 0 && <span className="text-slate-500">{pendientes} pendiente{pendientes>1?'s':''}</span>}
              {enCurso     > 0 && <span className="text-yellow-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block"/> Procesando {enCurso}</span>}
              {completadas > 0 && <span className="text-green-400">✓ {completadas} completada{completadas>1?'s':''}</span>}
              {errores     > 0 && <span className="text-red-400">✗ {errores} con error</span>}
            </div>

            {/* Barra de progreso */}
            {procesando && (
              <div className="flex-1 min-w-[120px] max-w-[200px]">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(completadas / lote.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {!procesando && pendientes > 0 && (
                <button
                  onClick={procesarLote}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  ▶ Analizar {pendientes > 0 ? `${pendientes} imagen${pendientes > 1 ? 'es' : ''}` : 'todo'}
                </button>
              )}
              {procesando && (
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                  <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"/>
                  Procesando...
                </div>
              )}
              {!procesando && (
                <button
                  onClick={limpiarLote}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Grid de miniaturas */}
          <BatchGrid
            lote={lote}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
            onQuitar={quitarImagen}
            procesando={procesando}
          />
        </div>
      )}

      {/* ── Detalle de imagen seleccionada ───────────────────────────── */}
      {itemSeleccionado?.estado === 'done' && itemSeleccionado.resultado && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">
              Detalle — {itemSeleccionado.file.name}
            </h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
              imagen {seleccionado + 1} de {lote.length}
            </span>
            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => setSeleccionado(Math.max(0, seleccionado - 1))}
                disabled={seleccionado === 0}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← Ant</button>
              <button
                onClick={() => setSeleccionado(Math.min(lote.length - 1, seleccionado + 1))}
                disabled={seleccionado === lote.length - 1}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Sig →</button>
            </div>
          </div>

          {/* Diagrama de paralelismo */}
          <ParallelismDiagram
            mpiProcs={itemSeleccionado.resultado.processes_mpi ?? mpiProcs}
            threads={itemSeleccionado.resultado.threads_omp ?? 2}
          />

          {/* Métricas */}
          <div>
            <h3 className="text-base font-semibold text-white mb-3">Métricas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricsCard titulo="Píxeles Anómalos"
                valor={itemSeleccionado.resultado.anomalous_pixels?.toLocaleString() ?? '—'}
                sub={itemSeleccionado.resultado.total_pixels
                  ? `${((itemSeleccionado.resultado.anomalous_pixels / itemSeleccionado.resultado.total_pixels)*100).toFixed(2)}% del total`
                  : ''} color="red" icono="🔴"/>
              <MetricsCard titulo="Intensidad Media"
                valor={itemSeleccionado.resultado.average_intensity?.toFixed(2) ?? '—'}
                sub="MPI_Allreduce" color="blue" icono="🎛️"/>
              <MetricsCard titulo="Tiempo (ms)"
                valor={itemSeleccionado.resultado.processing_time?.toFixed(1) ?? '—'}
                sub={`${itemSeleccionado.resultado.processes_mpi ?? '?'} MPI · ${itemSeleccionado.resultado.threads_omp ?? '?'} OMP`}
                color="green" icono="⏱️"/>
              <MetricsCard titulo="Speedup MPI×OMP"
                valor={itemSeleccionado.resultado.speedup_estimate != null
                  ? `${itemSeleccionado.resultado.speedup_estimate.toFixed(3)}×` : '—'}
                sub="Ley de Amdahl · p=0.90" color="purple" icono="🚀"/>
            </div>
          </div>

          {/* Comparación original vs máscara */}
          <ImageComparison
            imagenOriginal={itemSeleccionado.preview}
            mascaraUrl={itemSeleccionado.resultado.mask_url
              ? `${API}${itemSeleccionado.resultado.mask_url}` : null}
          />

          {/* Gráfico Amdahl */}
          <AmdahlChart
            threads={itemSeleccionado.resultado.threads_omp ?? 2}
            mpiProcs={itemSeleccionado.resultado.processes_mpi ?? mpiProcs}
          />
        </div>
      )}

      {/* Placeholder cuando ninguna imagen está seleccionada pero hay completadas */}
      {seleccionado === null && completadas > 0 && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-3">👆</div>
          <p className="text-sm">Haz clic en una imagen procesada para ver el detalle</p>
        </div>
      )}
    </div>
  )
}
