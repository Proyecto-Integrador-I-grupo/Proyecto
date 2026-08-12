import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];
const MODOS_VALIDOS = new Set([
    "matricula",
    "estudiantes",
    "grupos",
    "profesores",
    "pre_matricula",
    "auditoria"
]);
const TIPOS_VALIDOS = new Set(["resumen", "detalle", "individual", "grupo"]);

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function normalizarModo(modo) {
    const value = String(modo || "matricula").toLowerCase().trim();
    return MODOS_VALIDOS.has(value) ? value : "matricula";
}

function normalizarTipoReporte(tipo) {
    const value = String(tipo || "resumen").toLowerCase().trim();
    return TIPOS_VALIDOS.has(value) ? value : "resumen";
}

function parsePositiveInt(value, field) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        throw new Error(`El campo ${field} debe ser un identificador válido.`);
    }
    return number;
}

function normalizarFecha(value, field) {
    if (value === undefined || value === null || value === "") return "";
    const text = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        throw new Error(`La fecha ${field} debe tener el formato YYYY-MM-DD.`);
    }
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`La fecha ${field} no es válida.`);
    }
    return text;
}

function validarFiltros(filtros = {}) {
    const modo = normalizarModo(filtros.modo);
    const tipo_reporte = normalizarTipoReporte(filtros.tipo_reporte || filtros.tipoReporte);
    const id_grupo = parsePositiveInt(filtros.id_grupo, "id_grupo");
    const id_estudiante = parsePositiveInt(filtros.id_estudiante, "id_estudiante");
    const fecha_inicio = normalizarFecha(filtros.fecha_inicio, "fecha_inicio");
    const fecha_fin = normalizarFecha(filtros.fecha_fin, "fecha_fin");

    if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    const estado_asistencia = normalizarEstado(filtros.estado_asistencia ?? filtros.estado ?? "");
    if (estado_asistencia && !ESTADOS_VALIDOS.includes(estado_asistencia)) {
        throw new Error("Estado de asistencia no válido.");
    }

    const busqueda = String(filtros.busqueda ?? "").trim();
    if (busqueda.length > 120) {
        throw new Error("La búsqueda no puede superar 120 caracteres.");
    }

    return {
        modo,
        tipo_reporte,
        id_grupo,
        id_estudiante,
        fecha_inicio,
        fecha_fin,
        estado_asistencia,
        busqueda
    };
}

function addPersonSearch(conditions, values, search, mode) {
    if (!search) return;

    const text = `%${search}%`;
    const student = `
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
    `;
    const professor = `
        a.id_profesor IN (
            SELECT prof.id_profesor
            FROM profesor prof
            INNER JOIN persona pp ON pp.id_persona = prof.id_persona
            WHERE pp.nombre LIKE ?
               OR pp.apellido1 LIKE ?
               OR pp.apellido2 LIKE ?
               OR CAST(pp.id_persona AS CHAR) LIKE ?
               OR CAST(prof.id_profesor AS CHAR) LIKE ?
        )
    `;

    if (mode === "profesores") {
        conditions.push(professor);
        values.push(text, text, text, text, text);
    } else if (mode === "estudiantes" || mode === "pre_matricula") {
        conditions.push(student);
        values.push(text, text, text, text, text);
    } else if (mode === "matricula") {
        conditions.push(student);
        values.push(text, text, text, text, text);
        conditions.push(`NOT (${professor.replace(/^a\.id_profesor IN/, "a.id_profesor IN")})`);
        values.push(text, text, text, text, text);
    } else {
        conditions.push(`(${student} OR ${professor})`);
        values.push(
            text, text, text, text, text,
            text, text, text, text, text
        );
    }
}

function construirCondicionesAsistencia(filtros) {
    const conditions = ["a.estado = TRUE"];
    const values = [];

    if (filtros.id_grupo) {
        conditions.push("a.id_grupo = ?");
        values.push(filtros.id_grupo);
    }

    if (filtros.id_estudiante) {
        conditions.push("a.id_estudiante = ?");
        values.push(filtros.id_estudiante);
    }

    if (filtros.fecha_inicio) {
        conditions.push("DATE(a.fecha) >= ?");
        values.push(filtros.fecha_inicio);
    }

    if (filtros.fecha_fin) {
        conditions.push("DATE(a.fecha) <= ?");
        values.push(filtros.fecha_fin);
    }

    if (filtros.estado_asistencia) {
        conditions.push("a.estado_asistencia = ?");
        values.push(filtros.estado_asistencia);
    }

    addPersonSearch(conditions, values, filtros.busqueda, filtros.modo);

    return { conditions, values };
}

