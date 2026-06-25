"""
motor_python.py
---------------
Motor de detección de defectos textiles en Python puro.
Replica EXACTAMENTE el algoritmo del motor C++ (textil_hibrido.cpp) usando:

  · multiprocessing.Pool  → simula procesos MPI (MPI_Scatterv / MPI_Gatherv)
  · ThreadPoolExecutor    → simula hilos OpenMP dentro de cada proceso
  · OpenCV                → mismas operaciones: cvtColor, GaussianBlur, threshold

Algoritmo (igual que C++):
  1. Cargar imagen y convertir a escala de grises.
  2. Aplicar Filtro Gaussiano 5×5.
  3. Dividir la imagen en N franjas horizontales (una por "proceso MPI").
  4. Cada franja calcula su suma local en paralelo (ThreadPool = "OpenMP").
  5. Sumar todas las sumas locales → promedio global (simula MPI_Allreduce).
  6. Cada franja umbraliza sus píxeles en paralelo (ThreadPool).
  7. Reunir todas las franjas → máscara completa (simula MPI_Gatherv).
  8. Retornar métricas en el mismo formato JSON que el motor C++.

Uso:
  from motor_python import analizar_imagen
  metricas = analizar_imagen("entrada.jpg", "mascara.jpg", mpi_procs=2, omp_threads=4)
"""

import cv2
import numpy as np
import time
import math
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Pool, cpu_count

# Umbral idéntico al motor C++
UMBRAL = 40


# ─────────────────────────────────────────────────────────────────────────────
# _suma_franja_threaded
# ─────────────────────────────────────────────────────────────────────────────
def _suma_franja_threaded(args):
    """
    Calcula la suma de intensidades de una franja usando ThreadPoolExecutor
    (simula la reducción OpenMP: #pragma omp parallel for reduction(+:suma)).

    Divide la franja en bloques de filas, uno por hilo, y suma en paralelo.

    Parámetros:
        args (tuple): (franja_np, n_threads)
            · franja_np  — Array numpy 2D con los píxeles de la franja.
            · n_threads  — Número de hilos a usar (simula omp_get_max_threads).

    Retorna:
        float: Suma total de intensidades de la franja.
    """
    franja, n_threads = args

    filas = franja.shape[0]
    # Dividir filas entre hilos
    bloques = np.array_split(franja, min(n_threads, filas), axis=0)

    def suma_bloque(bloque):
        return float(np.sum(bloque))

    with ThreadPoolExecutor(max_workers=n_threads) as executor:
        sumas = list(executor.map(suma_bloque, bloques))

    return sum(sumas)


# ─────────────────────────────────────────────────────────────────────────────
# _umbralizar_franja_threaded
# ─────────────────────────────────────────────────────────────────────────────
def _umbralizar_franja_threaded(args):
    """
    Aplica umbralización binaria sobre una franja usando ThreadPoolExecutor
    (simula: #pragma omp parallel for reduction(+:defectos)).

    Un píxel se marca como defecto (255) si |intensidad - promedio| > UMBRAL.

    Parámetros:
        args (tuple): (franja_np, promedio_global, n_threads)
            · franja_np       — Array numpy 2D de la franja (escala de grises).
            · promedio_global — Media calculada sobre toda la imagen.
            · n_threads       — Hilos a usar por proceso.

    Retorna:
        tuple: (mascara_franja, conteo_defectos)
            · mascara_franja   — Array numpy 2D con la máscara binaria.
            · conteo_defectos  — Número de píxeles anómalos en esta franja.
    """
    franja, promedio_global, n_threads = args

    filas = franja.shape[0]
    bloques_in = np.array_split(franja, min(n_threads, filas), axis=0)

    def umbralizar_bloque(bloque):
        diff   = np.abs(bloque.astype(np.int32) - int(promedio_global))
        mascara = (diff > UMBRAL).astype(np.uint8) * 255
        return mascara, int(np.sum(mascara > 0))

    with ThreadPoolExecutor(max_workers=n_threads) as executor:
        resultados = list(executor.map(umbralizar_bloque, bloques_in))

    mascaras  = [r[0] for r in resultados]
    defectos  = sum(r[1] for r in resultados)
    return np.vstack(mascaras), defectos


# ─────────────────────────────────────────────────────────────────────────────
# _calcular_speedup_amdahl
# ─────────────────────────────────────────────────────────────────────────────
def _calcular_speedup_amdahl(n: int, p: float = 0.90) -> float:
    """
    Calcula el speedup teórico según la Ley de Amdahl.

    Fórmula: S(n) = 1 / ((1 - p) + p/n)
      · p = fracción paralela del código (0.90 = 90%)
      · n = número de unidades de procesamiento

    Parámetros:
        n (int):   Número de procesadores o hilos.
        p (float): Fracción paralela (default 0.90).

    Retorna:
        float: Speedup teórico máximo con n unidades.
    """
    if n <= 0:
        return 1.0
    return 1.0 / ((1.0 - p) + (p / n))


