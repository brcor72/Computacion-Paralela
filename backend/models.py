"""
models.py
---------
Define los modelos ORM (SQLAlchemy) y los esquemas de validación (Pydantic)
para el sistema de detección de defectos textiles.

Cada campo del modelo Analysis corresponde a una métrica emitida por el motor
HPC (textil_hibrido.cpp) en formato JSON por stdout, o a metadata de la carga.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from pydantic import BaseModel
from typing import Optional
from database import Base


# ---------------------------------------------------------------------------
# Modelo ORM — tabla 'analyses' en SQLite
# ---------------------------------------------------------------------------

class Analysis(Base):
    """
    Representa un registro de análisis de imagen textil en la base de datos.

    Columnas persistidas:
        id                  — Identificador único autoincremental.
        filename            — Nombre del archivo de imagen guardado en disco.
        average_intensity   — Intensidad media de gris de toda la imagen procesada.
                              Calculada por MPI_Allreduce sobre las sumas locales OpenMP.
        anomalous_pixels    — Cantidad de píxeles clasificados como defectuosos
                              (suma de defectos de todas las franjas MPI via MPI_Reduce).
        total_pixels        — Total de píxeles de la imagen (filas × cols).
        processing_time     — Tiempo total de ejecución del motor C++ en milisegundos,
                              medido con MPI_Wtime (incluye distribución + cómputo + gather).
        speedup_estimate    — Speedup teórico combinado MPI×OMP según Ley de Amdahl (p=0.90).
        speedup_omp         — Speedup teórico solo con OpenMP (sin MPI).
        speedup_mpi         — Speedup teórico solo con MPI (sin OpenMP).
        threads_omp         — Número de hilos OpenMP por proceso (omp_get_max_threads()).
        processes_mpi       — Número de procesos MPI lanzados.
        timestamp           — Fecha y hora UTC del análisis.
    """
    __tablename__ = "analyses"

    id                = Column(Integer, primary_key=True, index=True)
    filename          = Column(String,  nullable=False)
    average_intensity = Column(Float,   nullable=True)
    anomalous_pixels  = Column(Integer, nullable=True)
    total_pixels      = Column(Integer, nullable=True)
    processing_time   = Column(Float,   nullable=True)   # milisegundos
    speedup_estimate  = Column(Float,   nullable=True)   # MPI × OMP combinado
    speedup_omp       = Column(Float,   nullable=True)   # solo OpenMP
    speedup_mpi       = Column(Float,   nullable=True)   # solo MPI
    threads_omp       = Column(Integer, nullable=True)
    processes_mpi     = Column(Integer, nullable=True)
    timestamp         = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Esquemas Pydantic — validación y serialización de respuestas API
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    """
    Esquema de respuesta completa de un análisis.
    Se devuelve al cliente tras POST /api/analyze/{image_id} y GET /api/history.

    Fields:
        id                  — ID del registro en la BD.
        filename            — Nombre del archivo procesado.
        average_intensity   — Intensidad media calculada sobre toda la imagen.
        anomalous_pixels    — Píxeles anómalos detectados en todas las franjas MPI.
        total_pixels        — Total de píxeles de la imagen.
        processing_time     — Tiempo de procesamiento en milisegundos.
        speedup_estimate    — Speedup teórico MPI×OMP (Ley de Amdahl, p=0.90).
        speedup_omp         — Speedup teórico solo con hilos OpenMP.
        speedup_mpi         — Speedup teórico solo con procesos MPI.
        threads_omp         — Hilos OpenMP empleados por proceso.
        processes_mpi       — Procesos MPI lanzados.
        timestamp           — Marca temporal del análisis.
        mask_url            — URL relativa de la máscara de defectos generada.
        original_url        — URL relativa de la imagen original subida.
    """
    id:                  int
    filename:            str
    average_intensity:   Optional[float] = None
    anomalous_pixels:    Optional[int]   = None
    total_pixels:        Optional[int]   = None
    processing_time:     Optional[float] = None
    speedup_estimate:    Optional[float] = None
    speedup_omp:         Optional[float] = None
    speedup_mpi:         Optional[float] = None
    threads_omp:         Optional[int]   = None
    processes_mpi:       Optional[int]   = None
    timestamp:           datetime
    mask_url:            Optional[str]   = None
    original_url:        Optional[str]   = None

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """
    Esquema de respuesta para la subida de una imagen.
    Se devuelve al cliente inmediatamente tras POST /api/upload,
    antes de lanzar el análisis.

    Fields:
        image_id    — ID asignado en la BD. Se usa en POST /api/analyze/{image_id}.
        filename    — Nombre único generado para el archivo en el servidor.
        message     — Mensaje confirmando la recepción del archivo.
    """
    image_id: int
    filename: str
    message:  str


class SpeedupStatsResponse(BaseModel):
    """
    Esquema de respuesta para GET /api/speedup-stats.
    Retorna estadísticas agregadas de rendimiento de todos los análisis.

    Fields:
        total_analyses      — Número total de análisis registrados.
        avg_processing_time — Tiempo promedio de procesamiento (ms).
        avg_speedup         — Speedup promedio combinado MPI×OMP.
        avg_anomaly_ratio   — Promedio de la razón píxeles_anómalos / total_píxeles.
        max_speedup         — Mayor speedup registrado.
        min_processing_time — Tiempo de procesamiento más rápido registrado (ms).
    """
    total_analyses:      int
    avg_processing_time: Optional[float] = None
    avg_speedup:         Optional[float] = None
    avg_anomaly_ratio:   Optional[float] = None
    max_speedup:         Optional[float] = None
    min_processing_time: Optional[float] = None
