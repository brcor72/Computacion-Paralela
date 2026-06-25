/*
 * ============================================================================
 * textil_hibrido.cpp — Motor HPC Híbrido (MPI + OpenMP + OpenCV)
 * ============================================================================
 *
 * ESTRATEGIA DE PARALELISMO (dos niveles):
 *
 *   Nivel 1 — MPI (memoria distribuida, múltiples procesos):
 *     La imagen se divide en FRANJAS HORIZONTALES. Cada proceso MPI recibe
 *     exactamente (filas / N_procesos) filas y trabaja de forma independiente
 *     sobre su franja. Al final se usa MPI_Reduce para agregar estadísticas
 *     globales y MPI_Gather para reunir la máscara de defectos completa.
 *
 *   Nivel 2 — OpenMP (memoria compartida, múltiples hilos dentro de cada proceso):
 *     Dentro de cada franja MPI, los píxeles son procesados en paralelo por
 *     varios hilos:
 *       · #pragma omp parallel for reduction(+:suma)    → promedio de intensidad
 *       · #pragma omp parallel for reduction(+:defectos) → umbralización binaria
 *
 *   FLUJO COMPLETO:
 *     [Proceso 0] Lee imagen → convierte a gris → aplica Gaussian Blur
 *     [Todos]     Reciben su franja vía MPI_Scatterv
 *     [Todos]     Calculan suma local con OpenMP → MPI_Allreduce → promedio global
 *     [Todos]     Umbralizan su franja con OpenMP → cuenta defectos locales
 *     [Proceso 0] Recibe todas las franjas (MPI_Gatherv) → escribe máscara
 *     [Proceso 0] Imprime JSON de métricas en stdout → el backend lo parsea
 *
 * Uso:
 *   mpirun -np <N> ./textil_hibrido <imagen_entrada> <imagen_salida>
 *
 * Salida (stdout, proceso 0):
 *   {"tiempo_ms":..., "pixeles_anomalos":..., "intensidad_promedio":..., ...}
 * ============================================================================
 */

#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <cmath>
#include <numeric>
#include <opencv2/opencv.hpp>
#include <omp.h>
#include <mpi.h>

using namespace std;
using namespace cv;

// Umbral absoluto de intensidad para clasificar un píxel como anómalo.
// Un píxel cuya diferencia con la media global supere este valor es defecto.
static const int UMBRAL = 40;

// ============================================================================
// calcular_suma_local
// ============================================================================
/*
 * Calcula la suma de intensidades de los píxeles de una franja de imagen
 * usando reducción paralela OpenMP.
 *
 * Cada hilo OpenMP acumula una suma parcial sobre un subconjunto de filas;
 * la directiva reduction(+:suma) combina los resultados sin condiciones de carrera.
 *
 * @param franja      Buffer contiguo de bytes (imagen en escala de grises, filas × cols).
 * @param n_filas     Número de filas en esta franja.
 * @param cols        Número de columnas (ancho de la imagen).
 * @return            Suma total de intensidades de la franja.
 */
static double calcular_suma_local(const vector<uchar>& franja, int n_filas, int cols) {
    double suma = 0.0;

    #pragma omp parallel for reduction(+:suma) schedule(static)
    for (int i = 0; i < n_filas; i++) {
        for (int j = 0; j < cols; j++) {
            suma += franja[i * cols + j];
        }
    }

    return suma;
}

// ============================================================================
// umbralizar_franja
// ============================================================================
/*
 * Aplica el umbral de detección de defectos sobre la franja local de cada
 * proceso MPI, usando paralelismo OpenMP para procesar filas en paralelo.
 *
 * Un píxel se marca como defecto (valor 255 en la máscara) si su diferencia
 * absoluta con el promedio global supera UMBRAL.
 *
 * @param franja          Buffer de entrada: píxeles en escala de grises.
 * @param mascara_local   Buffer de salida: máscara binaria (0 = normal, 255 = defecto).
 * @param n_filas         Número de filas de la franja local.
 * @param cols            Número de columnas (ancho de imagen).
 * @param promedio_global Promedio de intensidad calculado sobre toda la imagen
 *                        (resultado de MPI_Allreduce).
 * @return                Número de píxeles anómalos detectados en esta franja.
 */
static int umbralizar_franja(
    const vector<uchar>& franja,
    vector<uchar>&       mascara_local,
    int n_filas, int cols,
    double promedio_global)
{
    int defectos = 0;

    #pragma omp parallel for reduction(+:defectos) schedule(static)
    for (int i = 0; i < n_filas; i++) {
        for (int j = 0; j < cols; j++) {
            int idx = i * cols + j;
            if (abs((int)franja[idx] - (int)promedio_global) > UMBRAL) {
                mascara_local[idx] = 255;
                defectos++;
            } else {
                mascara_local[idx] = 0;
            }
        }
    }

    return defectos;
}