function construirDetallePorEstudiante(detalle) {
    const map = new Map();

    for (const row of detalle) {
        const id = row.id_estudiante ?? "sin-id";
        if (!map.has(id)) {
            map.set(id, {
                id_estudiante: id,
                estudiante_nombre: row.estudiante_nombre || "-",
                estudiante_apellido1: row.estudiante_apellido1 || "",
                estudiante_apellido2: row.estudiante_apellido2 || "",
                grupo: row.nombre_grupo || "-",
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const item = map.get(id);
        item.asistencias_registradas += 1;
        const estado = normalizarEstado(row.estado_asistencia);
        if (estado === "presente") item.presentes += 1;
        if (estado === "ausente") item.ausentes += 1;
        if (estado === "tardia") item.tardias += 1;
        if (estado === "justificada") item.justificadas += 1;
    }

    return [...map.values()].sort((a, b) =>
        `${a.estudiante_nombre} ${a.estudiante_apellido1}`.localeCompare(
            `${b.estudiante_nombre} ${b.estudiante_apellido1}`
        )
    );
}

function construirDetallePorProfesor(detalle) {
    const map = new Map();

    for (const row of detalle) {
        const id = row.id_profesor ?? "sin-id";
        if (!map.has(id)) {
            map.set(id, {
                id_profesor: id,
                profesor_nombre: row.profesor_nombre || "-",
                profesor_apellido1: row.profesor_apellido1 || "",
                profesor_apellido2: row.profesor_apellido2 || "",
                materia: row.materia_curso || row.materia || "-",
                grupos_asignados: [],
                secciones_asignadas: [],
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const item = map.get(id);
        item.asistencias_registradas += 1;

        if (row.nombre_grupo && !item.grupos_asignados.includes(row.nombre_grupo)) {
            item.grupos_asignados.push(row.nombre_grupo);
        }
        if (row.nombre_seccion && !item.secciones_asignadas.includes(row.nombre_seccion)) {
            item.secciones_asignadas.push(row.nombre_seccion);
        }

        const estado = normalizarEstado(row.estado_asistencia);
        if (estado === "presente") item.presentes += 1;
        if (estado === "ausente") item.ausentes += 1;
        if (estado === "tardia") item.tardias += 1;
        if (estado === "justificada") item.justificadas += 1;
    }

    return [...map.values()]
        .sort((a, b) =>
            `${a.profesor_nombre} ${a.profesor_apellido1}`.localeCompare(
                `${b.profesor_nombre} ${b.profesor_apellido1}`
            )
        )
        .map((item) => ({
            ...item,
            grupos: item.grupos_asignados.join(", ") || "-",
            secciones: item.secciones_asignadas.join(", ") || "-"
        }));
}

export async function generarReporteCaso(filtros = {}) {
    const normalized = validarFiltros(filtros);
    const resumen = await generarReporteResumen(normalized);
    const detalleResult = await generarReporteDetalle(normalized);
    const detalle = Array.isArray(detalleResult?.detalle)
        ? detalleResult.detalle
        : [];

    let detalle_por_grupo = resumen?.detalle_por_grupo || [];

    if (normalized.modo === "estudiantes") {
        detalle_por_grupo = construirDetallePorEstudiante(detalle);
    } else if (normalized.modo === "profesores") {
        detalle_por_grupo = construirDetallePorProfesor(detalle);
    }

    return {
        modo: normalized.modo,
        resumen: resumen?.resumen || {},
        detalle_por_grupo,
        detalle,
        filtros: normalized
    };
}

export async function generarReporteResumen(filtros = {}) {
    const normalized = validarFiltros(filtros);
    const { modo } = normalized;

    if (modo === "pre_matricula") {
        const values = [];
        let where = `
            WHERE e.estado = TRUE
              AND NOT EXISTS (
                SELECT 1
                FROM grupo_estudiante ge
                WHERE ge.id_estudiante = e.id_estudiante
                  AND ge.estado = TRUE
              )
        `;

        if (normalized.busqueda) {
            const text = `%${normalized.busqueda}%`;
            where += ` AND (
                pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ?
                OR CAST(pe.id_persona AS CHAR) LIKE ?
                OR CAST(e.id_estudiante AS CHAR) LIKE ?
            )`;
            values.push(text, text, text, text, text);
        }

        const [rows] = await pool.query(
            `SELECT e.id_estudiante, pe.nombre, pe.apellido1, pe.apellido2, e.estado
             FROM estudiante e
             INNER JOIN persona pe ON pe.id_persona = e.id_persona
             ${where}
             ORDER BY e.id_estudiante DESC
             LIMIT 500`,
            values
        );

        return {
            modo,
            resumen: {
                total_estudiantes: rows.length,
                total_pre_matriculas: rows.length,
                total_asistencias: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                tasa_presentismo: 0
            },
            detalle_por_grupo: [{
                tipo: "pre_matricula",
                total_pre_matriculas: rows.length
            }]
        };
    }

    if (modo === "auditoria") {
        const values = [];
        let where = "";

        if (normalized.busqueda) {
            const text = `%${normalized.busqueda}%`;
            where = `WHERE (
                a.nombre_tabla LIKE ? OR
                a.accion_usuario LIKE ? OR
                a.datos_nuevos LIKE ? OR
                CAST(a.id_usuario AS CHAR) LIKE ?
            )`;
            values.push(text, text, text, text);
        }

        if (normalized.fecha_inicio || normalized.fecha_fin) {
            const parts = [];
            if (normalized.fecha_inicio) {
                parts.push("DATE(a.fecha_creacion) >= ?");
                values.push(normalized.fecha_inicio);
            }
            if (normalized.fecha_fin) {
                parts.push("DATE(a.fecha_creacion) <= ?");
                values.push(normalized.fecha_fin);
            }
            where += where ? ` AND ${parts.join(" AND ")}` : `WHERE ${parts.join(" AND ")}`;
        }

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total_auditorias
             FROM auditoria a
             ${where}`,
            values
        );

        const total = Number(rows[0]?.total_auditorias || 0);
        return {
            modo,
            resumen: {
                total_auditorias: total,
                total_registros: total,
                total_asistencias: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0,
                tasa_presentismo: 0
            },
            detalle_por_grupo: [{
                tipo: "auditoria",
                total_auditorias: total
            }]
        };
    }

    const { conditions, values } = construirCondicionesAsistencia(normalized);

    const [totalsRows] = await pool.query(
        `SELECT
            SUM(CASE WHEN a.estado_asistencia = 'presente' THEN 1 ELSE 0 END) AS presentes,
            SUM(CASE WHEN a.estado_asistencia = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
            SUM(CASE WHEN a.estado_asistencia = 'tardia' THEN 1 ELSE 0 END) AS tardias,
            SUM(CASE WHEN a.estado_asistencia = 'justificada' THEN 1 ELSE 0 END) AS justificadas,
            COUNT(*) AS total_asistencias
         FROM asistencia a
         WHERE ${conditions.join(" AND ")}`,
        values
    );

    const [systemRows] = await pool.query(
        `SELECT
            (SELECT COUNT(*) FROM estudiante WHERE estado = TRUE) AS total_estudiantes,
            (SELECT COUNT(*) FROM profesor WHERE estado = TRUE) AS total_profesores,
            (SELECT COUNT(*) FROM grupo WHERE estado = TRUE) AS total_grupos,
            (SELECT COUNT(*) FROM matricula WHERE estado_matricula = 'activa') AS total_matriculas`
    );

    const groupConditions = ["g.estado = TRUE"];
    const groupValues = [];

    if (normalized.id_grupo) {
        groupConditions.push("g.id_grupo = ?");
        groupValues.push(normalized.id_grupo);
    }

    if (normalized.fecha_inicio) {
        groupConditions.push("(a.id_asistencia IS NULL OR DATE(a.fecha) >= ?)");
        groupValues.push(normalized.fecha_inicio);
    }

    if (normalized.fecha_fin) {
        groupConditions.push("(a.id_asistencia IS NULL OR DATE(a.fecha) <= ?)");
        groupValues.push(normalized.fecha_fin);
    }

    if (normalized.estado_asistencia) {
        groupConditions.push("(a.id_asistencia IS NULL OR a.estado_asistencia = ?)");
        groupValues.push(normalized.estado_asistencia);
    }

    if (normalized.busqueda) {
        const text = `%${normalized.busqueda}%`;
        const studentSearch = `
            EXISTS (
                SELECT 1 FROM estudiante e
                INNER JOIN persona pe ON pe.id_persona = e.id_persona
                WHERE e.id_estudiante = a.id_estudiante
                  AND (
                    pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ?
                    OR CAST(pe.id_persona AS CHAR) LIKE ?
                    OR CAST(e.id_estudiante AS CHAR) LIKE ?
                  )
            )
        `;
        const professorSearch = `
            EXISTS (
                SELECT 1 FROM profesor pf
                INNER JOIN persona pp ON pp.id_persona = pf.id_persona
                WHERE pf.id_profesor = a.id_profesor
                  AND (
                    pp.nombre LIKE ? OR pp.apellido1 LIKE ? OR pp.apellido2 LIKE ?
                    OR CAST(pp.id_persona AS CHAR) LIKE ?
                    OR CAST(pf.id_profesor AS CHAR) LIKE ?
                  )
            )
        `;

        if (modo === "profesores") {
            groupConditions.push(`(a.id_asistencia IS NULL OR ${professorSearch})`);
            groupValues.push(text, text, text, text, text);
        } else if (modo === "estudiantes" || modo === "matricula") {
            groupConditions.push(`(a.id_asistencia IS NULL OR ${studentSearch})`);
            groupValues.push(text, text, text, text, text);
        } else {
            groupConditions.push(`(a.id_asistencia IS NULL OR ${studentSearch} OR ${professorSearch})`);
            groupValues.push(
                text, text, text, text, text,
                text, text, text, text, text
            );
        }
    }

    const [detailByGroup] = await pool.query(
        `SELECT
            g.id_grupo,
            g.nombre_grupo,
            s.nombre_seccion,
            s.nivel,
            fn_estudiantes_grupo(g.id_grupo) AS ocupados,
            g.capacidad,
            COUNT(a.id_asistencia) AS asistencias_registradas,
            COALESCE(SUM(CASE WHEN a.estado_asistencia = 'presente' THEN 1 ELSE 0 END), 0) AS presentes,
            COALESCE(SUM(CASE WHEN a.estado_asistencia = 'ausente' THEN 1 ELSE 0 END), 0) AS ausentes
         FROM grupo g
         INNER JOIN seccion s ON s.id_seccion = g.id_seccion
         LEFT JOIN asistencia a ON a.id_grupo = g.id_grupo AND a.estado = TRUE
         WHERE ${groupConditions.join(" AND ")}
         GROUP BY g.id_grupo, g.nombre_grupo, s.nombre_seccion, s.nivel, g.capacidad
         ORDER BY g.nombre_grupo`,
        groupValues
    );

    const base = systemRows[0] || {};
    const metric = totalsRows[0] || {};
    const total = Number(metric.total_asistencias || 0);
    const presentes = Number(metric.presentes || 0);

    return {
        modo,
        resumen: {
            total_estudiantes: Number(base.total_estudiantes || 0),
            total_profesores: Number(base.total_profesores || 0),
            total_grupos: Number(base.total_grupos || 0),
            total_matriculas: Number(base.total_matriculas || 0),
            total_asistencias: total,
            presentes,
            ausentes: Number(metric.ausentes || 0),
            tardias: Number(metric.tardias || 0),
            justificadas: Number(metric.justificadas || 0),
            tasa_presentismo: total ? Math.round((presentes / total) * 100) : 0
        },
        detalle_por_grupo: detailByGroup
    };
}

export async function generarReporteDetalle(filtros = {}) {
    const normalized = validarFiltros(filtros);

    if (normalized.modo === "pre_matricula") {
        const values = [];
        let where = `
            WHERE e.estado = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM grupo_estudiante ge
                WHERE ge.id_estudiante = e.id_estudiante
                  AND ge.estado = TRUE
              )
        `;

        if (normalized.busqueda) {
            const text = `%${normalized.busqueda}%`;
            where += ` AND (
                pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ?
                OR CAST(pe.id_persona AS CHAR) LIKE ?
                OR CAST(e.id_estudiante AS CHAR) LIKE ?
            )`;
            values.push(text, text, text, text, text);
        }

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
             ${where}
             ORDER BY e.id_estudiante DESC
             LIMIT 500`,
            values
        );

        return { modo: normalized.modo, detalle: rows };
    }

    if (normalized.modo === "auditoria") {
        const values = [];
        const conditions = [];

        if (normalized.busqueda) {
            const text = `%${normalized.busqueda}%`;
            conditions.push(`(
                a.nombre_tabla LIKE ? OR
                a.accion_usuario LIKE ? OR
                a.datos_nuevos LIKE ? OR
                CAST(a.id_usuario AS CHAR) LIKE ?
            )`);
            values.push(text, text, text, text);
        }

        if (normalized.fecha_inicio) {
            conditions.push("DATE(a.fecha_creacion) >= ?");
            values.push(normalized.fecha_inicio);
        }

        if (normalized.fecha_fin) {
            conditions.push("DATE(a.fecha_creacion) <= ?");
            values.push(normalized.fecha_fin);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

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
            values
        );

        return { modo: normalized.modo, detalle: rows };
    }

    const { conditions, values } = construirCondicionesAsistencia(normalized);

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
         WHERE ${conditions.join(" AND ")}
         ORDER BY a.fecha DESC, a.id_asistencia DESC
         LIMIT 500`,
        values
    );

    return { modo: normalized.modo, detalle: rows };
}
