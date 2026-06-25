const colorMap = {
  red:    'from-red-900/40 to-red-950/20 border-red-800/50 text-red-300',
  blue:   'from-blue-900/40 to-blue-950/20 border-blue-800/50 text-blue-300',
  green:  'from-emerald-900/40 to-emerald-950/20 border-emerald-800/50 text-emerald-300',
  purple: 'from-purple-900/40 to-purple-950/20 border-purple-800/50 text-purple-300',
}

export default function MetricsCard({ titulo, valor, sub, color = 'blue', icono }) {
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{titulo}</span>
        <span className="text-xl">{icono}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{valor}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  )
}
