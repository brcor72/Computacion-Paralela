"""
generar_dataset.py
------------------
Genera 90 imágenes sintéticas realistas de telas textiles:
  · 30 telas limpias   → textura uniforme de tejido
  · 30 telas con mancha → manchas orgánicas de formas irregulares
  · 30 telas con rotura → roturas, hilos sueltos y agujeros

Las imágenes imitan la apariencia real de telas mediante:
  - Patrón de tejido (warp/weft) con ruido Perlin simulado
  - Variaciones de color por franja (diferencias de tinte entre lotes)
  - Manchas con gradiente radial y bordes difusos (manchas reales)
  - Roturas con trazos diagonales y zonas de hilo desgarrado
"""

import cv2
import numpy as np
import os
from pathlib import Path

# ─── Directorio de salida ─────────────────────────────────────────────────────
CARPETA = Path(__file__).parent / "imagenes_prueba"
(CARPETA / "tela_limpia").mkdir(parents=True, exist_ok=True)
(CARPETA / "tela_mancha").mkdir(parents=True, exist_ok=True)
(CARPETA / "tela_rotura").mkdir(parents=True, exist_ok=True)

ANCHO, ALTO = 640, 480
rng = np.random.default_rng(42)

# ─────────────────────────────────────────────────────────────────────────────
# UTILIDADES DE TEXTURA
# ─────────────────────────────────────────────────────────────────────────────

def textura_tejido(alto, ancho, color_base, variacion=12, frecuencia=8):
    """
    Genera una textura realista de tejido (warp + weft).
    Combina un patrón de líneas cruzadas con ruido gaussiano
    para simular los hilos entrelazados de una tela.

    Parámetros:
        alto, ancho   — Dimensiones de la imagen.
        color_base    — Color BGR base de la tela (tuple de 3 ints).
        variacion     — Amplitud del ruido de textura.
        frecuencia    — Espaciado de los hilos (píxeles entre líneas).

    Retorna:
        img (np.ndarray): Imagen BGR de la textura de tela.
    """
    img = np.full((alto, ancho, 3), color_base, dtype=np.float32)

    # Patrón de hilos horizontales (weft)
    for y in range(0, alto, frecuencia):
        grosor = rng.integers(1, 3)
        brillo = rng.integers(-8, 8)
        img[max(0, y-grosor):y+grosor, :] += brillo

    # Patrón de hilos verticales (warp)
    for x in range(0, ancho, frecuencia):
        grosor = rng.integers(1, 3)
        brillo = rng.integers(-8, 8)
        img[:, max(0, x-grosor):x+grosor] += brillo

    # Ruido de textura superficial (irregularidades del hilo)
    ruido = rng.normal(0, variacion, (alto, ancho, 3)).astype(np.float32)
    img += ruido

    # Variación suave de iluminación (sombra de pliegue)
    gradiente = np.linspace(0.93, 1.07, ancho, dtype=np.float32)
    img *= gradiente[np.newaxis, :, np.newaxis]

    return np.clip(img, 0, 255).astype(np.uint8)


def variacion_color(color_base, magnitud=20):
    """
    Aplica una variación aleatoria al color base para simular
    diferencias de tinte entre lotes de producción.

    Retorna tuple BGR con el color variado.
    """
    delta = rng.integers(-magnitud, magnitud, 3)
    return tuple(int(np.clip(c + d, 10, 245)) for c, d in zip(color_base, delta))


# ─────────────────────────────────────────────────────────────────────────────
# PALETAS DE COLORES DE TELA
# ─────────────────────────────────────────────────────────────────────────────

COLORES_TELA = [
    (220, 215, 200),  # Blanco roto / crudo
    (200, 200, 210),  # Gris claro
    (180, 195, 210),  # Celeste pálido
    (195, 210, 195),  # Verde menta suave
    (210, 195, 185),  # Beige cálido
    (185, 185, 205),  # Lavanda suave
    (210, 205, 185),  # Arena
    (190, 180, 175),  # Gris topo
    (200, 185, 175),  # Rosa pálido
    (175, 195, 200),  # Azul grisáceo
]


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR 1 — TELA LIMPIA
# ─────────────────────────────────────────────────────────────────────────────

