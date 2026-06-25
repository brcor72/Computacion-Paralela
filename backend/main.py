"""
main.py
-------
Orquestador FastAPI para el sistema de detección de defectos textiles.

Arquitectura de paralelismo soportada:
  - El motor C++ (textil_hibrido) implementa dos niveles de paralelismo:
      · MPI: divide la imagen en franjas horizontales entre N procesos.
        Cada proceso trabaja sobre sus filas de forma totalmente independiente.
        Se usa MPI_Scatterv (distribución), MPI_Allreduce (promedio global)
        y MPI_Gatherv (reunir máscara).
      · OpenMP: dentro de cada proceso MPI, los píxeles de la franja
        asignada se procesan en paralelo por múltiples hilos.
        Se usan directivas reduction para la suma y la umbralización.

  FastAPI actúa como orquestador: lanza el binario con mpirun via subprocess,
  captura el JSON de stdout y persiste las métricas en SQLite.

Endpoints:
  POST /api/upload              → Recibe y guarda la imagen
  POST /api/analyze/{image_id}  → Lanza el motor HPC y persiste métricas
  GET  /api/history             → Historial de análisis de la BD
  GET  /api/speedup-stats       → Estadísticas agregadas de rendimiento
  GET  /api/health              → Estado del servicio y disponibilidad del binario
"""

import os
import json
import subprocess
import shutil
from multiprocessing import cpu_count
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, get_db, Base
from models import Analysis, AnalysisResponse, UploadResponse, SpeedupStatsResponse
from motor_python import analizar_imagen as motor_python_analizar

# ─── Inicialización de la aplicación ────────────────────────────────────────

