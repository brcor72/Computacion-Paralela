import { useEffect, useState } from 'react'
import axios from 'axios'

const API = ''

export default function History() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    axios.get(`${API}/api/history`)
      .then(r => setRegistros(r.data))
      .catch(() => setError('No se pudo cargar el historial. ¿Está el servidor activo?'))
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Cargando historial...
    </div>
  )

  if (error) return (
    <div className="text-center py-24 text-red-400">{error}</div>
  )

  if (registros.length === 0) return (
    <div className="text-center py-24 text-slate-500">
      <div className="text-5xl mb-4">📂</div>
      <p>Sin análisis registrados aún.</p>
      <p className="text-sm mt-2">Sube una imagen desde el Dashboard para comenzar.</p>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">
        Historial de Análisis
        <span className="ml-3 text-sm font-normal text-slate-400">({registros.length} registros)</span>
      </h2>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              {['ID','Archivo','Píxeles Anómalos','Intensidad Media','Tiempo (ms)','Speedup','Hilos OMP','Proc. MPI','Fecha','Máscara'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.map((r, i) => (
              <tr key={r.id}
                className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/40 ${
                  i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10'
                }`}
              >
                <td className="px-4 py-3 text-slate-400">{r.id}</td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs max-w-[160px] truncate" title={r.filename}>
                  {r.filename}
                </td>
                <td className="px-4 py-3 text-red-400 font-medium">
                  {r.anomalous_pixels?.toLocaleString() ?? '—'}
                </td>
                <td className="px-4 py-3 text-blue-400">
                  {r.average_intensity != null ? r.average_intensity.toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3 text-green-400">
                  {r.processing_time != null ? r.processing_time.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-3 text-purple-400">
                  {r.speedup_estimate != null ? r.speedup_estimate.toFixed(2) + '×' : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400 text-center">{r.threads_omp ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-center">{r.processes_mpi ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(r.timestamp).toLocaleString('es-PE')}
                </td>
                <td className="px-4 py-3">
                  {r.mask_url
                    ? <a href={`${API}${r.mask_url}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors">
                        🖼️ Ver
                      </a>
                    : <span className="text-slate-700 text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