def generar_tela_limpia(idx):
    """
    Genera una imagen de tela sin defectos.
    Varía: color base, frecuencia del tejido, variación de textura,
    iluminación, y presencia de pliegues suaves (normales en telas reales).

    Parámetros:
        idx (int): Índice de imagen (0–29) para variedad controlada.

    Retorna:
        np.ndarray: Imagen BGR de tela limpia.
    """
    color_base = variacion_color(COLORES_TELA[idx % len(COLORES_TELA)], magnitud=25)
    frecuencia = rng.integers(6, 14)
    variacion  = rng.integers(6, 18)

    img = textura_tejido(ALTO, ANCHO, color_base, variacion, frecuencia)

    # Pliegue suave opcional (no es defecto, ocurre en telas reales)
    if rng.random() > 0.4:
        cx = rng.integers(ANCHO // 4, 3 * ANCHO // 4)
        sombra = np.zeros((ALTO, ANCHO), dtype=np.float32)
        for x in range(ANCHO):
            dist = abs(x - cx)
            if dist < 40:
                sombra[:, x] = -15 * np.exp(-dist**2 / 300)
        img = np.clip(img.astype(np.float32) + sombra[:, :, np.newaxis], 0, 255).astype(np.uint8)

    # Ligera viñeta (efecto de iluminación natural)
    cy, cx = ALTO // 2, ANCHO // 2
    Y, X = np.ogrid[:ALTO, :ANCHO]
    dist_centro = np.sqrt(((X - cx) / ANCHO)**2 + ((Y - cy) / ALTO)**2)
    vignet = 1.0 - 0.25 * dist_centro
    img = np.clip(img * vignet[:, :, np.newaxis], 0, 255).astype(np.uint8)

    return img


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR 2 — TELA CON MANCHA
# ─────────────────────────────────────────────────────────────────────────────

def generar_mancha_blob(img, cx, cy, radio, intensidad, color_mancha):
    """
    Dibuja una mancha orgánica con gradiente difuso sobre la imagen.
    Usa una máscara gaussiana con ruido de borde para simular
    manchas reales (aceite, humedad, tinta, oxidación).

    Parámetros:
        img          — Imagen base sobre la que se pinta la mancha.
        cx, cy       — Centro de la mancha en píxeles.
        radio        — Radio aproximado de la mancha.
        intensidad   — Opacidad de la mancha (0.0–1.0).
        color_mancha — Color BGR de la mancha.

    Retorna:
        np.ndarray: Imagen con la mancha aplicada.
    """
    Y, X = np.ogrid[:ALTO, :ANCHO]

    # Distorsión irregular del borde (forma no circular)
    angulo = np.arctan2(Y - cy, X - cx)
    ruido_borde = 1.0 + 0.35 * np.sin(3.7 * angulo + rng.uniform(0, 6.28))
    ruido_borde += 0.2 * np.sin(7.1 * angulo + rng.uniform(0, 6.28))

    dist = np.sqrt((X - cx)**2 + (Y - cy)**2) / (radio * ruido_borde + 1e-6)

    # Máscara gaussiana suave (bordes difusos como manchas reales)
    mascara = np.exp(-2.5 * dist**2) * intensidad
    mascara = np.clip(mascara, 0, 1)

    # Aplicar color de mancha con la máscara
    img_f = img.astype(np.float32)
    for c in range(3):
        img_f[:, :, c] = img_f[:, :, c] * (1 - mascara) + color_mancha[c] * mascara

    return np.clip(img_f, 0, 255).astype(np.uint8)


COLORES_MANCHA = [
    (20,  30,  80),   # Mancha oscura / aceite
    (40,  20,  120),  # Tinta azul
    (20,  60,  20),   # Moho / humedad verde
    (60,  40,  20),   # Óxido / tierra
    (30,  80,  80),   # Humedad oscura
    (80,  20,  20),   # Sangre / vino
    (100, 80,  20),   # Grasa amarillenta
    (20,  20,  20),   # Hollín / carbón
]


def generar_tela_mancha(idx):
    """
    Genera una imagen de tela con manchas de diferentes tipos y tamaños.
    Combina entre 1 y 3 manchas por imagen con diferentes colores y formas.
    Las manchas tienen bordes orgánicos difusos (no círculos perfectos).

    Parámetros:
        idx (int): Índice de imagen (0–29).

    Retorna:
        np.ndarray: Imagen BGR de tela con mancha.
    """
    color_base = variacion_color(COLORES_TELA[idx % len(COLORES_TELA)], magnitud=20)
    img = textura_tejido(ALTO, ANCHO, color_base, variacion=10, frecuencia=rng.integers(6, 14))

    # Número de manchas por imagen (1 grande + 0-2 satélites)
    n_manchas = rng.integers(1, 4)

    for i in range(n_manchas):
        cx = rng.integers(80, ANCHO - 80)
        cy = rng.integers(60, ALTO  - 60)

        if i == 0:
            # Mancha principal: grande
            radio     = rng.integers(40, 110)
            intensidad = rng.uniform(0.55, 0.90)
        else:
            # Manchas satélite: pequeñas, cerca de la principal
            cx = int(np.clip(cx + rng.integers(-80, 80), 20, ANCHO - 20))
            cy = int(np.clip(cy + rng.integers(-60, 60), 20, ALTO  - 20))
            radio      = rng.integers(10, 40)
            intensidad = rng.uniform(0.30, 0.65)

        color_mancha = COLORES_MANCHA[rng.integers(0, len(COLORES_MANCHA))]
        img = generar_mancha_blob(img, cx, cy, radio, intensidad, color_mancha)

    return img


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR 3 — TELA CON ROTURA
# ─────────────────────────────────────────────────────────────────────────────

def generar_tela_rotura(idx):
    """
    Genera una imagen de tela con roturas, agujeros y/o hilos sueltos.
    Cada imagen tiene entre 1 y 3 tipos de defecto estructural:
      - Rotura lineal: corte recto o diagonal (hilo cortado)
      - Agujero: zona circular muy oscura (tela rasgada)
      - Hilo suelto: trazos irregulares finos (warp/weft roto)

    Parámetros:
        idx (int): Índice de imagen (0–29).

    Retorna:
        np.ndarray: Imagen BGR de tela con rotura.
    """
    color_base = variacion_color(COLORES_TELA[idx % len(COLORES_TELA)], magnitud=20)
    img = textura_tejido(ALTO, ANCHO, color_base, variacion=10, frecuencia=rng.integers(6, 14))

    tipo = idx % 3  # Rotar entre 3 tipos de defecto

    # ── TIPO 0: Rotura lineal (corte diagonal) ────────────────────────────────
    if tipo == 0 or rng.random() > 0.6:
        n_roturas = rng.integers(1, 4)
        for _ in range(n_roturas):
            x1 = rng.integers(0, ANCHO // 2)
            y1 = rng.integers(0, ALTO)
            angulo = rng.uniform(-70, 70)
            largo  = rng.integers(80, 280)
            x2 = int(x1 + largo * np.cos(np.radians(angulo)))
            y2 = int(y1 + largo * np.sin(np.radians(angulo)))

            grosor_rotura = rng.integers(2, 8)
            color_corte = (int(rng.integers(0, 30)),) * 3
            cv2.line(img, (x1, y1), (x2, y2), color_corte, grosor_rotura)

            # Bordes desgarrados (líneas paralelas irregulares)
            for offset in [-grosor_rotura - 2, grosor_rotura + 2]:
                ox1 = x1 + rng.integers(-4, 4)
                oy1 = y1 + offset + rng.integers(-3, 3)
                ox2 = x2 + rng.integers(-4, 4)
                oy2 = y2 + offset + rng.integers(-3, 3)
                cv2.line(img, (ox1, oy1), (ox2, oy2),
                         tuple(rng.integers(15, 50, 3).tolist()), 1)

    # ── TIPO 1: Agujero (zona rasgada oscura) ────────────────────────────────
    if tipo == 1 or rng.random() > 0.5:
        n_agujeros = rng.integers(1, 3)
        for _ in range(n_agujeros):
            cx = rng.integers(60, ANCHO - 60)
            cy = rng.integers(50, ALTO  - 50)
            rx = rng.integers(15, 55)
            ry = rng.integers(10, 40)

            # Agujero central muy oscuro
            color_agujero = (int(rng.integers(5, 25)),) * 3
            cv2.ellipse(img, (cx, cy), (rx, ry),
                        rng.integers(0, 180), 0, 360, color_agujero, -1)

            # Halo de fibras deshilachadas alrededor
            for _ in range(rng.integers(8, 20)):
                ax = cx + rng.integers(-rx - 20, rx + 20)
                ay = cy + rng.integers(-ry - 15, ry + 15)
                bx = ax + rng.integers(-25, 25)
                by = ay + rng.integers(-20, 20)
                cv2.line(img, (ax, ay), (bx, by),
                         tuple(rng.integers(20, 60, 3).tolist()),
                         rng.integers(1, 3))

    # ── TIPO 2: Hilos sueltos (warp/weft rotos) ───────────────────────────────
    if tipo == 2 or rng.random() > 0.55:
        n_hilos = rng.integers(3, 10)
        for _ in range(n_hilos):
            # Hilo horizontal roto
            if rng.random() > 0.5:
                y0 = rng.integers(ALTO // 5, 4 * ALTO // 5)
                x0 = rng.integers(0, ANCHO // 3)
                largo = rng.integers(50, 220)

                pts = []
                xc = x0
                for _ in range(rng.integers(6, 18)):
                    xc += rng.integers(5, 25)
                    yc = y0 + rng.integers(-6, 6)
                    pts.append([xc, yc])
                    if xc > x0 + largo:
                        break

                if len(pts) > 1:
                    pts_arr = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
                    color_hilo = tuple(rng.integers(15, 45, 3).tolist())
                    cv2.polylines(img, [pts_arr], False, color_hilo, rng.integers(1, 3))
            else:
                # Hilo vertical roto
                x0 = rng.integers(ANCHO // 5, 4 * ANCHO // 5)
                y0 = rng.integers(0, ALTO // 3)
                largo = rng.integers(50, 180)

                pts = []
                yc = y0
                for _ in range(rng.integers(6, 15)):
                    yc += rng.integers(5, 20)
                    xc = x0 + rng.integers(-5, 5)
                    pts.append([xc, yc])
                    if yc > y0 + largo:
                        break

                if len(pts) > 1:
                    pts_arr = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
                    color_hilo = tuple(rng.integers(15, 45, 3).tolist())
                    cv2.polylines(img, [pts_arr], False, color_hilo, rng.integers(1, 3))

    return img


# ─────────────────────────────────────────────────────────────────────────────
# MAIN — Generar las 90 imágenes
# ─────────────────────────────────────────────────────────────────────────────

def main():
    total = 0

    print("Generando imágenes de tela limpia...")
    for i in range(30):
        img  = generar_tela_limpia(i)
        path = CARPETA / "tela_limpia" / f"limpia_{i+1:02d}.jpg"
        cv2.imwrite(str(path), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        total += 1
        print(f"  [{total:02d}/90] {path.name}")

    print("\nGenerando imágenes de tela con mancha...")
    for i in range(30):
        img  = generar_tela_mancha(i)
        path = CARPETA / "tela_mancha" / f"mancha_{i+1:02d}.jpg"
        cv2.imwrite(str(path), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        total += 1
        print(f"  [{total:02d}/90] {path.name}")

    print("\nGenerando imágenes de tela con rotura...")
    for i in range(30):
        img  = generar_tela_rotura(i)
        path = CARPETA / "tela_rotura" / f"rotura_{i+1:02d}.jpg"
        cv2.imwrite(str(path), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        total += 1
        print(f"  [{total:02d}/90] {path.name}")

    print(f"\n=== LISTO: {total} imágenes en '{CARPETA}' ===")
    print(f"  tela_limpia/   → 30 imágenes")
    print(f"  tela_mancha/   → 30 imágenes")
    print(f"  tela_rotura/   → 30 imágenes")


if __name__ == "__main__":
    main()
