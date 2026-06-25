import { useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import History from './components/History.jsx'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [historyKey, setHistoryKey] = useState(0)

  const onAnalysisDone = () => setHistoryKey(k => k + 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧵</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Sistema de Detección de Defectos Textiles
              </h1>
              <p className="text-xs text-slate-400">
                Motor HPC • OpenMP + MPI + OpenCV • USIL
              </p>
            </div>
          </div>
          <nav className="flex gap-1">
            {[['dashboard','Análisis'], ['history','Historial']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'dashboard'
          ? <Dashboard onAnalysisDone={onAnalysisDone} />
          : <History key={historyKey} />
        }
      </main>
    </div>
  )
}
