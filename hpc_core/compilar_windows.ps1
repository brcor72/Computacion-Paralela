# compilar_windows.ps1
# Compila el motor HPC en Windows nativo usando MSYS2/MinGW64
# Ejecutar desde PowerShell como administrador

$ErrorActionPreference = "Stop"

# ─── Verificar si MSYS2 ya esta instalado ───────────────────────────────────
$msys2Path = "C:\msys64\usr\bin\bash.exe"
$msys2Installed = Test-Path $msys2Path

if (-not $msys2Installed) {
    Write-Host ""
    Write-Host "=== MSYS2 no esta instalado ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Descarga el instalador desde: https://www.msys2.org" -ForegroundColor Cyan
    Write-Host "   (archivo: msys2-x86_64-XXXXXXXX.exe)"
    Write-Host "2. Instalalo en C:\msys64 (ruta por defecto)"
    Write-Host "3. Vuelve a ejecutar este script"
    Write-Host ""
    Write-Host "O ejecuta esto para descargarlo directamente:" -ForegroundColor Green
    Write-Host '  winget install MSYS2.MSYS2' -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "=== MSYS2 encontrado en C:\msys64 ===" -ForegroundColor Green

# ─── Ruta del proyecto (ajustada automaticamente) ───────────────────────────
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Convertir ruta Windows a ruta MSYS2 (C:\... -> /c/...)
$msysProjectDir = $projectDir -replace '\\', '/' -replace '^([A-Za-z]):', { "/$($_.Groups[1].Value.ToLower())" }

Write-Host "Directorio del proyecto: $projectDir" -ForegroundColor Cyan

# ─── Script de compilacion para ejecutar dentro de MSYS2 ────────────────────
$buildScript = @"
#!/bin/bash
set -e

echo ""
echo "=== PASO 1: Instalando dependencias (puede tardar unos minutos) ==="
# Actualizar base de datos de paquetes
pacman -Sy --noconfirm 2>/dev/null

# Instalar toolchain MinGW64 con OpenMPI, OpenCV y OpenMP
pacman -S --noconfirm --needed \
    mingw-w64-x86_64-gcc \
    mingw-w64-x86_64-openmpi \
    mingw-w64-x86_64-opencv \
    mingw-w64-x86_64-pkg-config \
    make

echo ""
echo "=== PASO 2: Compilando textil_hibrido.cpp ==="
cd "$msysProjectDir"

# Agregar MinGW64 al PATH
export PATH="/mingw64/bin:\$PATH"

# Compilar con mpicxx + OpenMP + OpenCV
mpicxx -O3 -std=c++17 \
    textil_hibrido.cpp \
    -o textil_hibrido.exe \
    -fopenmp \
    \$(pkg-config --cflags --libs opencv4) \
    -lstdc++fs

echo ""
echo "=== COMPILACION EXITOSA ==="
echo "Binario generado: textil_hibrido.exe"
ls -lh textil_hibrido.exe
"@

# Guardar el script temporal
$tempScript = "$env:TEMP\build_hpc.sh"
$buildScript | Set-Content -Path $tempScript -Encoding UTF8

# Convertir ruta del script temporal a formato MSYS2
$msysTempScript = $tempScript -replace '\\', '/' -replace '^([A-Za-z]):', { "/$($_.Groups[1].Value.ToLower())" }

Write-Host ""
Write-Host "=== PASO 1 y 2: Instalando dependencias y compilando... ===" -ForegroundColor Yellow
Write-Host "(La primera vez puede tardar 5-10 minutos descargando paquetes)" -ForegroundColor Gray
Write-Host ""

# Ejecutar el script dentro de MSYS2 (MinGW64)
& "C:\msys64\usr\bin\bash.exe" -l -c "bash '$msysTempScript'"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== LISTO ===" -ForegroundColor Green
    Write-Host "Binario: $projectDir\textil_hibrido.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "Para probar el motor:" -ForegroundColor Cyan
    Write-Host '  C:\msys64\usr\bin\bash.exe -l -c "export PATH=/mingw64/bin:$PATH && cd ''<ruta_hpc_core>'' && mpirun -np 2 ./textil_hibrido.exe entrada.jpg salida.jpg"'
} else {
    Write-Host ""
    Write-Host "=== ERROR en la compilacion ===" -ForegroundColor Red
    Write-Host "Revisa los mensajes de error arriba."
}

# Limpiar script temporal
Remove-Item $tempScript -ErrorAction SilentlyContinue
