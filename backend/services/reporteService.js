import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];
const MODOS_VALIDOS = new Set(["matricula", "estudiantes", "grupos", "profesores", "pre_matricula", "auditoria"]);
const TIPOS_REPORTE_VALIDOS = new Set(["resumen", "detalle", "individual", "grupo"]);

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function normalizarModo(modo) {
    const modoNormalizado = String(modo || "matricula").toLowerCase().trim();
    return MODOS_VALIDOS.has(modoNormalizado) ? modoNormalizado : "matricula";
}

function normalizarTipoReporte(tipoReporte) {
    const tipoNormalizado = String(tipoReporte || "resumen").toLowerCase().trim();
    return TIPOS_REPORTE_VALIDOS.has(tipoNormalizado) ? tipoNormalizado : "resumen";
}

function parsePositiveInt(value, nombreCampo) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const numero = Number(value);
    if (!Number.isInteger(numero) || numero <= 0) {
        throw new Error(`El campo ${nombreCampo} debe ser un identificador válido.`);
    }

    return numero;
}

function normalizarBusqueda(busqueda) {
    if (busqueda === undefined || busqueda === null || busqueda === "") {
        return "";
    }

    const texto = String(busqueda).trim();
    if (texto.length === 0) {
        return "";
    }

    if (texto.length > 120) {
        throw new Error("La búsqueda no puede superar 120 caracteres.");
    }

    return texto;
}

function normalizarFechaISO(fecha, nombreCampo) {
    if (fecha === undefined || fecha === null || fecha === "") {
        return "";
    }

    const fechaTexto = String(fecha).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
        throw new Error(`La fecha ${nombreCampo} debe tener el formato YYYY-MM-DD.`);
    }

    const valorFecha = new Date(`${fechaTexto}T00:00:00`);
    if (Number.isNaN(valorFecha.getTime())) {
        throw new Error(`La fecha ${nombreCampo} no es una fecha válida.`);
    }

    return fechaTexto;
}

function validarFiltrosReporte(filtros = {}) {
    const modo = normalizarModo(filtros.modo);
    const tipoReporte = normalizarTipoReporte(filtros.tipo_reporte || filtros.tipoReporte);
    const id_grupo = parsePositiveInt(filtros.id_grupo, "id_grupo");
    const id_estudiante = parsePositiveInt(filtros.id_estudiante, "id_estudiante");

    const fecha_inicio = normalizarFechaISO(filtros.fecha_inicio, "fecha_inicio");
    const fecha_fin = normalizarFechaISO(filtros.fecha_fin, "fecha_fin");

    if (fecha_inicio && fecha_fin && new Date(`${fecha_inicio}T00:00:00`) > new Date(`${fecha_fin}T00:00:00`)) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    const estadoSolicitado = normalizarEstado(filtros.estado_asistencia ?? filtros.estado ?? "");
    if (estadoSolicitado && !ESTADOS_VALIDOS.includes(estadoSolicitado)) {
        throw new Error("Estado de asistencia no válido. Usa presente, ausente, tardia o justificada.");
    }

    const busqueda = normalizarBusqueda(filtros.busqueda);

    return {
        modo,
        tipo_reporte: tipoReporte,
        id_grupo,
        id_estudiante,
        fecha_inicio,
        fecha_fin,
        estado_asistencia: estadoSolicitado || "",
        busqueda
    };
}