// ============================================================================
// calcular_speedup_amdahl
// ============================================================================
/*
 * Calcula el speedup teórico máximo usando la Ley de Amdahl.
 *
 * Fórmula: S(n) = 1 / ((1 - p) + p/n)
 *   · p = fracción del código que es paralelizable (0.90 = 90 %).
 *   · n = número de unidades de procesamiento (hilos u procesos).
 *
 * @param n  Número de procesadores o hilos.
 * @param p  Fracción paralela del código (default 0.90).
 * @return   Speedup teórico.
 */
static double calcular_speedup_amdahl(int n, double p = 0.90) {
    return 1.0 / ((1.0 - p) + (p / n));
}

// ============================================================================
// main
// ============================================================================
/*
 * Punto de entrada del motor HPC.
 *
 * Coordina todo el pipeline paralelo:
 *   1. Inicializa MPI y determina rank y tamaño del comunicador.
 *   2. El proceso 0 carga la imagen, la convierte a gris y aplica Gaussian Blur.
 *   3. Las dimensiones y el número de filas por proceso se difunden con MPI_Bcast.
 *   4. La imagen preprocesada se distribuye en franjas con MPI_Scatterv.
 *   5. Cada proceso calcula su suma local con OpenMP → MPI_Allreduce → promedio global.
 *   6. Cada proceso umbraliza su franja con OpenMP y cuenta sus defectos locales.
 *   7. MPI_Reduce suma todos los defectos locales en el proceso 0.
 *   8. MPI_Gatherv reúne las franjas de máscara en el proceso 0.
 *   9. El proceso 0 escribe la máscara final y emite el JSON de métricas.
 *
 * @param argc  Número de argumentos CLI.
 * @param argv  argv[1] = ruta imagen entrada, argv[2] = ruta imagen salida.
 * @return      0 en éxito, 1 en error.
 */