# ─────────────────────────────────────────────────────────────────────────────
# analizar_imagen
# ─────────────────────────────────────────────────────────────────────────────
def analizar_imagen(
    ruta_entrada: str,
    ruta_salida:  str,
    mpi_procs:    int = 2,
    omp_threads:  int = None,
) -> dict:
    """
    Pipeline completo de detección de defectos textiles en Python.

    Replica el comportamiento del motor C++ híbrido con la misma estructura
    de paralelismo: N procesos (multiprocessing.Pool) × M hilos (ThreadPoolExecutor).

    Etapas del pipeline:
      1. Carga imagen y aplica preprocesamiento (grises + Gaussian Blur 5×5).
      2. Divide la imagen en mpi_procs franjas horizontales.
      3. Pool.map → cada proceso calcula su suma local (ThreadPoolExecutor interno).
      4. Reduce sumas → promedio global (simula MPI_Allreduce).
      5. Pool.map → cada proceso umbraliza su franja (ThreadPoolExecutor interno).
      6. Agrega defectos y reconstruye la máscara completa (simula MPI_Gatherv).
      7. Guarda la máscara y retorna métricas JSON.

    Parámetros:
        ruta_entrada (str): Ruta de la imagen de entrada (JPG o PNG).
        ruta_salida  (str): Ruta donde se guardará la máscara de defectos.
        mpi_procs    (int): Número de "procesos MPI" (Pool workers). Default: 2.
        omp_threads  (int): Hilos por proceso ("OpenMP"). Default: cpu_count().

    Retorna:
        dict: Métricas en el mismo formato JSON que el motor C++:
            {
                "tiempo_ms":            float,   # tiempo total del pipeline
                "pixeles_anomalos":     int,     # píxeles con defecto
                "intensidad_promedio":  float,   # media global de intensidad
                "total_pixeles":        int,     # filas × cols
                "threads_omp":          int,     # hilos por proceso
                "procesos_mpi":         int,     # procesos usados
                "speedup_amdahl":       float,   # speedup MPI×OMP (Ley de Amdahl)
                "speedup_solo_omp":     float,   # speedup solo OMP
                "speedup_solo_mpi":     float,   # speedup solo MPI
                "filas_total":          int,
                "cols":                 int,
            }

    Lanza:
        ValueError: Si la imagen no puede cargarse.
        RuntimeError: Si ocurre un error durante el procesamiento.
    """
    if omp_threads is None:
        omp_threads = max(1, cpu_count())

    # Clamp para no crear más procesos de los que tiene sentido
    mpi_procs   = max(1, min(mpi_procs, 8))
    omp_threads = max(1, min(omp_threads, 16))

    t_inicio = time.perf_counter()

    # ── 1. Cargar y preprocesar imagen ────────────────────────────────────────
    img_color = cv2.imread(ruta_entrada, cv2.IMREAD_COLOR)
    if img_color is None:
        raise ValueError(f"No se pudo cargar la imagen: '{ruta_entrada}'")

    img_gris = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)
    img_blur = cv2.GaussianBlur(img_gris, (5, 5), 0)

    filas_total, cols = img_blur.shape
    total_pixeles     = filas_total * cols

    # ── 2. Dividir imagen en franjas (simula MPI_Scatterv) ───────────────────
    # np.array_split distribuye las filas sobrantes entre las primeras franjas,
    # igual que el C++: filas_base + (i < sobrantes ? 1 : 0)
    franjas = np.array_split(img_blur, mpi_procs, axis=0)

    # ── 3. Calcular suma local por franja (Pool = MPI, ThreadPool = OpenMP) ──
    args_suma = [(f, omp_threads) for f in franjas]

    if mpi_procs > 1:
        with Pool(processes=mpi_procs) as pool:
            sumas_locales = pool.map(_suma_franja_threaded, args_suma)
    else:
        sumas_locales = [_suma_franja_threaded(a) for a in args_suma]

    # ── 4. Reducir → promedio global (simula MPI_Allreduce) ──────────────────
    suma_global      = sum(sumas_locales)
    promedio_global  = suma_global / total_pixeles

    # ── 5. Umbralizar cada franja en paralelo (Pool + ThreadPool) ────────────
    args_umbral = [(f, promedio_global, omp_threads) for f in franjas]

    if mpi_procs > 1:
        with Pool(processes=mpi_procs) as pool:
            resultados = pool.map(_umbralizar_franja_threaded, args_umbral)
    else:
        resultados = [_umbralizar_franja_threaded(a) for a in args_umbral]

    # ── 6. Reunir franjas de máscara (simula MPI_Gatherv) ────────────────────
    mascaras_franjas  = [r[0] for r in resultados]
    defectos_por_proc = [r[1] for r in resultados]

    mascara_completa  = np.vstack(mascaras_franjas)
    defectos_total    = sum(defectos_por_proc)

    # ── 7. Guardar máscara en disco ───────────────────────────────────────────
    cv2.imwrite(ruta_salida, mascara_completa)

    t_fin     = time.perf_counter()
    tiempo_ms = (t_fin - t_inicio) * 1000.0

    # ── 8. Calcular speedups teóricos (Ley de Amdahl, p=0.90) ────────────────
    unidades_total = mpi_procs * omp_threads
    speedup_combinado = _calcular_speedup_amdahl(unidades_total)
    speedup_omp       = _calcular_speedup_amdahl(omp_threads)
    speedup_mpi       = _calcular_speedup_amdahl(mpi_procs)

    return {
        "tiempo_ms":            round(tiempo_ms, 3),
        "pixeles_anomalos":     defectos_total,
        "intensidad_promedio":  round(float(promedio_global), 4),
        "total_pixeles":        total_pixeles,
        "threads_omp":          omp_threads,
        "procesos_mpi":         mpi_procs,
        "speedup_amdahl":       round(speedup_combinado, 4),
        "speedup_solo_omp":     round(speedup_omp, 4),
        "speedup_solo_mpi":     round(speedup_mpi, 4),
        "filas_total":          filas_total,
        "cols":                 cols,
    }