function construirCondicionesAsistencia(filtros = {}) {
    const {
        modo,
        id_grupo,
        id_estudiante,
        fecha_inicio,
        fecha_fin,
        estado_asistencia,
        busqueda
    } = filtros;

    const condiciones = ["a.estado = TRUE"];
    const valores = [];

    if (id_grupo) {
        condiciones.push("a.id_grupo = ?");
        valores.push(Number(id_grupo));
    }

    if (id_estudiante) {
        condiciones.push("a.id_estudiante = ?");
        valores.push(Number(id_estudiante));
    }

    if (fecha_inicio) {
        condiciones.push("DATE(a.fecha) >= ?");
        valores.push(fecha_inicio);
    }

    if (fecha_fin) {
        condiciones.push("DATE(a.fecha) <= ?");
        valores.push(fecha_fin);
    }

    if (estado_asistencia) {
        condiciones.push("a.estado_asistencia = ?");
        valores.push(estado_asistencia);
    }

    if (busqueda && String(busqueda).trim()) {
        const textoBusqueda = `%${String(busqueda).trim()}%`;

        const incluirProfesorEnBusqueda = modo !== "matricula";

        if (!incluirProfesorEnBusqueda) {
            condiciones.push(`
                a.id_estudiante IN (
                    SELECT e.id_estudiante
                    FROM estudiante e
                    INNER JOIN persona pe ON pe.id_persona = e.id_persona
                    WHERE pe.nombre LIKE ?
                       OR pe.apellido1 LIKE ?
                       OR pe.apellido2 LIKE ?
                       OR CAST(pe.id_persona AS CHAR) LIKE ?
                       OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
            `);
            valores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);

            // En modo matricula se excluyen coincidencias por profesor para evitar
            // que un nombre docente arrastre estudiantes asociados.
            condiciones.push(`
                a.id_profesor NOT IN (
                    SELECT prof.id_profesor
                    FROM profesor prof
                    INNER JOIN persona pp ON pp.id_persona = prof.id_persona
                    WHERE pp.nombre LIKE ?
                       OR pp.apellido1 LIKE ?
                       OR pp.apellido2 LIKE ?
                       OR CAST(pp.id_persona AS CHAR) LIKE ?
                       OR CAST(prof.id_profesor AS CHAR) LIKE ?
                )
            `);
            valores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);
        } else {
            condiciones.push(`(
                a.id_estudiante IN (
                    SELECT e.id_estudiante
                    FROM estudiante e
                    INNER JOIN persona pe ON pe.id_persona = e.id_persona
                    WHERE pe.nombre LIKE ?
                       OR pe.apellido1 LIKE ?
                       OR pe.apellido2 LIKE ?
                       OR CAST(pe.id_persona AS CHAR) LIKE ?
                       OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
                OR a.id_profesor IN (
                    SELECT prof.id_profesor
                    FROM profesor prof
                    INNER JOIN persona pp ON pp.id_persona = prof.id_persona
                    WHERE pp.nombre LIKE ?
                       OR pp.apellido1 LIKE ?
                       OR pp.apellido2 LIKE ?
                       OR CAST(pp.id_persona AS CHAR) LIKE ?
                       OR CAST(prof.id_profesor AS CHAR) LIKE ?
                )
            )`);
            valores.push(
                textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda,
                textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda
            );
        }
    }

    return { condiciones, valores };
}

