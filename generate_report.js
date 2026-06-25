/**
 * generate_report.js
 * Genera el informe técnico completo en formato Word (.docx) del sistema de
 * detección de defectos textiles usando OpenMP/MPI.
 *
 * Ejecutar con: node generate_report.js
 * Requiere: npm install docx (o npm install -g docx)
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageNumber, Header, Footer, LevelFormat, TableOfContents,
  PageBreak, ExternalHyperlink,
} = require("docx");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const t    = (text, opts = {}) => new TextRun({ text, ...opts });
const bold = (text, opts = {}) => t(text, { bold: true, ...opts });
const para  = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts });
const h1    = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, size: 32, color: "1e40af" })] });
const h2    = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, size: 26, color: "1e3a8a" })] });
const h3    = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, bold: true, size: 24, color: "374151" })] });
const sep   = ()    => new Paragraph({ children: [t("")], spacing: { after: 120 } });

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cell(text, { bold: isBold = false, shade = null, width = 3000, color = "1e293b" } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: isBold, color })],
    })],
  });
}

function row(cells) {
  return new TableRow({ children: cells });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [t(text)],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [t(text)],
  });
}

// ---------------------------------------------------------------------------
// Contenido del documento
// ---------------------------------------------------------------------------

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
      {
        reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
    ],
  },

  styles: {
    default: {
      document: { run: { font: "Arial", size: 24 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 32, bold: true, font: "Arial", color: "1e40af" },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0,
                     border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "3b82f6", space: 4 } } },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 26, bold: true, font: "Arial", color: "1e3a8a" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:       { size: 24, bold: true, font: "Arial", color: "374151" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
      },
    ],
  },

  sections: [
    // =========================================================
    // SECTION 1: CARATULA
    // =========================================================
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [t("Universidad San Ignacio de Loyola — Computación Paralela y Distribuida", { color: "64748b", size: 18 })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [t("Página ", { size: 20, color: "64748b" }), new TextRun({ children: [PageNumber.CURRENT], size: 20, color: "64748b" })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: [
        sep(), sep(), sep(),

        // Logo / identificador universidad
        new Paragraph({
          children: [bold("UNIVERSIDAD SAN IGNACIO DE LOYOLA", { size: 32, color: "1e40af" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }),
        new Paragraph({
          children: [t("Facultad de Ingeniería", { size: 26, color: "374151" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [t("Ingeniería de Software", { size: 26, color: "374151" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // Separador decorativo
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "3b82f6", space: 4 } },
          children: [t("")],
          spacing: { after: 400 },
        }),

        // Título
        new Paragraph({
          children: [bold(
            "Implementación de un Sistema Paralelo para la Detección de Defectos Visuales en Prendas Textiles mediante Procesamiento de Imágenes y OpenMP/MPI",
            { size: 32, color: "0f172a" }
          )],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // Avance
        new Paragraph({
          children: [t("Trabajo Final — Proyecto Integrador", { size: 24, color: "3b82f6", italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),

        sep(), sep(),

        // Datos del curso
        new Table({
          width: { size: 8000, type: WidthType.DXA },
          columnWidths: [2800, 5200],
          rows: [
            row([cell("Curso:",       { bold: true, shade: "EFF6FF", width: 2800 }), cell("Computación Paralela y Distribuida",                { width: 5200 })]),
            row([cell("Docente:",     { bold: true, shade: "EFF6FF", width: 2800 }), cell("MAMANI ALIAGA, Alvaro Henry",                       { width: 5200 })]),
            row([cell("Ciclo:",       { bold: true, shade: "EFF6FF", width: 2800 }), cell("2026-01",                                           { width: 5200 })]),
            row([cell("Sede:",        { bold: true, shade: "EFF6FF", width: 2800 }), cell("Lima, Peru",                                        { width: 5200 })]),
          ],
        }),

        sep(), sep(),
        h3("Integrantes:"),
        bullet("Alvarez Paetan, Juan de Dios"),
        bullet("Chavez Nunez, Alvaro Pedro"),
        bullet("Cornejo Condori, Bill Renzo"),
        bullet("Jara Leon, Joaquin Esteban"),
        bullet("Narvaez Garriazo, Cristel Margarita"),

        sep(), sep(), sep(),
        new Paragraph({ children: [t("Lima — Peru — 2026", { color: "64748b", size: 22 })], alignment: AlignmentType.CENTER }),

        // Salto de pagina
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // =========================================================
    // SECTION 2: CUERPO DEL INFORME
    // =========================================================
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [t("Sistema de Deteccion de Defectos Textiles — OpenMP/MPI", { color: "64748b", size: 18 })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [t("USIL — Computacion Paralela y Distribuida — 2026-01 | Pagina ", { size: 20, color: "64748b" }), new TextRun({ children: [PageNumber.CURRENT], size: 20, color: "64748b" })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: [
        // ── TABLA DE CONTENIDOS ──────────────────────────────
        h1("Tabla de Contenidos"),
        new TableOfContents("Tabla de Contenidos", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),

        // ── A. INTRODUCCION ──────────────────────────────────
        h1("a) Introduccion"),
        para([
          t("En la actualidad, la industria textil requiere procesos de control de calidad cada vez mas rapidos y precisos, debido a la alta demanda de produccion y a la necesidad de reducir errores antes de que las prendas lleguen al cliente final. La deteccion de defectos visuales en telas y prendas — manchas, irregularidades, diferencias de color, bordes defectuosos o fallas en la textura — es uno de los procesos mas criticos en la cadena de produccion.")
        ], { spacing: { after: 160 } }),
        para([
          t("El procesamiento secuencial de imagenes de alta resolucion genera cuellos de botella que ralentizan el ciclo de inspeccion. Segun Rasheed et al. (2020), las tecnicas de vision por computadora se usan ampliamente en la industria textil para detectar defectos mediante enfoques basados en color, segmentacion, textura y morfologia de imagenes.")
        ], { spacing: { after: 160 } }),
        para([
          t("El presente proyecto implementa un "),
          bold("sistema hibrido OpenMP + MPI"),
          t(" integrado en una arquitectura web completa (FastAPI + React) que permite subir imagenes de telas, ejecutar el motor de analisis paralelo en C++ y visualizar en tiempo real la mascara de defectos generada junto con las metricas de rendimiento."),
        ], { spacing: { after: 320 } }),

        // ── B. RESUMEN ───────────────────────────────────────
        h1("b) Resumen"),
        new Paragraph({
          children: [t("Este trabajo presenta el diseno e implementacion de un sistema de deteccion de defectos visuales en prendas textiles mediante computacion paralela. El motor de procesamiento esta desarrollado en C++17 con OpenCV para el tratamiento de imagenes, OpenMP para paralelismo a nivel de hilos (reduccion de intensidad y umbralización de pixeles) y MPI para la distribucion de tareas entre procesos bajo el esquema Round Robin. El sistema esta expuesto a traves de una API REST implementada en FastAPI (Python) y consumida por un dashboard en React/Vite con Tailwind CSS. Los resultados de cada analisis se almacenan en una base de datos SQLite y se presentan al usuario en una vista lado a lado de la imagen original versus la mascara de defectos, junto con metricas de tiempo, pixeles anomalos e intensidad media. El analisis teorico con la Ley de Amdahl (porcion paralela p=0.90) proyecta un speedup limite de 10x en sistemas con alta concurrencia.")],
          spacing: { after: 320 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "3b82f6", space: 8 } },
          indent: { left: 360 },
        }),

        // ── C. DESCRIPCION DEL CASO DE ESTUDIO ───────────────
        h1("c) Descripcion del Caso de Estudio"),
        h2("Contexto"),
        para([t("Se ha seleccionado el area de control de calidad de una empresa textil dedicada a la confeccion y comercializacion de prendas de vestir. Esta area se encarga de revisar visualmente las prendas antes de su distribucion, identificando defectos como manchas, variaciones de color, bordes irregulares y fallas en la textura.")], { spacing: { after: 160 } }),

        h2("Problematica"),
        para([t("Cuando se trabaja con imagenes de alta resolucion o con un gran numero de fotografias, el procesamiento secuencial se vuelve lento (analiza los pixeles uno por uno con un solo hilo). Esta situacion genera demoras en el control de calidad, puede retrasar la entrega de productos y permite que prendas con defectos lleguen al cliente final. Esta problematica se evidencia en iniciativas como el sistema WiseEye de la Hong Kong Polytechnic University, que busca automatizar el control de calidad textil mediante inteligencia artificial.")], { spacing: { after: 160 } }),

        h2("Necesidad"),
        para([t("Se requiere una solucion que permita dividir el procesamiento de imagenes entre varios hilos de ejecucion y multiples procesos. Para ello, se utiliza OpenMP (paralelismo de memoria compartida) y MPI (paralelismo de memoria distribuida), permitiendo procesar diferentes secciones de una imagen de forma simultanea y distribuir lotes de imagenes entre nodos de computo.")], { spacing: { after: 320 } }),

        // ── D. OBJETIVOS ─────────────────────────────────────
        h1("d) Objetivos"),
        h2("Objetivo General"),
        para([t("Implementar un sistema paralelo para la deteccion de defectos visuales en prendas textiles mediante procesamiento de imagenes y OpenMP/MPI, para reducir el tiempo de analisis en el area de control de calidad y mejorar la eficiencia en la identificacion de imperfecciones.")], { spacing: { after: 160 } }),
        h2("Objetivos Especificos"),
        numbered("Identificar los principales defectos visuales presentes en prendas textiles (manchas, variaciones de color, bordes irregulares, fallas en textura) para definir los criterios de deteccion del sistema."),
        numbered("Disenar una solucion computacional para el procesamiento de imagenes textiles en modo secuencial y paralelo, para establecer la estructura logica del sistema y comparar ambos enfoques."),
        numbered("Implementar el procesamiento paralelo con OpenMP, dividiendo la imagen en bloques de filas, para reducir el tiempo de analisis de imagenes de alta resolucion."),
        numbered("Distribuir el procesamiento de lotes de imagenes entre multiples procesos MPI bajo el esquema Round Robin para escalar horizontalmente el sistema."),
        numbered("Comparar los tiempos de ejecucion de la version secuencial y la paralela, utilizando imagenes de diferentes tamanos, para evaluar el impacto del paralelismo."),
        numbered("Exponer el motor HPC a traves de una API REST (FastAPI) con frontend React para facilitar su uso en entornos de produccion."),
        numbered("Validar la funcionalidad del sistema mediante casos de prueba con imagenes de telas limpias, con mancha y con rotura."),
        sep(),

        // ── E. DESCRIPCION DEL CASO DE ESTUDIO (Detalle) ─────
        h1("e) Descripcion del Caso de Estudio (Detalle tecnico)"),

        // ── F. DESARROLLO ─────────────────────────────────────
        h1("f) Desarrollo"),
        h2("g.i  Identificacion de Requerimientos"),
        h3("Requerimientos Funcionales"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1200, 2000, 6160],
          rows: [
            row([
              cell("ID",            { bold: true, shade: "1e40af", color: "FFFFFF", width: 1200 }),
              cell("Nombre",        { bold: true, shade: "1e40af", color: "FFFFFF", width: 2000 }),
              cell("Descripcion",   { bold: true, shade: "1e40af", color: "FFFFFF", width: 6160 }),
            ]),
            row([cell("RF-01", { width: 1200 }), cell("Carga de imagen",    { width: 2000 }), cell("El sistema permite subir imagenes JPG/PNG mediante drag & drop o seleccion de archivo.",  { width: 6160 })]),
            row([cell("RF-02", { width: 1200, shade: "F8FAFC" }), cell("Generacion de dataset", { width: 2000, shade: "F8FAFC" }), cell("Generacion de imagenes sinteticas con variaciones de brillo y ruido para pruebas.",       { width: 6160, shade: "F8FAFC" })]),
            row([cell("RF-03", { width: 1200 }), cell("Categorizacion",     { width: 2000 }), cell("Organizacion de imagenes en categorias: tela limpia, con mancha y con rotura.",            { width: 6160 })]),
            row([cell("RF-04", { width: 1200, shade: "F8FAFC" }), cell("Procesamiento lotes",  { width: 2000, shade: "F8FAFC" }), cell("Procesamiento individual o masivo de imagenes en una misma ejecucion.",                    { width: 6160, shade: "F8FAFC" })]),
            row([cell("RF-05", { width: 1200 }), cell("Preprocesamiento",   { width: 2000 }), cell("Conversion a escala de grises y Filtro Gaussiano 5x5 para reduccion de ruido.",           { width: 6160 })]),
            row([cell("RF-06", { width: 1200, shade: "F8FAFC" }), cell("Deteccion defectos",   { width: 2000, shade: "F8FAFC" }), cell("Analisis de intensidad de pixeles con umbral absoluto=40 y generacion de mascara binaria.", { width: 6160, shade: "F8FAFC" })]),
            row([cell("RF-07", { width: 1200 }), cell("Paralelismo OpenMP", { width: 2000 }), cell("Reduccion paralela del promedio y umbralización paralela de pixeles con directivas OMP.", { width: 6160 })]),
            row([cell("RF-08", { width: 1200, shade: "F8FAFC" }), cell("Distribucion MPI",     { width: 2000, shade: "F8FAFC" }), cell("Distribucion de imagenes entre procesos MPI bajo Round Robin.",                           { width: 6160, shade: "F8FAFC" })]),
            row([cell("RF-09", { width: 1200 }), cell("Imagenes salida",    { width: 2000 }), cell("Generacion de mascara binaria destacando zonas defectuosas en blanco sobre negro.",       { width: 6160 })]),
            row([cell("RF-10", { width: 1200, shade: "F8FAFC" }), cell("Metricas",             { width: 2000, shade: "F8FAFC" }), cell("Salida JSON con tiempo_ms, pixeles_anomalos, intensidad_promedio, speedup_amdahl.",       { width: 6160, shade: "F8FAFC" })]),
          ],
        }),
        sep(),

        h3("Requerimientos No Funcionales"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1200, 2000, 6160],
          rows: [
            row([
              cell("ID",          { bold: true, shade: "7c3aed", color: "FFFFFF", width: 1200 }),
              cell("Categoria",   { bold: true, shade: "7c3aed", color: "FFFFFF", width: 2000 }),
              cell("Descripcion", { bold: true, shade: "7c3aed", color: "FFFFFF", width: 6160 }),
            ]),
            row([cell("RNF-01",{ width:1200 }), cell("Rendimiento",   { width:2000 }), cell("Reduccion del tiempo de procesamiento mediante OpenMP y MPI vs. version secuencial.",         { width:6160 })]),
            row([cell("RNF-02",{ width:1200, shade:"F8FAFC" }), cell("Escalabilidad", { width:2000, shade:"F8FAFC" }), cell("Incremento de hilos OpenMP y procesos MPI segun capacidad del hardware.",                 { width:6160, shade:"F8FAFC" })]),
            row([cell("RNF-03",{ width:1200 }), cell("Usabilidad",    { width:2000 }), cell("Dashboard intuitivo con vista lado a lado (original vs. mascara) y tarjetas de metricas.",   { width:6160 })]),
            row([cell("RNF-04",{ width:1200, shade:"F8FAFC" }), cell("Portabilidad",  { width:2000, shade:"F8FAFC" }), cell("Ejecucion en cualquier sistema con Docker, C++17, OpenCV, OpenMP y MPI instalados.",      { width:6160, shade:"F8FAFC" })]),
            row([cell("RNF-05",{ width:1200 }), cell("Mantenibilidad",{ width:2000 }), cell("Codigo organizado en modulos reutilizables con comentarios explicativos en cada funcion.",   { width:6160 })]),
            row([cell("RNF-06",{ width:1200, shade:"F8FAFC" }), cell("Compatibilidad",{ width:2000, shade:"F8FAFC" }), cell("Compatible con formatos JPG y PNG. API REST versionada y documentada con Swagger.",         { width:6160, shade:"F8FAFC" })]),
          ],
        }),
        sep(),

        // ── g.ii ANALISIS DE HARDWARE ──────────────────────────
        h2("g.ii  Analisis de Hardware"),
        para([t("El experimento fue desarrollado en Google Colab y puede desplegarse localmente con Docker en cualquier equipo compatible. La siguiente tabla resume los recursos utilizados durante el desarrollo:")], { spacing: { after: 160 } }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3200, 6160],
          rows: [
            row([cell("Recurso",      { bold:true, shade:"1e40af", color:"FFFFFF", width:3200 }), cell("Especificacion",{ bold:true, shade:"1e40af", color:"FFFFFF", width:6160 })]),
            row([cell("CPU",          { width:3200 }), cell("Procesador virtual basado en Intel Xeon (Google Colab)",       { width:6160 })]),
            row([cell("Nucleos",      { width:3200, shade:"F8FAFC" }), cell("2 nucleos virtuales (entorno Colab); escala a N en produccion", { width:6160, shade:"F8FAFC" })]),
            row([cell("Memoria RAM",  { width:3200 }), cell("12 GB (Google Colab)",                                                         { width:6160 })]),
            row([cell("Almacenamiento",{ width:3200, shade:"F8FAFC" }), cell("Disco temporal en Colab; volumen Docker en despliegue local",  { width:6160, shade:"F8FAFC" })]),
            row([cell("Sistema Op.",  { width:3200 }), cell("Linux Ubuntu 22.04 (contenedor Docker)",                                       { width:6160 })]),
            row([cell("Arquitectura", { width:3200, shade:"F8FAFC" }), cell("x86_64",                                                       { width:6160, shade:"F8FAFC" })]),
            row([cell("Paralelismo",  { width:3200 }), cell("OpenMP (hilos) + MPI (procesos distribuidos)",                                 { width:6160 })]),
          ],
        }),
        sep(),

        // ── g.iii ANALISIS DE SOFTWARE ─────────────────────────
        h2("g.iii  Analisis de Software"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3200, 6160],
          rows: [
            row([cell("Software / Libreria",  { bold:true, shade:"1e40af", color:"FFFFFF", width:3200 }), cell("Funcion Principal", { bold:true, shade:"1e40af", color:"FFFFFF", width:6160 })]),
            row([cell("C++17",               { width:3200 }), cell("Lenguaje del motor HPC para logica de procesamiento de imagenes y metricas.", { width:6160 })]),
            row([cell("OpenMP",              { width:3200, shade:"F8FAFC" }), cell("Paralelismo de hilos: reduccion de suma (intensidad) y umbralización de pixeles.",         { width:6160, shade:"F8FAFC" })]),
            row([cell("MPI (Open MPI)",      { width:3200 }), cell("Paralelismo de procesos: distribucion Round Robin de imagenes entre nodos.",                   { width:6160 })]),
            row([cell("OpenCV 4",            { width:3200, shade:"F8FAFC" }), cell("Carga, conversion a grises, Filtro Gaussiano y escritura de mascaras.",                   { width:6160, shade:"F8FAFC" })]),
            row([cell("Python / FastAPI",    { width:3200 }), cell("API REST que orquesta el motor HPC via subprocess y expone los endpoints al frontend.",        { width:6160 })]),
            row([cell("SQLAlchemy + SQLite", { width:3200, shade:"F8FAFC" }), cell("ORM y base de datos embebida para persistir metricas de cada analisis.",                  { width:6160, shade:"F8FAFC" })]),
            row([cell("React 18 + Vite",     { width:3200 }), cell("Frontend SPA con dashboard, zona drag & drop y grafico de Ley de Amdahl.",                    { width:6160 })]),
            row([cell("Tailwind CSS",        { width:3200, shade:"F8FAFC" }), cell("Framework CSS utility-first para el estilo del dashboard.",                               { width:6160, shade:"F8FAFC" })]),
            row([cell("Docker / Compose",    { width:3200 }), cell("Contenedores para despliegue local reproducible del backend y frontend.",                     { width:6160 })]),
          ],
        }),
        sep(),

        // ── g.iv SOLUCION DEL CASO ────────────────────────────
        h2("g.iv  Solucion del Caso"),

        h3("Analisis y Descomposicion (Subcomponentes)"),
        para([
          t("El sistema se descompone en tres capas principales:"),
        ], { spacing: { after: 120 } }),
        bullet("Motor HPC (hpc_core/): binario C++ que ejecuta el algoritmo paralelo y emite JSON con metricas."),
        bullet("Orquestador Backend (backend/): FastAPI que recibe imagenes, invoca el motor HPC y persiste resultados."),
        bullet("Interfaz Frontend (frontend/): React SPA que provee la zona drag & drop, vista comparativa y grafico Amdahl."),
        sep(),

        h3("Diseno — Arquitectura del Sistema"),
        para([
          t("La arquitectura sigue el patron "),
          bold("Orquestador-Motor"),
          t(". El frontend envia la imagen al backend (REST HTTP), el backend la guarda y lanza el proceso "),
          bold("mpirun -np N textil_hibrido <entrada> <salida>"),
          t(", captura el JSON por stdout, actualiza la BD y devuelve la respuesta al frontend."),
        ], { spacing: { after: 160 } }),

        // Tabla de endpoints API
        h3("Documentacion de la API REST"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1400, 3000, 2200, 2760],
          rows: [
            row([
              cell("Metodo",     { bold:true, shade:"1e40af", color:"FFFFFF", width:1400 }),
              cell("Endpoint",   { bold:true, shade:"1e40af", color:"FFFFFF", width:3000 }),
              cell("Body/Params",{ bold:true, shade:"1e40af", color:"FFFFFF", width:2200 }),
              cell("Respuesta",  { bold:true, shade:"1e40af", color:"FFFFFF", width:2760 }),
            ]),
            row([cell("POST",{ width:1400 }), cell("/api/upload",             { width:3000 }), cell("multipart/form-data (image file)", { width:2200 }), cell("{ image_id, filename, message }",                         { width:2760 })]),
            row([cell("POST",{ width:1400, shade:"F8FAFC" }), cell("/api/analyze/{image_id}", { width:3000, shade:"F8FAFC" }), cell("?mpi_processes=2 (query param)",  { width:2200, shade:"F8FAFC" }), cell("AnalysisResponse: metricas completas",                    { width:2760, shade:"F8FAFC" })]),
            row([cell("GET", { width:1400 }), cell("/api/history",            { width:3000 }), cell("?limit=50 (opcional)",             { width:2200 }), cell("List[AnalysisResponse] ordenado desc.", { width:2760 })]),
            row([cell("GET", { width:1400, shade:"F8FAFC" }), cell("/api/health",             { width:3000, shade:"F8FAFC" }), cell("—",                               { width:2200, shade:"F8FAFC" }), cell("{ status, hpc_binary, timestamp }",                       { width:2760, shade:"F8FAFC" })]),
            row([cell("GET", { width:1400 }), cell("/uploads/{filename}",     { width:3000 }), cell("—",                               { width:2200 }), cell("Imagen original (estatico)",                              { width:2760 })]),
            row([cell("GET", { width:1400, shade:"F8FAFC" }), cell("/masks/{filename}",       { width:3000, shade:"F8FAFC" }), cell("—",                               { width:2200, shade:"F8FAFC" }), cell("Mascara de defectos (estatico)",                          { width:2760, shade:"F8FAFC" })]),
          ],
        }),
        sep(),

        h3("Implementacion — Motor HPC C++ (OpenMP + MPI)"),
        para([t("El algoritmo implementado en textil_hibrido.cpp sigue los siguientes pasos:")], { spacing: { after: 120 } }),
        numbered("Carga la imagen con OpenCV (IMREAD_COLOR)."),
        numbered("Convierte a escala de grises (cvtColor BGR2GRAY)."),
        numbered("Aplica Filtro Gaussiano 5x5 para reducir ruido de textura normal."),
        numbered("Calcula el promedio de intensidad usando reduccion OpenMP (#pragma omp parallel for reduction(+:suma))."),
        numbered("Genera la mascara binaria: si |pixel - promedio| > 40, marca como defecto (#pragma omp parallel for reduction(+:defectos))."),
        numbered("El proceso MPI 0 ejecuta el analisis y serializa las metricas en JSON por stdout."),
        numbered("El backend FastAPI parsea el JSON y actualiza la base de datos SQLite."),
        sep(),

        // ── ESTRATEGIA DE PARALELIZACION ────────────────────
        h2("Estrategia de Paralelizacion"),
        h3("OpenMP — Paralelismo de Datos"),
        para([
          t("Se utilizan dos directivas clave de OpenMP:"),
        ], { spacing: { after: 120 } }),
        bullet("#pragma omp parallel for reduction(+:suma) — Divide las filas de la imagen entre hilos; cada hilo acumula su suma local; la directiva reduction los combina al final sin condiciones de carrera."),
        bullet("#pragma omp parallel for reduction(+:defectos) — Umbralización paralela: cada hilo procesa un bloque de filas, compara cada pixel con el promedio global y escribe en su propia seccion de la mascara de salida."),
        sep(),

        h3("MPI — Distribucion de Tareas (Round Robin)"),
        para([
          t("Cada proceso MPI recibe un subconjunto de imagenes siguiendo el esquema "),
          bold("i % size == rank"),
          t(". Esto garantiza una distribucion equitativa sin comunicacion inter-proceso durante el procesamiento, reduciendo el overhead de MPI al minimo. Solo se utiliza MPI_Barrier para sincronizar la medicion del tiempo total."),
        ], { spacing: { after: 160 } }),

        h3("Analisis Teorico — Ley de Amdahl"),
        para([
          t("Con una porcion paralela p = 0.90 (el 90% del trabajo es el procesamiento pixel a pixel, clasificado como paralelizable), el speedup teorico segun la Ley de Amdahl es:"),
        ], { spacing: { after: 120 } }),
        para([
          bold("S(n) = 1 / ((1 - 0.90) + 0.90/n) = 1 / (0.10 + 0.90/n)"),
        ], { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
        new Table({
          width: { size: 7000, type: WidthType.DXA },
          columnWidths: [2000, 2500, 2500],
          rows: [
            row([cell("Nucleos (n)", { bold:true, shade:"1e40af", color:"FFFFFF", width:2000 }), cell("Speedup teorico", { bold:true, shade:"1e40af", color:"FFFFFF", width:2500 }), cell("Escenario",{ bold:true, shade:"1e40af", color:"FFFFFF", width:2500 })]),
            row([cell("1",  { width:2000 }), cell("1.00x", { width:2500 }), cell("Secuencial (referencia)",   { width:2500 })]),
            row([cell("2",  { width:2000, shade:"F8FAFC" }), cell("1.82x", { width:2500, shade:"F8FAFC" }), cell("Google Colab (2 nucleos)", { width:2500, shade:"F8FAFC" })]),
            row([cell("4",  { width:2000 }), cell("3.08x", { width:2500 }), cell("PC de escritorio tipica",   { width:2500 })]),
            row([cell("8",  { width:2000, shade:"F8FAFC" }), cell("4.71x", { width:2500, shade:"F8FAFC" }), cell("Servidor de 8 nucleos",    { width:2500, shade:"F8FAFC" })]),
            row([cell("64", { width:2000 }), cell("8.77x", { width:2500 }), cell("Servidor HPC de 64 nucleos",{ width:2500 })]),
            row([cell("∞",  { width:2000, shade:"F8FAFC" }), cell("10.00x (limite)", { width:2500, shade:"F8FAFC" }), cell("Limite asintótico de Amdahl", { width:2500, shade:"F8FAFC" })]),
          ],
        }),
        sep(),

        // ── PRUEBAS ──────────────────────────────────────────
        h3("Pruebas"),
        para([t("Se ejecutaron tres categorias de pruebas con el dataset sintetico generado (500 imagenes por categoria = 1500 total):")], { spacing: { after: 120 } }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 2400, 2400, 2160],
          rows: [
            row([
              cell("Imagen / Categoria",   { bold:true, shade:"1e40af", color:"FFFFFF", width:2400 }),
              cell("Intensidad Media",      { bold:true, shade:"1e40af", color:"FFFFFF", width:2400 }),
              cell("Pixeles Anomalos",      { bold:true, shade:"1e40af", color:"FFFFFF", width:2400 }),
              cell("Resultado",            { bold:true, shade:"1e40af", color:"FFFFFF", width:2160 }),
            ]),
            row([cell("tela_limpia.jpg",  { width:2400 }), cell("229.35",         { width:2400 }), cell("Bajo (tela uniforme)",     { width:2400 }), cell("Aprobada - sin defectos",      { width:2160 })]),
            row([cell("tela_mancha.jpg",  { width:2400, shade:"FEF3C7" }), cell("211.88",         { width:2400, shade:"FEF3C7" }), cell("Moderado (zona manchada)",   { width:2400, shade:"FEF3C7" }), cell("Detectada - mancha localizada", { width:2160, shade:"FEF3C7" })]),
            row([cell("tela_rotura.jpg",  { width:2400, shade:"FEE2E2" }), cell("133.64",         { width:2400, shade:"FEE2E2" }), cell("Alto (rotura severa)",       { width:2400, shade:"FEE2E2" }), cell("Detectada - defecto grave",     { width:2160, shade:"FEE2E2" })]),
            row([cell("1500 sinteticas",  { width:2400, shade:"F8FAFC" }), cell("Variable",        { width:2400, shade:"F8FAFC" }), cell("Distribucion automatica MPI",{ width:2400, shade:"F8FAFC" }), cell("Procesadas con 4 procesos MPI", { width:2160, shade:"F8FAFC" })]),
          ],
        }),
        sep(),

        // ── CONCLUSIONES ─────────────────────────────────────
        h1("h) Conclusiones"),
        numbered("Se implemento exitosamente un sistema hibrido OpenMP+MPI para deteccion de defectos textiles, con una arquitectura web completa (FastAPI + React) que facilita su uso en entornos de produccion."),
        numbered("El motor HPC demostro correcta deteccion de defectos en las tres categorias: telas limpias (baja anomalia), con mancha (anomalia moderada) y con rotura (alta anomalia)."),
        numbered("El analisis con la Ley de Amdahl (p=0.90) proyecta un speedup limite de 10x, con 1.82x en 2 nucleos (Colab) y 8.77x en servidores de 64 nucleos."),
        numbered("La combinacion de OpenMP (paralelismo intra-imagen) y MPI Round Robin (paralelismo inter-imagen) proporciona escalabilidad tanto vertical como horizontal."),
        numbered("La integracion del binario HPC en un microservicio FastAPI permite su despliegue reproducible via Docker, facilitando la adopcion en entornos de produccion sin requerir configuracion manual."),
        numbered("El dataset sintetico de 1500 imagenes con variaciones de brillo y ruido proporciona una base robusta para la validacion del sistema y futuras mejoras con modelos de deep learning."),
        sep(),

        // ── REFERENCIAS ──────────────────────────────────────
        h1("i) Referencias"),
        para([
          t("Rasheed, A., Zoso, A., Mok, P.Y., & Kwok, Y.L. (2020). Fabric defect detection using computer vision and machine learning. "),
          t("International Journal of Advanced Manufacturing Technology", { italics: true }),
          t(". Springer."),
        ], { spacing: { after: 120 } }),
        para([t("OpenMP Architecture Review Board. (2021). OpenMP Application Programming Interface, Version 5.2. https://www.openmp.org/specifications/")], { spacing: { after: 120 } }),
        para([t("Message Passing Interface Forum. (2021). MPI: A Message-Passing Interface Standard, Version 4.0. https://www.mpi-forum.org/")], { spacing: { after: 120 } }),
        para([t("Bradski, G. (2000). The OpenCV Library. Dr. Dobb's Journal of Software Tools.")], { spacing: { after: 120 } }),
        para([t("Amdahl, G.M. (1967). Validity of the Single-Processor Approach to Achieving Large-Scale Computing Capabilities. Proceedings of the AFIPS Spring Joint Computer Conference.")], { spacing: { after: 120 } }),
        para([t("Hong Kong Polytechnic University. (2022). WiseEye — Automated Textile Quality Control System. Institute of Textiles and Clothing.")], { spacing: { after: 120 } }),
        para([t("FastAPI Framework. (2024). FastAPI: Modern, fast web framework for building APIs with Python. https://fastapi.tiangolo.com/")], { spacing: { after: 120 } }),
        para([t("React Team. (2024). React: The library for web and native user interfaces. https://react.dev/")], { spacing: { after: 120 } }),
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Generar el archivo .docx
// ---------------------------------------------------------------------------
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = "Informe_Sistema_Textil.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Informe generado exitosamente: ${outputPath}`);
  console.log(`   Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => {
  console.error("❌ Error al generar el informe:", err);
  process.exit(1);
});
