#!/bin/bash
# build.sh - Compila el motor HPC hibrido (OpenMP + MPI + OpenCV)
# Requisitos: mpicxx, libopencv-dev, libopenmpi-dev

set -e

echo "=== Compilando motor HPC textil_hibrido ==="
mpicxx -O3 -std=c++17 \
    textil_hibrido.cpp \
    -o textil_hibrido \
    -fopenmp \
    $(pkg-config --cflags --libs opencv4 2>/dev/null || pkg-config --cflags --libs opencv) \
    -lstdc++fs

echo "=== Compilacion exitosa: ./textil_hibrido ==="
echo "Uso: mpirun -np 2 ./textil_hibrido <entrada.jpg> <salida_mascara.jpg>"