function construirDetallePorEstudiante(detalle = []) {
    const mapa = new Map();

    detalle.forEach((registro) => {
        const idEstudiante = registro.id_estudiante ?? registro.estudiante_id ?? "sin-id";
        const key = `estudiante-${idEstudiante}`;
        if (!mapa.has(key)) {
            mapa.set(key, {
                id_estudiante: idEstudiante,
                estudiante_nombre: registro.estudiante_nombre || "-",
                estudiante_apellido1: registro.estudiante_apellido1 || "",
                estudiante_apellido2: registro.estudiante_apellido2 || "",
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                grupo: registro.nombre_grupo || "-"
            });
        }

        const acumulado = mapa.get(key);
        acumulado.asistencias_registradas += 1;
        const estado = String(registro.estado_asistencia || "").toLowerCase();
        if (estado === "presente") acumulado.presentes += 1;
        if (estado === "ausente") acumulado.ausentes += 1;
        if (estado === "tardia") acumulado.tardias += 1;
        if (estado === "justificada") acumulado.justificadas += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => {
        const nombreA = `${a.estudiante_nombre ?? ""} ${a.estudiante_apellido1 ?? ""} ${a.estudiante_apellido2 ?? ""}`.trim();
        const nombreB = `${b.estudiante_nombre ?? ""} ${b.estudiante_apellido1 ?? ""} ${b.estudiante_apellido2 ?? ""}`.trim();
        return nombreA.localeCompare(nombreB);
    });
}

function construirDetallePorProfesor(detalle = []) {
    const mapa = new Map();

    detalle.forEach((registro) => {
        const idProfesor = registro.id_profesor ?? registro.profesor_id ?? "sin-id";
        const key = `profesor-${idProfesor}`;
        if (!mapa.has(key)) {
            const profesorEstado = registro.profesor_estado ?? registro.estado ?? registro.estado_profesor ?? 1;
            const materia = registro.materia_curso || registro.materia || registro.materia_profesor || "-";
            mapa.set(key, {
                id_profesor: idProfesor,
                profesor_nombre: registro.profesor_nombre || "-",
                profesor_apellido1: registro.profesor_apellido1 || "",
                profesor_apellido2: registro.profesor_apellido2 || "",
                materia: materia,
                estado: Number(profesorEstado) === 0 || String(profesorEstado).toLowerCase() === "inactivo" ? "Inactivo" : "Activo",
                grupos_asignados: [],
                secciones_asignadas: [],
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                grupo: registro.nombre_grupo || "-",
                seccion: registro.nombre_seccion || "-"
            });
        }

        const acumulado = mapa.get(key);
        acumulado.asistencias_registradas += 1;
        const grupoNombre = registro.nombre_grupo || "-";
        if (grupoNombre && grupoNombre !== "-" && !acumulado.grupos_asignados.includes(grupoNombre)) {
            acumulado.grupos_asignados.push(grupoNombre);
        }

        const seccionNombre = registro.nombre_seccion || "-";
        if (seccionNombre && seccionNombre !== "-" && !acumulado.secciones_asignadas.includes(seccionNombre)) {
            acumulado.secciones_asignadas.push(seccionNombre);
        }

        const estado = String(registro.estado_asistencia || "").toLowerCase();
        if (estado === "presente") acumulado.presentes += 1;
        if (estado === "ausente") acumulado.ausentes += 1;
        if (estado === "tardia") acumulado.tardias += 1;
        if (estado === "justificada") acumulado.justificadas += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => {
        const nombreA = `${a.profesor_nombre ?? ""} ${a.profesor_apellido1 ?? ""} ${a.profesor_apellido2 ?? ""}`.trim();
        const nombreB = `${b.profesor_nombre ?? ""} ${b.profesor_apellido1 ?? ""} ${b.profesor_apellido2 ?? ""}`.trim();
        return nombreA.localeCompare(nombreB);
    }).map((profesor) => ({
        ...profesor,
        grupos: profesor.grupos_asignados.join(", ") || profesor.grupo || "-",
        secciones: profesor.secciones_asignadas.join(", ") || profesor.seccion || "-"
    }));
}

export async function generarReporteCaso(filtros = {}) {
    const filtrosNormalizados = validarFiltrosReporte(filtros);
    const modo = filtrosNormalizados.modo;

    const resumen = await generarReporteResumen(filtrosNormalizados);
    const detalle = await generarReporteDetalle(filtrosNormalizados);
    const detalleArray = Array.isArray(detalle?.detalle) ? detalle.detalle : Array.isArray(detalle) ? detalle : [];

    switch (modo) {
        case "estudiantes":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: construirDetallePorEstudiante(detalleArray),
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtrosNormalizados.id_grupo || "",
                    id_estudiante: filtrosNormalizados.id_estudiante || "",
                    busqueda: filtrosNormalizados.busqueda || "",
                    estado_asistencia: filtrosNormalizados.estado_asistencia || "",
                    fecha_inicio: filtrosNormalizados.fecha_inicio || "",
                    fecha_fin: filtrosNormalizados.fecha_fin || ""
                }
            };
        case "profesores":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: construirDetallePorProfesor(detalleArray),
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtrosNormalizados.id_grupo || "",
                    id_estudiante: filtrosNormalizados.id_estudiante || "",
                    busqueda: filtrosNormalizados.busqueda || "",
                    estado_asistencia: filtrosNormalizados.estado_asistencia || "",
                    fecha_inicio: filtrosNormalizados.fecha_inicio || "",
                    fecha_fin: filtrosNormalizados.fecha_fin || ""
                }
            };
        case "pre_matricula":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: resumen?.detalle_por_grupo || [],
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtrosNormalizados.id_grupo || "",
                    id_estudiante: filtrosNormalizados.id_estudiante || "",
                    busqueda: filtrosNormalizados.busqueda || "",
                    estado_asistencia: filtrosNormalizados.estado_asistencia || "",
                    fecha_inicio: filtrosNormalizados.fecha_inicio || "",
                    fecha_fin: filtrosNormalizados.fecha_fin || ""
                }
            };
        case "auditoria":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: resumen?.detalle_por_grupo || [],
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtrosNormalizados.id_grupo || "",
                    id_estudiante: filtrosNormalizados.id_estudiante || "",
                    busqueda: filtrosNormalizados.busqueda || "",
                    estado_asistencia: filtrosNormalizados.estado_asistencia || "",
                    fecha_inicio: filtrosNormalizados.fecha_inicio || "",
                    fecha_fin: filtrosNormalizados.fecha_fin || ""
                }
            };
        case "grupos":
        case "matricula":
        default:
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: resumen?.detalle_por_grupo || [],
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtrosNormalizados.id_grupo || "",
                    id_estudiante: filtrosNormalizados.id_estudiante || "",
                    busqueda: filtrosNormalizados.busqueda || "",
                    estado_asistencia: filtrosNormalizados.estado_asistencia || "",
                    fecha_inicio: filtrosNormalizados.fecha_inicio || "",
                    fecha_fin: filtrosNormalizados.fecha_fin || ""
                }
            };
    }
}