# Crea las tablas ORM en SQLite si aún no existen (idempotente).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Detección de Defectos Textiles — HPC",
    description=(
        "API REST que orquesta el motor C++ híbrido (MPI + OpenMP + OpenCV) "
        "para detección paralela de defectos en prendas textiles."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Permite peticiones cruzadas desde el frontend React (localhost:5173 en dev,
# o cualquier origen en producción Docker).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Directorios y rutas críticas ────────────────────────────────────────────

# Donde se almacenan las imágenes originales subidas por el usuario.
UPLOAD_DIR = Path("uploads")

# Donde se almacenan las máscaras de defectos generadas por el motor HPC.
MASKS_DIR = Path("masks")

# Ruta al binario compilado del motor HPC (compilado por build.sh en hpc_core/).
HPC_BINARY = Path("../hpc_core/textil_hibrido")

UPLOAD_DIR.mkdir(exist_ok=True)
MASKS_DIR.mkdir(exist_ok=True)

# Servir imágenes y máscaras como archivos estáticos accesibles por el frontend.
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/masks",   StaticFiles(directory=str(MASKS_DIR)),  name="masks")


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/upload
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/upload",
    response_model=UploadResponse,
    tags=["Análisis"],
    summary="Subir imagen textil",
    description="Recibe una imagen JPG/PNG, la guarda en disco y crea un registro pendiente en la BD.",
)
async def upload_image(
    file: UploadFile = File(...),
    db:   Session    = Depends(get_db),
):
    """
    Recibe una imagen textil del cliente vía multipart/form-data y la persiste.

    Flujo interno:
      1. Valida que la extensión del archivo sea .jpg, .jpeg o .png.
      2. Genera un nombre único basado en timestamp UTC para evitar colisiones.
      3. Guarda el archivo en UPLOAD_DIR usando shutil.copyfileobj (streaming).
      4. Crea un registro inicial en la BD con estado 'pendiente' (sin métricas).
         Las métricas se completan cuando el cliente llama a /api/analyze/{id}.
      5. Retorna el image_id para que el cliente pueda iniciar el análisis.

    Parámetros:
        file (UploadFile): Imagen recibida como parte del body multipart.
                           Soporta: image/jpeg, image/png.
        db   (Session):    Sesión de SQLite inyectada por FastAPI (Depends).

    Retorna:
        UploadResponse: { image_id, filename, message }
            · image_id — ID asignado en la BD, necesario para /api/analyze/{id}.
            · filename — Nombre único con el que se guardó el archivo.
            · message  — Confirmación legible.

    Lanza:
        HTTPException 400 — Si la extensión no es .jpg, .jpeg o .png.
        HTTPException 500 — Si ocurre un error al escribir el archivo en disco.
    """
    # ── Validar formato del archivo ──────────────────────────────────────────
    extension = Path(file.filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Formato no soportado: '{extension}'. "
                "Solo se aceptan imágenes JPG o PNG."
            ),
        )

    # ── Generar nombre único para evitar colisiones ──────────────────────────
    # Formato: YYYYMMDD_HHMMSS_microsegundos + extension original
    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    safe_filename = f"{timestamp_str}{extension}"
    ruta_destino  = UPLOAD_DIR / safe_filename

    # ── Guardar archivo en disco ─────────────────────────────────────────────
    try:
        with ruta_destino.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar el archivo en disco: {e}",
        )

    # ── Crear registro en BD (estado pendiente, sin métricas aún) ───────────
    registro = Analysis(filename=safe_filename)
    db.add(registro)
    db.commit()
    db.refresh(registro)

    return UploadResponse(
        image_id=registro.id,
        filename=safe_filename,
        message=(
            f"Imagen '{file.filename}' recibida correctamente. "
            f"ID asignado: {registro.id}. "
            f"Llama a POST /api/analyze/{registro.id} para iniciar el análisis HPC."
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/analyze/{image_id}
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/analyze/{image_id}",
    response_model=AnalysisResponse,
    tags=["Análisis"],
    summary="Ejecutar análisis HPC sobre una imagen",
    description=(
        "Lanza el motor C++ (MPI + OpenMP) sobre la imagen indicada. "
        "MPI divide la imagen en franjas horizontales distribuidas entre procesos. "
        "OpenMP paraleliza la suma y umbralización dentro de cada franja."
    ),
)
async def analyze_image(
    image_id:      int,
    mpi_processes: int     = Query(default=2, ge=1, le=8, description="Procesos MPI (1–8)"),
    db:            Session = Depends(get_db),
):
    """
    Ejecuta el motor HPC híbrido (MPI + OpenMP) sobre la imagen y persiste métricas.

    Cómo funciona el motor C++ lanzado:
      · MPI_Scatterv distribuye franjas de filas de la imagen entre N procesos.
      · Cada proceso calcula la suma local de su franja con OpenMP reduction.
      · MPI_Allreduce agrega las sumas → promedio global compartido por todos.
      · Cada proceso umbraliza su franja en paralelo (OpenMP).
      · MPI_Reduce suma los conteos de defectos de cada proceso.
      · MPI_Gatherv reúne las franjas de máscara en el proceso 0.
      · El proceso 0 escribe la máscara y emite JSON de métricas por stdout.

    Flujo de este endpoint:
      1. Busca el registro en la BD por image_id. Error 404 si no existe.
      2. Verifica que el archivo de imagen existe en disco. Error 404 si no.
      3. Construye el comando: mpirun -np N ./textil_hibrido <entrada> <salida>.
      4. Ejecuta el comando con subprocess.run (bloquea hasta que termina).
      5. Parsea el JSON de stdout (primer objeto { ... } encontrado en la salida).
      6. Actualiza el registro en la BD con todas las métricas del motor.
      7. Retorna AnalysisResponse con métricas completas y URLs de las imágenes.

    Parámetros:
        image_id      (int):   ID del registro en la BD (retornado por /api/upload).
        mpi_processes (int):   Número de procesos MPI a lanzar (default: 2, max: 8).
                               Cada proceso recibe filas_total/N filas de la imagen.
        db            (Session): Sesión SQLite inyectada por FastAPI.

    Retorna:
        AnalysisResponse: Métricas completas del análisis:
            · tiempo_ms         — Tiempo total del pipeline MPI+OMP en milisegundos.
            · pixeles_anomalos  — Suma de defectos de todas las franjas MPI.
            · intensidad_promedio — Promedio global (MPI_Allreduce de sumas OpenMP).
            · speedup_estimate  — Speedup teórico MPI×OMP (Ley de Amdahl, p=0.90).
            · speedup_omp       — Speedup teórico solo OpenMP.
            · speedup_mpi       — Speedup teórico solo MPI.
            · mask_url          — URL de la máscara de defectos generada.
            · original_url      — URL de la imagen original.

    Lanza:
        HTTPException 404 — image_id no existe en la BD o archivo no existe en disco.
        HTTPException 500 — El motor HPC no se pudo ejecutar, timeout, o JSON inválido.
    """
    # ── Recuperar registro de la BD ──────────────────────────────────────────
    registro = db.query(Analysis).filter(Analysis.id == image_id).first()
    if not registro:
        raise HTTPException(
            status_code=404,
            detail=f"No existe imagen con ID {image_id}. Use POST /api/upload primero.",
        )

    # ── Verificar existencia del archivo en disco ────────────────────────────
    ruta_entrada = UPLOAD_DIR / registro.filename
    if not ruta_entrada.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Archivo '{registro.filename}' no encontrado en disco. "
                "Es posible que haya sido eliminado."
            ),
        )

    # ── Construir ruta de salida para la máscara ─────────────────────────────
    mask_filename = f"mask_{registro.filename}"
    ruta_salida   = MASKS_DIR / mask_filename

    # ── Seleccionar motor: C++ (si está compilado) o Python (fallback) ───────
    # El motor C++ requiere que el binario esté compilado con build.sh en Linux/WSL.
    # En Windows sin WSL se usa automáticamente el motor Python, que replica
    # el mismo algoritmo con multiprocessing (MPI) + ThreadPoolExecutor (OpenMP).
    binary_path   = HPC_BINARY.resolve()
    usar_cpp      = binary_path.exists()

    if usar_cpp:
        # ── Motor C++ (OpenMP + MPI real) ────────────────────────────────────
        # Lanza el binario compilado con mpirun y captura el JSON de stdout.
        comando = [
            "mpirun",
            "--allow-run-as-root",
            "--oversubscribe",
            "-np", str(mpi_processes),
            str(binary_path),
            str(ruta_entrada.resolve()),
            str(ruta_salida.resolve()),
        ]

        try:
            resultado = subprocess.run(
                comando, capture_output=True, text=True, timeout=120,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="Motor HPC: timeout (>120s).")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="mpirun no encontrado.")

        if resultado.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Error del motor C++: {resultado.stderr[:400]}",
            )

        try:
            lineas   = resultado.stdout.strip().splitlines()
            json_line = next((l for l in lineas if l.strip().startswith("{")), None)
            if not json_line:
                raise ValueError("No se encontró JSON en stdout del motor C++.")
            metricas = json.loads(json_line)
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"JSON inválido del motor: {e}")

    else:
        # ── Motor Python (fallback para Windows sin compilación C++) ─────────
        # Mismo algoritmo que C++: multiprocessing simula MPI_Scatterv/Gatherv/Allreduce,
        # ThreadPoolExecutor simula las directivas OpenMP reduction.
        # Se activa automáticamente cuando el binario no está disponible.
        try:
            omp_threads = max(1, cpu_count())
            metricas = motor_python_analizar(
                ruta_entrada=str(ruta_entrada.resolve()),
                ruta_salida=str(ruta_salida.resolve()),
                mpi_procs=mpi_processes,
                omp_threads=omp_threads,
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error en motor Python: {e}")

    # ── Actualizar registro en la BD con métricas del motor ─────────────────
    registro.average_intensity = metricas.get("intensidad_promedio")
    registro.anomalous_pixels  = metricas.get("pixeles_anomalos")
    registro.total_pixels      = metricas.get("total_pixeles")
    registro.processing_time   = metricas.get("tiempo_ms")
    registro.speedup_estimate  = metricas.get("speedup_amdahl")
    registro.speedup_omp       = metricas.get("speedup_solo_omp")
    registro.speedup_mpi       = metricas.get("speedup_solo_mpi")
    registro.threads_omp       = metricas.get("threads_omp")
    registro.processes_mpi     = metricas.get("procesos_mpi")
    db.commit()
    db.refresh(registro)

    # ── Construir URLs para el cliente ───────────────────────────────────────
    mask_url     = f"/masks/{mask_filename}"    if ruta_salida.exists()   else None
    original_url = f"/uploads/{registro.filename}"

    return AnalysisResponse(
        id=registro.id,
        filename=registro.filename,
        average_intensity=registro.average_intensity,
        anomalous_pixels=registro.anomalous_pixels,
        total_pixels=registro.total_pixels,
        processing_time=registro.processing_time,
        speedup_estimate=registro.speedup_estimate,
        speedup_omp=registro.speedup_omp,
        speedup_mpi=registro.speedup_mpi,
        threads_omp=registro.threads_omp,
        processes_mpi=registro.processes_mpi,
        timestamp=registro.timestamp,
        mask_url=mask_url,
        original_url=original_url,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/history
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/api/history",
    response_model=List[AnalysisResponse],
    tags=["Historial"],
    summary="Historial de análisis",
    description="Retorna los últimos N análisis registrados, ordenados del más reciente al más antiguo.",
)
def get_history(
    limit: int     = Query(default=50, ge=1, le=500, description="Máximo de registros (1–500)"),
    db:    Session = Depends(get_db),
):
    """
    Consulta el historial de análisis en la base de datos SQLite.

    Ordena los registros por timestamp descendente para mostrar los más recientes
    primero. Para cada registro, verifica en disco si la máscara y la imagen
    original existen y construye las URLs correspondientes.

    Parámetros:
        limit (int):     Número máximo de registros a retornar. Rango: 1–500.
                         Default: 50.
        db    (Session): Sesión SQLite inyectada por FastAPI.

    Retorna:
        List[AnalysisResponse]: Lista de análisis con métricas completas y URLs.
                                 Los registros sin análisis aún tienen campos None.
    """
    # Consulta ordenada: más recientes primero, con límite configurable
    registros = (
        db.query(Analysis)
        .order_by(Analysis.timestamp.desc())
        .limit(limit)
        .all()
    )

    respuesta = []
    for r in registros:
        # Verificar existencia real en disco antes de incluir URLs
        mask_filename = f"mask_{r.filename}"
        mask_url      = f"/masks/{mask_filename}"   if (MASKS_DIR  / mask_filename).exists() else None
        original_url  = f"/uploads/{r.filename}"    if (UPLOAD_DIR / r.filename).exists()    else None

        respuesta.append(AnalysisResponse(
            id=r.id,
            filename=r.filename,
            average_intensity=r.average_intensity,
            anomalous_pixels=r.anomalous_pixels,
            total_pixels=r.total_pixels,
            processing_time=r.processing_time,
            speedup_estimate=r.speedup_estimate,
            speedup_omp=r.speedup_omp,
            speedup_mpi=r.speedup_mpi,
            threads_omp=r.threads_omp,
            processes_mpi=r.processes_mpi,
            timestamp=r.timestamp,
            mask_url=mask_url,
            original_url=original_url,
        ))

    return respuesta


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/speedup-stats
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/api/speedup-stats",
    response_model=SpeedupStatsResponse,
    tags=["Historial"],
    summary="Estadísticas de rendimiento HPC",
    description=(
        "Retorna estadísticas agregadas de rendimiento de todos los análisis "
        "(tiempo promedio, speedup promedio, máximo speedup, etc.)."
    ),
)
def get_speedup_stats(db: Session = Depends(get_db)):
    """
    Calcula y retorna estadísticas agregadas de rendimiento sobre todos los
    análisis completados en la base de datos.

    Utiliza funciones de agregación de SQLAlchemy (func.avg, func.max, func.min,
    func.count) ejecutadas directamente en SQLite para eficiencia.

    Métricas calculadas:
      · total_analyses      — Conteo total de registros en la tabla.
      · avg_processing_time — Promedio del campo processing_time (milisegundos).
      · avg_speedup         — Promedio del campo speedup_estimate (Ley de Amdahl).
      · avg_anomaly_ratio   — Promedio de anomalous_pixels / total_pixels.
      · max_speedup         — Mayor speedup registrado.
      · min_processing_time — Tiempo de procesamiento más rápido.

    Parámetros:
        db (Session): Sesión SQLite inyectada por FastAPI.

    Retorna:
        SpeedupStatsResponse: Estadísticas de rendimiento agregadas.
    """
    total = db.query(func.count(Analysis.id)).scalar()

    avg_time    = db.query(func.avg(Analysis.processing_time)).scalar()
    avg_speedup = db.query(func.avg(Analysis.speedup_estimate)).scalar()
    max_speedup = db.query(func.max(Analysis.speedup_estimate)).scalar()
    min_time    = db.query(func.min(Analysis.processing_time)).scalar()

    # Calcular razón promedio de anomalías solo sobre registros con datos completos
    registros_completos = (
        db.query(Analysis)
        .filter(
            Analysis.anomalous_pixels.isnot(None),
            Analysis.total_pixels.isnot(None),
            Analysis.total_pixels > 0,
        )
        .all()
    )

    avg_anomaly_ratio = None
    if registros_completos:
        razones = [
            r.anomalous_pixels / r.total_pixels
            for r in registros_completos
        ]
        avg_anomaly_ratio = sum(razones) / len(razones)

    return SpeedupStatsResponse(
        total_analyses=total or 0,
        avg_processing_time=round(avg_time, 2)    if avg_time    else None,
        avg_speedup=round(avg_speedup, 4)          if avg_speedup else None,
        avg_anomaly_ratio=round(avg_anomaly_ratio, 4) if avg_anomaly_ratio else None,
        max_speedup=round(max_speedup, 4)          if max_speedup else None,
        min_processing_time=round(min_time, 2)     if min_time    else None,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/health
# ═══════════════════════════════════════════════════════════════════════════════

@app.get(
    "/api/health",
    tags=["Sistema"],
    summary="Estado del servicio",
    description="Verifica que el servicio FastAPI y el binario HPC estén disponibles.",
)
def health_check(db: Session = Depends(get_db)):
    """
    Verifica el estado del servicio y la disponibilidad del motor HPC.

    Comprobaciones realizadas:
      · Binario HPC: si existe en la ruta configurada en HPC_BINARY.
      · Base de datos: si la conexión SQLite responde (ejecuta count simple).
      · Directorios: si UPLOAD_DIR y MASKS_DIR existen y son accesibles.

    Parámetros:
        db (Session): Sesión SQLite inyectada (verificación implícita de conexión).

    Retorna:
        dict: {
            status          — "ok" si todo está disponible.
            hpc_binary      — "disponible" | "no compilado".
            database        — "ok" con conteo de análisis.
            upload_dir      — "ok" | "error".
            masks_dir       — "ok" | "error".
            timestamp       — ISO timestamp UTC del chequeo.
        }
    """
    binary_ok    = HPC_BINARY.resolve().exists()
    upload_ok    = UPLOAD_DIR.exists()
    masks_ok     = MASKS_DIR.exists()

    try:
        total_analyses = db.query(func.count(Analysis.id)).scalar()
        db_status = f"ok ({total_analyses} análisis)"
    except Exception as e:
        db_status = f"error: {e}"

    motor_activo = "C++ (OpenMP + MPI)" if binary_ok else "Python (multiprocessing + ThreadPool)"

    return {
        "status":       "ok",
        "motor_activo": motor_activo,
        "hpc_binary":   "disponible" if binary_ok else "no compilado — usando motor Python",
        "database":     db_status,
        "upload_dir":   "ok" if upload_ok else "error",
        "masks_dir":    "ok" if masks_ok  else "error",
        "cpu_count":    cpu_count(),
        "timestamp":    datetime.utcnow().isoformat(),
    }
