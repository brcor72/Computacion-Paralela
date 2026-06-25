export default function ImageComparison({ imagenOriginal, mascaraUrl }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-4">
        Comparación: Original vs Máscara de Defectos
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Imagen original */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="text-sm font-medium text-slate-300">Imagen Original</span>
          </div>
          <div className="p-4">
            {imagenOriginal
              ? <img src={imagenOriginal} alt="Original" className="w-full h-64 object-contain rounded-lg" />
              : <div className="h-64 flex items-center justify-center text-slate-600">Sin imagen</div>
            }
          </div>
        </div>

        {/* Máscara de defectos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span className="text-sm font-medium text-slate-300">Máscara de Defectos</span>
            <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              Umbral absoluto = 40
            </span>
          </div>
          <div className="p-4">
            {mascaraUrl
              ? <img src={mascaraUrl} alt="Máscara de defectos" className="w-full h-64 object-contain rounded-lg" />
              : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-2">
                  <span className="text-4xl">🔍</span>
                  <span className="text-sm">Máscara no disponible</span>
                  <span className="text-xs text-slate-700">(requiere motor HPC compilado)</span>
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white"></div>
          <span>Píxel anómalo (defecto detectado)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-900 border border-slate-700"></div>
          <span>Píxel normal</span>
        </div>
      </div>
    </section>
  )
}