export async function generarReporteResumen(filtros = {}) {
    const filtrosNormalizados = validarFiltrosReporte(filtros);
    const modo = filtrosNormalizados.modo;

    if (modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda && String(filtrosNormalizados.busqueda).trim()) {
            condiciones.push(`(
                pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ? OR CAST(pe.id_persona AS CHAR) LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?
            )`);
            const texto = `%${String(filtrosNormalizados.busqueda).trim()}%`;
            valores.push(texto, texto, texto, texto, texto);
        }

        const where = condiciones.length ? `AND ${condiciones.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `SELECT
                e.id_estudiante,
                pe.nombre,
                pe.apellido1,
                pe.apellido2,
                e.estado
             FROM estudiante e
             INNER JOIN persona pe ON pe.id_persona = e.id_persona
             WHERE e.estado = TRUE
               AND NOT EXISTS (
                   SELECT 1 FROM grupo_estudiante ge
                   WHERE ge.id_estudiante = e.id_estudiante
                     AND ge.estado = TRUE
               )
               ${where}
             ORDER BY e.id_estudiante DESC
             LIMIT 500`,
            valores
        );

        return {
            modo,
            resumen: {
                total_estudiantes: Number(rows.length || 0),
                total_pre_matriculas: Number(rows.length || 0),
                total_asistencias: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                tasa_presentismo: 0
            },
            detalle_por_grupo: [
                {
                    tipo: "pre_matricula",
                    total_pre_matriculas: Number(rows.length || 0),
                    total_estudiantes_activos: Number(rows.length || 0)
                }
            ]
        };
    }

    if (modo === "auditoria") {
        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total_auditorias
             FROM auditoria`
        );

        return {
            modo,
            resumen: {
                total_auditorias: Number(rows[0]?.total_auditorias || 0),
                total_registros: Number(rows[0]?.total_auditorias || 0),
                total_asistencias: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                tasa_presentismo: 0
            },
            detalle_por_grupo: [
                {
                    tipo: "auditoria",
                    total_auditorias: Number(rows[0]?.total_auditorias || 0)
                }
            ]
        };
    }

    const { condiciones, valores } = construirCondicionesAsistencia(filtrosNormalizados);

    const [totales] = await pool.query(
        `SELECT
            SUM(CASE WHEN a.estado_asistencia = 'presente' THEN 1 ELSE 0 END) AS presentes,
            SUM(CASE WHEN a.estado_asistencia = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
            SUM(CASE WHEN a.estado_asistencia = 'tardia' THEN 1 ELSE 0 END) AS tardias,
            SUM(CASE WHEN a.estado_asistencia = 'justificada' THEN 1 ELSE 0 END) AS justificadas,
            COUNT(*) AS total_asistencias
         FROM asistencia a
         WHERE ${condiciones.join(" AND ")}`,
        valores
    );

    const [totalesSistema] = await pool.query(
        `SELECT
            (SELECT COUNT(*) FROM estudiante WHERE estado = TRUE) AS total_estudiantes,
            (SELECT COUNT(*) FROM profesor WHERE estado = TRUE) AS total_profesores,
            (SELECT COUNT(*) FROM grupo WHERE estado = TRUE) AS total_grupos,
            (SELECT COUNT(*) FROM matricula WHERE estado_matricula = 'activa') AS total_matriculas`
    );

    const grupoCondiciones = ["g.estado = TRUE"];
    const grupoValores = [];

    if (filtrosNormalizados.id_grupo) {
        grupoCondiciones.push("g.id_grupo = ?");
        grupoValores.push(Number(filtrosNormalizados.id_grupo));
    }

    if (filtrosNormalizados.id_estudiante) {
        grupoCondiciones.push("a.id_estudiante = ?");
        grupoValores.push(Number(filtrosNormalizados.id_estudiante));
    }

    if (filtrosNormalizados.fecha_inicio) {
        grupoCondiciones.push("DATE(a.fecha) >= ?");
        grupoValores.push(filtrosNormalizados.fecha_inicio);
    }

    if (filtrosNormalizados.fecha_fin) {
        grupoCondiciones.push("DATE(a.fecha) <= ?");
        grupoValores.push(filtrosNormalizados.fecha_fin);
    }

    if (filtrosNormalizados.estado_asistencia) {
        grupoCondiciones.push("a.estado_asistencia = ?");
        grupoValores.push(filtrosNormalizados.estado_asistencia);
    }

    if (filtrosNormalizados.busqueda && String(filtrosNormalizados.busqueda).trim()) {
        const textoBusqueda = `%${String(filtrosNormalizados.busqueda).trim()}%`;
        const incluirProfesorEnBusqueda = filtrosNormalizados.modo !== "matricula";

        if (!incluirProfesorEnBusqueda) {
            grupoCondiciones.push(`
                a.id_estudiante IN (
                    SELECT e.id_estudiante
                    FROM estudiante e
                    INNER JOIN persona pe ON pe.id_persona = e.id_persona
                    WHERE pe.nombre LIKE ?
                       OR pe.apellido1 LIKE ?
                       OR pe.apellido2 LIKE ?
                       OR CAST(pe.id_persona AS CHAR) LIKE ?
                       OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
            `);
            grupoValores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);

            grupoCondiciones.push(`
                a.id_profesor NOT IN (
                    SELECT prof.id_profesor
                    FROM profesor prof
                    INNER JOIN persona pp ON pp.id_persona = prof.id_persona
                    WHERE pp.nombre LIKE ?
                       OR pp.apellido1 LIKE ?
                       OR pp.apellido2 LIKE ?
                       OR CAST(pp.id_persona AS CHAR) LIKE ?
                       OR CAST(prof.id_profesor AS CHAR) LIKE ?
                )
            `);
            grupoValores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);
        } else {
            grupoCondiciones.push(`(
                a.id_estudiante IN (
                    SELECT e.id_estudiante
                    FROM estudiante e
                    INNER JOIN persona pe ON pe.id_persona = e.id_persona
                    WHERE pe.nombre LIKE ?
                       OR pe.apellido1 LIKE ?
                       OR pe.apellido2 LIKE ?
                       OR CAST(pe.id_persona AS CHAR) LIKE ?
                       OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
                OR a.id_profesor IN (
                    SELECT prof.id_profesor
                    FROM profesor prof
                    INNER JOIN persona pp ON pp.id_persona = prof.id_persona
                    WHERE pp.nombre LIKE ?
                       OR pp.apellido1 LIKE ?
                       OR pp.apellido2 LIKE ?
                       OR CAST(pp.id_persona AS CHAR) LIKE ?
                       OR CAST(prof.id_profesor AS CHAR) LIKE ?
                )
            )`);
            grupoValores.push(
                textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda,
                textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda
            );
        }
    }

    const [detallePorGrupo] = await pool.query(
        `SELECT
            g.id_grupo,
            g.nombre_grupo,
            s.nombre_seccion,
            s.nivel,
            fn_estudiantes_grupo(g.id_grupo) AS ocupados,
            g.capacidad,
            COUNT(a.id_asistencia) AS asistencias_registradas,
            SUM(CASE WHEN a.estado_asistencia = 'presente' THEN 1 ELSE 0 END) AS presentes,
            SUM(CASE WHEN a.estado_asistencia = 'ausente' THEN 1 ELSE 0 END) AS ausentes
         FROM grupo g
         INNER JOIN seccion s ON s.id_seccion = g.id_seccion
         LEFT JOIN asistencia a ON a.id_grupo = g.id_grupo AND a.estado = TRUE
         WHERE ${grupoCondiciones.join(" AND ")}
         GROUP BY g.id_grupo, g.nombre_grupo, s.nombre_seccion, s.nivel, g.capacidad
         ORDER BY g.nombre_grupo`,
        grupoValores
    );

    const base = totalesSistema[0] || {};
    const metricas = totales[0] || {};
    const totalAsistencias = Number(metricas.total_asistencias || 0);
    const presentes = Number(metricas.presentes || 0);
    const tasaPresentismo = totalAsistencias > 0 ? Math.round((presentes / totalAsistencias) * 100) : 0;

    return {
        modo,
        resumen: {
            total_estudiantes: Number(base.total_estudiantes || 0),
            total_profesores: Number(base.total_profesores || 0),
            total_grupos: Number(base.total_grupos || 0),
            total_asistencias: totalAsistencias,
            presentes,
            ausentes: Number(metricas.ausentes || 0),
            tardias: Number(metricas.tardias || 0),
            justificadas: Number(metricas.justificadas || 0),
            total_matriculas: Number(base.total_matriculas || 0),
            tasa_presentismo: tasaPresentismo
        },
        detalle_por_grupo: detallePorGrupo
    };
}

