import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function normalizarModo(modo) {
    const modoNormalizado = String(modo || "matricula").toLowerCase().trim();
    const modosValidos = new Set(["matricula", "estudiantes", "grupos", "profesores"]);
    return modosValidos.has(modoNormalizado) ? modoNormalizado : "matricula";
}

function construirCondicionesAsistencia(filtros = {}) {
    const { id_grupo, id_estudiante, fecha_inicio, fecha_fin, estado_asistencia, busqueda } = filtros;
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
        condiciones.push("a.fecha >= ?");
        valores.push(fecha_inicio);
    }

    if (fecha_fin) {
        condiciones.push("a.fecha <= ?");
        valores.push(fecha_fin);
    }

    if (estado_asistencia) {
        const estadoNormalizado = normalizarEstado(estado_asistencia);
        if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
            throw new Error("Estado de asistencia no válido. Usa presente, ausente, tardia o justificada.");
        }
        condiciones.push("a.estado_asistencia = ?");
        valores.push(estadoNormalizado);
    }

    if (busqueda && String(busqueda).trim()) {
        const textoBusqueda = `%${String(busqueda).trim()}%`;
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
        )`);
        valores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);
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
            mapa.set(key, {
                id_profesor: idProfesor,
                profesor_nombre: registro.profesor_nombre || "-",
                profesor_apellido1: registro.profesor_apellido1 || "",
                profesor_apellido2: registro.profesor_apellido2 || "",
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
        const nombreA = `${a.profesor_nombre ?? ""} ${a.profesor_apellido1 ?? ""} ${a.profesor_apellido2 ?? ""}`.trim();
        const nombreB = `${b.profesor_nombre ?? ""} ${b.profesor_apellido1 ?? ""} ${b.profesor_apellido2 ?? ""}`.trim();
        return nombreA.localeCompare(nombreB);
    });
}

export async function generarReporteCaso(filtros = {}) {
    const modo = normalizarModo(filtros.modo);
    const resumen = await generarReporteResumen(filtros);
    const detalle = await generarReporteDetalle(filtros);
    const detalleArray = Array.isArray(detalle?.detalle) ? detalle.detalle : Array.isArray(detalle) ? detalle : [];

    switch (modo) {
        case "estudiantes":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: construirDetallePorEstudiante(detalleArray),
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtros.id_grupo || "",
                    busqueda: filtros.busqueda || "",
                    estado_asistencia: filtros.estado_asistencia || "",
                    fecha_inicio: filtros.fecha_inicio || "",
                    fecha_fin: filtros.fecha_fin || ""
                }
            };
        case "profesores":
            return {
                modo,
                resumen: resumen?.resumen || {},
                detalle_por_grupo: construirDetallePorProfesor(detalleArray),
                detalle: detalleArray,
                filtros: {
                    id_grupo: filtros.id_grupo || "",
                    busqueda: filtros.busqueda || "",
                    estado_asistencia: filtros.estado_asistencia || "",
                    fecha_inicio: filtros.fecha_inicio || "",
                    fecha_fin: filtros.fecha_fin || ""
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
                    id_grupo: filtros.id_grupo || "",
                    busqueda: filtros.busqueda || "",
                    estado_asistencia: filtros.estado_asistencia || "",
                    fecha_inicio: filtros.fecha_inicio || "",
                    fecha_fin: filtros.fecha_fin || ""
                }
            };
    }
}

export async function generarReporteResumen(filtros = {}) {
    const modo = normalizarModo(filtros.modo);
    const { condiciones, valores } = construirCondicionesAsistencia(filtros);

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

    if (filtros.id_grupo) {
        grupoCondiciones.push("g.id_grupo = ?");
        grupoValores.push(Number(filtros.id_grupo));
    }

    if (filtros.id_estudiante) {
        grupoCondiciones.push("a.id_estudiante = ?");
        grupoValores.push(Number(filtros.id_estudiante));
    }

    if (filtros.busqueda && String(filtros.busqueda).trim()) {
        grupoCondiciones.push(`a.id_estudiante IN (
            SELECT e.id_estudiante
            FROM estudiante e
            INNER JOIN persona pe ON pe.id_persona = e.id_persona
            WHERE pe.nombre LIKE ?
               OR pe.apellido1 LIKE ?
               OR pe.apellido2 LIKE ?
               OR CAST(pe.id_persona AS CHAR) LIKE ?
               OR CAST(e.id_estudiante AS CHAR) LIKE ?
        )`);
        const textoBusqueda = `%${String(filtros.busqueda).trim()}%`;
        grupoValores.push(textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda, textoBusqueda);
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
    const modo = normalizarModo(filtros.modo);
    const { condiciones, valores } = construirCondicionesAsistencia(filtros);

    const [rows] = await pool.query(
        `SELECT
            a.fecha,
            a.estado_asistencia,
            a.observaciones,
            pe.nombre AS estudiante_nombre,
            pe.apellido1 AS estudiante_apellido1,
            pe.apellido2 AS estudiante_apellido2,
            g.nombre_grupo,
            pr.nombre AS profesor_nombre,
            pr.apellido1 AS profesor_apellido1
         FROM asistencia a
         INNER JOIN estudiante e ON e.id_estudiante = a.id_estudiante
         INNER JOIN persona pe ON pe.id_persona = e.id_persona
         INNER JOIN grupo g ON g.id_grupo = a.id_grupo
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