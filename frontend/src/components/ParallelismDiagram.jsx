/**
 * ParallelismDiagram
 * Muestra visualmente cómo MPI divide la imagen en franjas horizontales
 * y cómo OpenMP distribuye los hilos dentro de cada proceso MPI.
 */

const COLORES_MPI = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

export default function ParallelismDiagram({ mpiProcs, threads }) {
  const franjas = Array.from({ length: mpiProcs }, (_, i) => i)

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Estrategia de Paralelismo — Motor HPC
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            MPI divide la imagen en franjas · OpenMP paraleliza los píxeles de cada franja
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 bg-blue-900/40 border border-blue-700/50 rounded-lg text-xs text-blue-300 font-mono">
            {mpiProcs} proc. MPI
          </span>
          <span className="px-3 py-1.5 bg-emerald-900/40 border border-emerald-700/50 rounded-lg text-xs text-emerald-300 font-mono">
            {threads} hilos OMP/proc
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Diagrama de franjas MPI */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
            Distribución MPI — MPI_Scatterv / MPI_Gatherv
          </p>
          <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: Math.max(160, mpiProcs * 52) }}>
            {franjas.map((i) => {
              const pct = 100 / mpiProcs
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center justify-between px-4 border-b border-black/20"
                  style={{
                    top:    `${pct * i}%`,
                    height: `${pct}%`,
                    background: COLORES_MPI[i % COLORES_MPI.length] + '33',
                    borderLeft: `4px solid ${COLORES_MPI[i % COLORES_MPI.length]}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono" style={{ color: COLORES_MPI[i % COLORES_MPI.length] }}>
                      Rank {i}
                    </span>
                    <span className="text-slate-500 text-xs">
                      filas {Math.floor(i * 100/mpiProcs)}%–{Math.floor((i+1) * 100/mpiProcs)}%
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(threads, 8) }, (_, t) => (
                      <div
                        key={t}
                        className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ background: COLORES_MPI[i % COLORES_MPI.length] + 'AA' }}
                        title={`Hilo OMP ${t}`}
                      >
                        {t}
                      </div>
                    ))}
                    {threads > 8 && (
                      <div className="text-xs text-slate-500 self-center">+{threads-8}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">
            Imagen dividida en {mpiProcs} franja{mpiProcs > 1 ? 's' : ''} horizontal{mpiProcs > 1 ? 'es' : ''}
          </p>
        </div>

        {/* Pipeline de ejecución */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
            Pipeline de Ejecución
          </p>
          <div className="space-y-2">
            {[
              { paso: '1', titulo: 'Rank 0: Carga + Blur Gaussiano', desc: 'imread → cvtColor → GaussianBlur(5×5)', color: '#64748b' },
              { paso: '2', titulo: 'MPI_Scatterv', desc: `Distribuye ${mpiProcs} franjas → ${mpiProcs} procesos`, color: '#3b82f6' },
              { paso: '3', titulo: 'OpenMP reduction(+:suma)', desc: `${threads} hilos × ${mpiProcs} proc = ${threads*mpiProcs} hilos totales`, color: '#10b981' },
              { paso: '4', titulo: 'MPI_Allreduce (MPI_SUM)', desc: 'Promedio global sincronizado', color: '#3b82f6' },
              { paso: '5', titulo: 'OpenMP reduction(+:defectos)', desc: `Umbralización paralela │pixel - μ│ > ${40}`, color: '#10b981' },
              { paso: '6', titulo: 'MPI_Reduce + MPI_Gatherv', desc: 'Agrega defectos · reúne máscara', color: '#3b82f6' },
              { paso: '7', titulo: 'Rank 0: imwrite + JSON', desc: 'Escribe máscara → stdout → FastAPI parsea', color: '#64748b' },
            ].map(({ paso, titulo, desc, color }) => (
              <div key={paso} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                  style={{ background: color }}
                >
                  {paso}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{titulo}</p>
                  <p className="text-xs text-slate-500 font-mono">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badges de operaciones MPI */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
        {[
          ['MPI_Bcast', 'Dimensiones imagen'],
          ['MPI_Scatterv', 'Distribución de franjas'],
          ['MPI_Allreduce', 'Promedio global'],
          ['MPI_Reduce', 'Conteo de defectos'],
          ['MPI_Gatherv', 'Reunir máscara'],
          ['MPI_Barrier', 'Sincronización de tiempo'],
        ].map(([op, desc]) => (
          <div key={op} className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-800/40 rounded-lg px-3 py-1.5">
            <span className="text-blue-400 text-xs font-mono font-semibold">{op}</span>
            <span className="text-slate-500 text-xs">— {desc}</span>
          </div>
        ))}
        {[
          ['#pragma omp parallel for reduction(+:suma)', 'Suma paralela'],
          ['#pragma omp parallel for reduction(+:defectos)', 'Umbralización paralela'],
        ].map(([op, desc]) => (
          <div key={op} className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-1.5">
            <span className="text-emerald-400 text-xs font-mono font-semibold">{op}</span>
            <span className="text-slate-500 text-xs">— {desc}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