export async function generarReporteDetalle(filtros = {}) {
    const filtrosNormalizados = validarFiltrosReporte(filtros);
    const modo = filtrosNormalizados.modo;

    if (modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda && String(filtrosNormalizados.busqueda).trim()) {
            condiciones.push(`(
                pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ? OR CAST(pe.id_persona AS CHAR) LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?
            )`);
            const texto = `%${String(filtrosNormalizados.busqueda).trim()}%`;
            valores.push(texto, texto, texto, texto, texto);
        }

        const where = condiciones.length ? `AND ${condiciones.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `SELECT
                e.id_estudiante,
                pe.nombre AS estudiante_nombre,
                pe.apellido1 AS estudiante_apellido1,
                pe.apellido2 AS estudiante_apellido2,
                e.estado,
                NULL AS nombre_grupo,
                NULL AS profesor_nombre,
                NULL AS estado_asistencia,
                'Pendiente' AS estado_matricula,
                'Pre-matrícula' AS tipo_reporte
             FROM estudiante e
             INNER JOIN persona pe ON pe.id_persona = e.id_persona
             WHERE e.estado = TRUE
               AND NOT EXISTS (
                   SELECT 1 FROM grupo_estudiante ge
                   WHERE ge.id_estudiante = e.id_estudiante
                     AND ge.estado = TRUE
               )
               ${where}
             ORDER BY e.id_estudiante DESC
             LIMIT 500`,
            valores
        );

        return {
            modo,
            detalle: rows
        };
    }

    if (modo === "auditoria") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda && String(filtrosNormalizados.busqueda).trim()) {
            condiciones.push(`(
                a.nombre_tabla LIKE ? OR a.accion_usuario LIKE ? OR a.datos_nuevos LIKE ? OR CAST(a.id_usuario AS CHAR) LIKE ?
            )`);
            const texto = `%${String(filtrosNormalizados.busqueda).trim()}%`;
            valores.push(texto, texto, texto, texto);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `SELECT
                a.id_auditoria,
                a.nombre_tabla,
                a.accion_usuario,
                a.datos_anteriores,
                a.datos_nuevos,
                a.fecha_creacion,
                a.fecha_modificacion,
                a.id_usuario,
                u.nombre_usuario AS usuario_nombre
             FROM auditoria a
             LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
             ${where}
             ORDER BY a.fecha_creacion DESC
             LIMIT 500`,
            valores
        );

        return {
            modo,
            detalle: rows
        };
    }

    const { condiciones, valores } = construirCondicionesAsistencia(filtrosNormalizados);

    const [rows] = await pool.query(
        `SELECT
            a.id_asistencia,
            a.fecha,
            a.id_estudiante,
            a.id_profesor,
            a.estado_asistencia,
            a.observaciones,
            pe.nombre AS estudiante_nombre,
            pe.apellido1 AS estudiante_apellido1,
            pe.apellido2 AS estudiante_apellido2,
            g.nombre_grupo,
            s.nombre_seccion,
            pr.nombre AS profesor_nombre,
            pr.apellido1 AS profesor_apellido1,
            pr.apellido2 AS profesor_apellido2,
            prof.materia AS materia_curso,
            prof.estado AS profesor_estado
         FROM asistencia a
         INNER JOIN estudiante e ON e.id_estudiante = a.id_estudiante
         INNER JOIN persona pe ON pe.id_persona = e.id_persona
         INNER JOIN grupo g ON g.id_grupo = a.id_grupo
         INNER JOIN seccion s ON s.id_seccion = g.id_seccion
         INNER JOIN profesor prof ON prof.id_profesor = a.id_profesor
         INNER JOIN persona pr ON pr.id_persona = prof.id_persona
         WHERE ${condiciones.join(" AND ")}
         ORDER BY a.fecha DESC, a.id_asistencia DESC
         LIMIT 500`,
        valores
    );

    return {
        modo,
        detalle: rows
    };
}