import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer
} from 'recharts'

const amdahl = (n, p = 0.90) => parseFloat((1 / ((1 - p) + p / n)).toFixed(4))

const NUCLEOS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]

const DATA = NUCLEOS.map(n => ({
  n,
  combinado: amdahl(n),          // MPI × OMP juntos
  soloOmp:   amdahl(n),          // misma curva, diferente referencia de n
  soloMpi:   amdahl(n),
  limite:    10,
}))

export default function AmdahlChart({ threads, mpiProcs }) {
  const totalUnidades = (threads ?? 2) * (mpiProcs ?? 2)
  const speedupActual   = amdahl(totalUnidades)
  const speedupOmp      = amdahl(threads ?? 2)
  const speedupMpi      = amdahl(mpiProcs ?? 2)

  return (
    <section>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Ley de Amdahl — Análisis Teórico de Rendimiento
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Porción paralela <span className="text-yellow-400 font-bold">p = 90%</span> ·
              Límite asintótico: <span className="text-yellow-400 font-bold">10×</span>
            </p>
          </div>
          <div className="text-right space-y-1">
            <div>
              <div className="text-xs text-slate-500">MPI×OMP ({totalUnidades} unid.)</div>
              <div className="text-xl font-bold text-purple-400">{speedupActual}×</div>
            </div>
          </div>
        </div>

        {/* Tarjetas de speedup por modo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: `Solo OMP (${threads ?? 2} hilos)`, val: speedupOmp, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/30' },
            { label: `Solo MPI (${mpiProcs ?? 2} proc.)`, val: speedupMpi, color: 'text-blue-400',    bg: 'bg-blue-900/20 border-blue-800/30' },
            { label: `MPI×OMP (${totalUnidades} total)`, val: speedupActual, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/30' },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className={`${bg} border rounded-xl py-3 text-center`}>
              <div className={`text-xl font-bold ${color}`}>{val}×</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={DATA} margin={{ top: 5, right: 24, left: 0, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="n"
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Número de Procesadores (n)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Speedup (×)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
              domain={[0, 11]}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px' }}
              labelStyle={{ color: '#94a3b8', fontSize: 12 }}
              formatter={(v, n) => [v + '×', { combinado: 'Speedup Amdahl', limite: 'Límite teórico' }[n] ?? n]}
              labelFormatter={v => `n = ${v} procesadores`}
            />
            <Legend
              wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 12 }}
              formatter={(val) => ({ combinado: 'S(n) = 1/((1−p) + p/n)', limite: 'Límite: 1/(1−p) = 10×' }[val] ?? val)}
            />
            <ReferenceLine y={10} stroke="#eab308" strokeDasharray="4 3"
              label={{ value: '10× (límite p=0.90)', fill: '#eab308', fontSize: 10, position: 'right' }} />
            <ReferenceLine x={totalUnidades} stroke="#a855f7" strokeDasharray="3 3"
              label={{ value: `n=${totalUnidades}`, fill: '#a855f7', fontSize: 10 }} />
            <Line
              type="monotone" dataKey="combinado" stroke="#3b82f6"
              strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 6 }}
              name="combinado"
            />
            <Line
              type="monotone" dataKey="limite" stroke="#eab308"
              strokeWidth={1} strokeDasharray="5 3" dot={false}
              name="limite"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Tabla de referencia */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">
            Tabla de Speedup Teórico — S(n) con p = 0.90
          </p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[1,2,4,6,8,16,32,64].map(n => (
              <div key={n} className={`text-center py-2 rounded-lg ${n === totalUnidades ? 'bg-purple-900/40 border border-purple-700/50' : 'bg-slate-800/50'}`}>
                <div className="text-xs text-slate-500">n={n}</div>
                <div className={`text-sm font-bold ${n === totalUnidades ? 'text-purple-300' : 'text-slate-300'}`}>
                  {amdahl(n)}×
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