int main(int argc, char** argv) {
    // ── Inicialización MPI ──────────────────────────────────────────────────
    MPI_Init(&argc, &argv);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);  // ID de este proceso (0..N-1)
    MPI_Comm_size(MPI_COMM_WORLD, &size);  // Total de procesos MPI

    // Validar argumentos
    if (argc < 3) {
        if (rank == 0) {
            cerr << "Uso: " << argv[0] << " <imagen_entrada> <imagen_salida>" << endl;
        }
        MPI_Finalize();
        return 1;
    }

    const string ruta_entrada(argv[1]);
    const string ruta_salida(argv[2]);

    // ── Variables compartidas entre procesos (se difunden desde rank 0) ─────
    int filas_total = 0;
    int cols        = 0;

    // Buffer de la imagen completa preprocesada (solo rank 0 lo llena).
    // Todos los procesos lo reciben via Scatterv.
    vector<uchar> imagen_completa;

    // Marca de tiempo de inicio (MPI_Wtime es sincronizado entre procesos)
    double t_inicio = MPI_Wtime();

    // ── PASO 1: Proceso 0 carga y preprocesa la imagen ──────────────────────
    if (rank == 0) {
        Mat img_color = imread(ruta_entrada, IMREAD_COLOR);
        if (img_color.empty()) {
            cerr << "[MPI 0] ERROR: No se pudo cargar: " << ruta_entrada << endl;
            // Señalizar error a todos los procesos enviando dimensiones 0
            MPI_Bcast(&filas_total, 1, MPI_INT, 0, MPI_COMM_WORLD);
            MPI_Bcast(&cols,        1, MPI_INT, 0, MPI_COMM_WORLD);
            MPI_Finalize();
            return 1;
        }

        Mat img_gris, img_blur;

        // Convertir a escala de grises: reduce 3 canales (BGR) a 1 canal de intensidad
        cvtColor(img_color, img_gris, COLOR_BGR2GRAY);

        // Filtro Gaussiano 5×5: suaviza el ruido de textura para que no se
        // confunda con defectos reales (variaciones finas de tela)
        GaussianBlur(img_gris, img_blur, Size(5, 5), 0);

        filas_total = img_blur.rows;
        cols        = img_blur.cols;

        // Copiar imagen a buffer contiguo (requerido para MPI_Scatterv)
        imagen_completa.assign(img_blur.datastart, img_blur.dataend);
    }

    // ── PASO 2: Difundir dimensiones a todos los procesos ───────────────────
    // Todos los procesos necesitan saber el tamaño para reservar sus buffers
    MPI_Bcast(&filas_total, 1, MPI_INT, 0, MPI_COMM_WORLD);
    MPI_Bcast(&cols,        1, MPI_INT, 0, MPI_COMM_WORLD);

    if (filas_total == 0 || cols == 0) {
        MPI_Finalize();
        return 1;
    }

    // ── PASO 3: Calcular distribución de franjas entre procesos ─────────────
    // División equitativa: las filas sobrantes se asignan a los primeros procesos
    vector<int> filas_por_proceso(size);
    vector<int> desplazamiento(size);   // offset en bytes dentro del buffer global
    vector<int> conteo(size);           // bytes que recibe cada proceso

    int filas_base = filas_total / size;
    int sobrantes  = filas_total % size;

    for (int i = 0; i < size; i++) {
        // Los primeros 'sobrantes' procesos reciben una fila extra
        filas_por_proceso[i] = filas_base + (i < sobrantes ? 1 : 0);
        conteo[i]            = filas_por_proceso[i] * cols;
    }

    // Calcular desplazamientos acumulativos (en bytes)
    desplazamiento[0] = 0;
    for (int i = 1; i < size; i++) {
        desplazamiento[i] = desplazamiento[i - 1] + conteo[i - 1];
    }

    // ── PASO 4: Distribuir franjas de la imagen (MPI_Scatterv) ──────────────
    // Scatterv (en lugar de Scatter) permite franjas de tamaño desigual
    int mi_n_filas = filas_por_proceso[rank];
    vector<uchar> mi_franja(mi_n_filas * cols);

    MPI_Scatterv(
        imagen_completa.data(),   // buffer origen (solo válido en rank 0)
        conteo.data(),            // cuántos bytes enviar a cada proceso
        desplazamiento.data(),    // desde qué posición del buffer origen
        MPI_UNSIGNED_CHAR,
        mi_franja.data(),         // buffer destino de este proceso
        mi_n_filas * cols,        // cuántos bytes recibo
        MPI_UNSIGNED_CHAR,
        0,                        // proceso raíz
        MPI_COMM_WORLD
    );

    // ── PASO 5: Calcular suma local con OpenMP → promedio global con MPI ────
    double suma_local = calcular_suma_local(mi_franja, mi_n_filas, cols);

    // MPI_Allreduce suma las sumas de todos los procesos → todos obtienen la suma global
    // Se usa Allreduce (no Reduce) para que TODOS los procesos tengan el promedio
    // y puedan umbralizar su franja sin comunicación adicional
    double suma_global = 0.0;
    MPI_Allreduce(&suma_local, &suma_global, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);

    double promedio_global = suma_global / (double)(filas_total * cols);

    // ── PASO 6: Umbralizar franja local con OpenMP ───────────────────────────
    vector<uchar> mi_mascara(mi_n_filas * cols, 0);
    int mis_defectos = umbralizar_franja(mi_franja, mi_mascara, mi_n_filas, cols, promedio_global);

    // ── PASO 7: Agregar conteo de defectos en proceso 0 ─────────────────────
    int defectos_total = 0;
    MPI_Reduce(&mis_defectos, &defectos_total, 1, MPI_INT, MPI_SUM, 0, MPI_COMM_WORLD);

    // ── PASO 8: Reunir máscara completa en proceso 0 (MPI_Gatherv) ──────────
    vector<uchar> mascara_completa;
    if (rank == 0) {
        mascara_completa.resize(filas_total * cols);
    }

    MPI_Gatherv(
        mi_mascara.data(),        // lo que este proceso aporta
        mi_n_filas * cols,        // cuántos bytes aporta
        MPI_UNSIGNED_CHAR,
        mascara_completa.data(),  // buffer destino (solo relevante en rank 0)
        conteo.data(),            // cuántos bytes se esperan de cada proceso
        desplazamiento.data(),    // en qué posición del buffer destino se colocan
        MPI_UNSIGNED_CHAR,
        0,                        // proceso raíz recolector
        MPI_COMM_WORLD
    );

    double t_fin    = MPI_Wtime();
    double tiempo_ms = (t_fin - t_inicio) * 1000.0;

    // ── PASO 9: Proceso 0 escribe la máscara y emite métricas JSON ──────────
    if (rank == 0) {
        // Reconstruir imagen OpenCV desde el buffer reunido
        Mat mascara_mat(filas_total, cols, CV_8UC1, mascara_completa.data());
        imwrite(ruta_salida, mascara_mat);

        // Calcular speedup teórico con Ley de Amdahl
        // · Fracción paralela p = 0.90 (umbralización pixel-a-pixel es paralelizable)
        // · Unidades = procesos MPI × hilos OpenMP por proceso
        int threads_omp = omp_get_max_threads();
        int unidades    = size * threads_omp;

        double speedup_mpi_omp = calcular_speedup_amdahl(unidades);
        double speedup_omp     = calcular_speedup_amdahl(threads_omp);
        double speedup_mpi     = calcular_speedup_amdahl(size);

        // Emitir JSON estructurado a stdout (el backend FastAPI lo parsea)
        cout << "{"
             << "\"tiempo_ms\":"           << tiempo_ms          << ","
             << "\"pixeles_anomalos\":"    << defectos_total     << ","
             << "\"intensidad_promedio\":" << promedio_global     << ","
             << "\"total_pixeles\":"       << (filas_total * cols)<< ","
             << "\"threads_omp\":"         << threads_omp         << ","
             << "\"procesos_mpi\":"        << size                << ","
             << "\"speedup_amdahl\":"      << speedup_mpi_omp     << ","
             << "\"speedup_solo_omp\":"    << speedup_omp         << ","
             << "\"speedup_solo_mpi\":"    << speedup_mpi         << ","
             << "\"filas_total\":"         << filas_total         << ","
             << "\"cols\":"               << cols
             << "}"
             << endl;
    }

    MPI_Finalize();
    return 0;
}
