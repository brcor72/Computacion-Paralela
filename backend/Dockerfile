FROM ubuntu:22.04

# Instalar dependencias del sistema
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    libopenmpi-dev openmpi-bin \
    libopencv-dev pkg-config \
    g++ mpicxx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Compilar el motor HPC
COPY hpc_core/ /app/hpc_core/
RUN cd /app/hpc_core && bash build.sh

# Instalar dependencias Python
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar codigo del backend
COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
