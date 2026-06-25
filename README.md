# Sistema de Detección de Defectos Textiles — OpenMP + MPI + FastAPI + React

**USIL — Computación Paralela y Distribuida — 2026-01**

## Estructura del Proyecto

```
textile-defect-system/
├── hpc_core/
│   ├── textil_hibrido.cpp   ← Motor C++ (OpenMP + MPI + OpenCV)
│   └── build.sh             ← Script de compilacion
├── backend/
│   ├── main.py              ← FastAPI (orquestador)
│   ├── models.py            ← Modelos ORM + Pydantic
│   ├── database.py          ← Configuracion SQLite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/      ← Dashboard, History, MetricsCard, etc.
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
├── generate_report.js       ← Genera Informe_Sistema_Textil.docx
└── Informe_Sistema_Textil.docx
```

---

## Opcion A — Despliegue con Docker (Recomendado)

### Requisitos
- Docker Desktop instalado y en ejecucion

### Pasos

```bash
# 1. Clonar / ubicarse en el directorio del proyecto
cd textile-defect-system

# 2. Construir y levantar contenedores
docker-compose up --build

# 3. Acceder al sistema
# Frontend:  http://localhost:5173
# Backend:   http://localhost:8000
# API Docs:  http://localhost:8000/docs
```

---

## Opcion B — Despliegue Nativo (Linux/Ubuntu)

### Requisitos del sistema

```bash
sudo apt-get update
sudo apt-get install -y \
    libopenmpi-dev openmpi-bin \
    libopencv-dev pkg-config \
    g++ python3 python3-pip nodejs npm
```

### 1. Compilar el motor HPC

```bash
cd hpc_core/
bash build.sh
# Genera: ./textil_hibrido
```

### 2. Levantar el Backend

```bash
cd backend/
pip3 install -r requirements.txt
uvicorn main:app --reload --port 8000
# API disponible en http://localhost:8000
# Docs en http://localhost:8000/docs
```

### 3. Levantar el Frontend

```bash
cd frontend/
npm install
npm run dev
# Dashboard disponible en http://localhost:5173
```

### 4. Probar el motor HPC directamente

```bash
cd hpc_core/
mpirun -np 2 ./textil_hibrido ../imagen.jpg ../mascara_salida.jpg
# Imprime JSON con metricas en stdout
```

---

## Generar Informe Word

```bash
cd textile-defect-system/
npm install docx          # solo la primera vez
node generate_report.js   # genera Informe_Sistema_Textil.docx
```

---

## Integrantes

| Nombre | Rol |
|--------|-----|
| Alvarez Paetan, Juan de Dios | HPC Core (C++) |
| Chavez Nuñez, Alvaro Pedro | Backend (FastAPI) |
| Cornejo Condori, Bill Renzo | Base de Datos |
| Jara León, Joaquín Esteban | Frontend (React) |
| Narvaez Garriazo, Cristel Margarita | Pruebas e Integracion |
