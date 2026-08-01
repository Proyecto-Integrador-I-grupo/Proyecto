import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function construirCondicionesAsistencia(filtros = {}) {
    const { id_grupo, fecha_inicio, fecha_fin, estado_asistencia } = filtros;
    const condiciones = ["a.estado = TRUE"];
    const valores = [];

    if (id_grupo) {
        condiciones.push("a.id_grupo = ?");
        valores.push(Number(id_grupo));
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

    return { condiciones, valores };
}

export async function generarReporteResumen(filtros = {}) {
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
            (SELECT COUNT(*) FROM matricula WHERE estado = TRUE) AS total_matriculas`
    );

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
         LEFT JOIN asistencia a ON a.id_grupo = g.id_grupo
         ${filtros.id_grupo ? "WHERE g.id_grupo = ?" : "WHERE g.estado = TRUE"}
         GROUP BY g.id_grupo, g.nombre_grupo, s.nombre_seccion, s.nivel, g.capacidad
         ORDER BY g.nombre_grupo`,
        filtros.id_grupo ? [Number(filtros.id_grupo)] : []
    );

    const base = totalesSistema[0] || {};
    const metricas = totales[0] || {};
    const totalAsistencias = Number(metricas.total_asistencias || 0);
    const presentes = Number(metricas.presentes || 0);
    const tasaPresentismo = totalAsistencias > 0 ? Math.round((presentes / totalAsistencias) * 100) : 0;

    return {
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

    return rows;
}
