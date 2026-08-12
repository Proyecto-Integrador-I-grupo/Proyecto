import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];
const MODOS_VALIDOS = new Set(["matricula", "estudiantes", "grupos", "profesores", "pre_matricula", "auditoria"]);
const TIPOS_REPORTE_VALIDOS = new Set(["resumen", "detalle", "individual", "grupo"]);

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function normalizarModo(modo) {
    const valor = String(modo || "matricula").toLowerCase().trim();
    return MODOS_VALIDOS.has(valor) ? valor : "matricula";
}

function normalizarTipoReporte(tipoReporte) {
    const valor = String(tipoReporte || "resumen").toLowerCase().trim();
    return TIPOS_REPORTE_VALIDOS.has(valor) ? valor : "resumen";
}

function parsePositiveInt(value, nombreCampo) {
    if (value === undefined || value === null || value === "") return undefined;
    const numero = Number(value);
    if (!Number.isInteger(numero) || numero <= 0) {
        throw new Error(`El campo ${nombreCampo} debe ser un identificador válido.`);
    }
    return numero;
}

function normalizarBusqueda(busqueda) {
    if (busqueda === undefined || busqueda === null || busqueda === "") return "";
    const texto = String(busqueda).trim();
    if (!texto) return "";
    if (texto.length > 120) throw new Error("La búsqueda no puede superar 120 caracteres.");
    return texto;
}

function normalizarFechaISO(fecha, nombreCampo) {
    if (fecha === undefined || fecha === null || fecha === "") return "";
    const texto = String(fecha).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        throw new Error(`La fecha ${nombreCampo} debe tener el formato YYYY-MM-DD.`);
    }
    const valor = new Date(`${texto}T00:00:00`);
    if (Number.isNaN(valor.getTime())) throw new Error(`La fecha ${nombreCampo} no es válida.`);
    return texto;
}

function validarFiltrosReporte(filtros = {}) {
    const modo = normalizarModo(filtros.modo);
    const tipo_reporte = normalizarTipoReporte(filtros.tipo_reporte || filtros.tipoReporte);
    const id_grupo = parsePositiveInt(filtros.id_grupo, "id_grupo");
    const id_estudiante = parsePositiveInt(filtros.id_estudiante, "id_estudiante");
    const fecha_inicio = normalizarFechaISO(filtros.fecha_inicio, "fecha_inicio");
    const fecha_fin = normalizarFechaISO(filtros.fecha_fin, "fecha_fin");

    if (fecha_inicio && fecha_fin && fecha_inicio > fecha_fin) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    const estado_asistencia = normalizarEstado(filtros.estado_asistencia ?? filtros.estado ?? "");
    if (estado_asistencia && !ESTADOS_VALIDOS.includes(estado_asistencia)) {
        throw new Error("Estado de asistencia no válido. Usa presente, ausente, tardia o justificada.");
    }

    const busqueda = normalizarBusqueda(filtros.busqueda);

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

function busquedaEstudianteSql(alias = "a") {
    return `${alias}.id_estudiante IN (
        SELECT e.id_estudiante
        FROM estudiante e
        INNER JOIN persona pe ON pe.id_persona = e.id_persona
        WHERE pe.nombre LIKE ?
           OR pe.apellido1 LIKE ?
           OR pe.apellido2 LIKE ?
           OR CAST(pe.id_persona AS CHAR) LIKE ?
           OR CAST(e.id_estudiante AS CHAR) LIKE ?
    )`;
}

function busquedaProfesorSql(alias = "a") {
    return `${alias}.id_profesor IN (
        SELECT prof.id_profesor
        FROM profesor prof
        INNER JOIN persona pp ON pp.id_persona = prof.id_persona
        WHERE pp.nombre LIKE ?
           OR pp.apellido1 LIKE ?
           OR pp.apellido2 LIKE ?
           OR CAST(pp.id_persona AS CHAR) LIKE ?
           OR CAST(prof.id_profesor AS CHAR) LIKE ?
    )`;
}

function pushBusquedaValores(valores, texto, repeticiones = 1) {
    for (let i = 0; i < repeticiones; i += 1) {
        valores.push(texto, texto, texto, texto, texto);
    }
}

function construirCondicionesAsistencia(filtros = {}) {
    const { modo, id_grupo, id_estudiante, fecha_inicio, fecha_fin, estado_asistencia, busqueda } = filtros;
    const condiciones = ["a.estado = TRUE"];
    const valores = [];

    if (id_grupo) {
        condiciones.push("a.id_grupo = ?");
        valores.push(id_grupo);
    }
    if (id_estudiante) {
        condiciones.push("a.id_estudiante = ?");
        valores.push(id_estudiante);
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

    if (busqueda) {
        const texto = `%${busqueda}%`;
        const estudiante = busquedaEstudianteSql("a");
        const profesor = busquedaProfesorSql("a");

        if (modo === "matricula") {
            condiciones.push(estudiante);
            pushBusquedaValores(valores, texto);
        } else if (modo === "profesores") {
            condiciones.push(profesor);
            pushBusquedaValores(valores, texto);
        } else if (modo === "estudiantes") {
            // Permite localizar estudiantes directamente o por el profesor que les registró asistencia.
            condiciones.push(`(${estudiante} OR ${profesor})`);
            pushBusquedaValores(valores, texto, 2);
        } else {
            condiciones.push(`(${estudiante} OR ${profesor})`);
            pushBusquedaValores(valores, texto, 2);
        }
    }

    return { condiciones, valores };
}

function construirDetallePorEstudiante(detalle = []) {
    const mapa = new Map();

    detalle.forEach((registro) => {
        const id = registro.id_estudiante ?? registro.estudiante_id ?? "sin-id";
        const key = `estudiante-${id}`;
        if (!mapa.has(key)) {
            mapa.set(key, {
                id_estudiante: id,
                estudiante_nombre: registro.estudiante_nombre || "-",
                estudiante_apellido1: registro.estudiante_apellido1 || "",
                estudiante_apellido2: registro.estudiante_apellido2 || "",
                grupo: registro.nombre_grupo || "-",
                profesores: [],
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const item = mapa.get(key);
        item.asistencias_registradas += 1;
        const profesor = `${registro.profesor_nombre || ""} ${registro.profesor_apellido1 || ""} ${registro.profesor_apellido2 || ""}`.trim();
        if (profesor && !item.profesores.includes(profesor)) item.profesores.push(profesor);

        const estado = normalizarEstado(registro.estado_asistencia);
        if (estado === "presente") item.presentes += 1;
        if (estado === "ausente") item.ausentes += 1;
        if (estado === "tardia") item.tardias += 1;
        if (estado === "justificada") item.justificadas += 1;
    });

    return Array.from(mapa.values())
        .map((item) => ({ ...item, profesor: item.profesores.join(", ") || "-" }))
        .sort((a, b) => `${a.estudiante_nombre} ${a.estudiante_apellido1}`.localeCompare(`${b.estudiante_nombre} ${b.estudiante_apellido1}`));
}

function construirDetallePorProfesor(detalle = []) {
    const mapa = new Map();

    detalle.forEach((registro) => {
        const id = registro.id_profesor ?? registro.profesor_id ?? "sin-id";
        const key = `profesor-${id}`;
        if (!mapa.has(key)) {
            const profesorEstado = registro.profesor_estado ?? registro.estado_profesor ?? registro.estado ?? 1;
            mapa.set(key, {
                id_profesor: id,
                profesor_nombre: registro.profesor_nombre || "-",
                profesor_apellido1: registro.profesor_apellido1 || "",
                profesor_apellido2: registro.profesor_apellido2 || "",
                materia: registro.materia_curso || registro.materia || registro.materia_profesor || "-",
                estado: Number(profesorEstado) === 0 || String(profesorEstado).toLowerCase() === "inactivo" ? "Inactivo" : "Activo",
                grupos_asignados: [],
                secciones_asignadas: [],
                estudiantes: new Set(),
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const item = mapa.get(key);
        item.asistencias_registradas += 1;
        if (registro.nombre_grupo && !item.grupos_asignados.includes(registro.nombre_grupo)) item.grupos_asignados.push(registro.nombre_grupo);
        if (registro.nombre_seccion && !item.secciones_asignadas.includes(registro.nombre_seccion)) item.secciones_asignadas.push(registro.nombre_seccion);
        if (registro.id_estudiante) item.estudiantes.add(registro.id_estudiante);

        const estado = normalizarEstado(registro.estado_asistencia);
        if (estado === "presente") item.presentes += 1;
        if (estado === "ausente") item.ausentes += 1;
        if (estado === "tardia") item.tardias += 1;
        if (estado === "justificada") item.justificadas += 1;
    });

    return Array.from(mapa.values())
        .map((item) => ({
            ...item,
            estudiantes_asociados: item.estudiantes.size,
            estudiantes: undefined,
            grupos: item.grupos_asignados.join(", ") || "-",
            secciones: item.secciones_asignadas.join(", ") || "-"
        }))
        .sort((a, b) => `${a.profesor_nombre} ${a.profesor_apellido1}`.localeCompare(`${b.profesor_nombre} ${b.profesor_apellido1}`));
}

export async function generarReporteCaso(filtros = {}) {
    const filtrosNormalizados = validarFiltrosReporte(filtros);
    const resumen = await generarReporteResumen(filtrosNormalizados);
    const detalleResultado = await generarReporteDetalle(filtrosNormalizados);
    const detalle = Array.isArray(detalleResultado?.detalle) ? detalleResultado.detalle : [];

    let detalle_por_grupo = resumen?.detalle_por_grupo || [];
    if (filtrosNormalizados.modo === "estudiantes") detalle_por_grupo = construirDetallePorEstudiante(detalle);
    if (filtrosNormalizados.modo === "profesores") detalle_por_grupo = construirDetallePorProfesor(detalle);

    return {
        modo: filtrosNormalizados.modo,
        resumen: resumen?.resumen || {},
        detalle_por_grupo,
        detalle,
        filtros: filtrosNormalizados
    };
}

export async function generarReporteResumen(filtros = {}) {
    const f = validarFiltrosReporte(filtros);

    if (f.modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];
        if (f.busqueda) {
            const texto = `%${f.busqueda}%`;
            condiciones.push(`(pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ? OR CAST(pe.id_persona AS CHAR) LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?)`);
            valores.push(texto, texto, texto, texto, texto);
        }
        const extra = condiciones.length ? `AND ${condiciones.join(" AND ")}` : "";
        const [rows] = await pool.query(
            `SELECT e.id_estudiante
             FROM estudiante e
             INNER JOIN persona pe ON pe.id_persona = e.id_persona
             WHERE e.estado = TRUE
               AND NOT EXISTS (
                   SELECT 1 FROM grupo_estudiante ge
                   WHERE ge.id_estudiante = e.id_estudiante AND ge.estado = TRUE
               )
               ${extra}
             LIMIT 500`,
            valores
        );
        const total = Number(rows.length || 0);
        return {
            modo: f.modo,
            resumen: { total_estudiantes: total, total_pre_matriculas: total, total_asistencias: 0, presentes: 0, ausentes: 0, tardias: 0, justificadas: 0, tasa_presentismo: 0 },
            detalle_por_grupo: [{ tipo: "pre_matricula", total_pre_matriculas: total }]
        };
    }

    if (f.modo === "auditoria") {
        const condiciones = [];
        const valores = [];
        if (f.busqueda) {
            const texto = `%${f.busqueda}%`;
            condiciones.push(`(a.nombre_tabla LIKE ? OR a.accion_usuario LIKE ? OR CAST(a.datos_nuevos AS CHAR) LIKE ? OR CAST(a.datos_anteriores AS CHAR) LIKE ? OR CAST(a.id_usuario AS CHAR) LIKE ? OR u.correo LIKE ?)`);
            valores.push(texto, texto, texto, texto, texto, texto);
        }
        if (f.fecha_inicio) {
            condiciones.push("DATE(a.fecha_creacion) >= ?");
            valores.push(f.fecha_inicio);
        }
        if (f.fecha_fin) {
            condiciones.push("DATE(a.fecha_creacion) <= ?");
            valores.push(f.fecha_fin);
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total_auditorias
             FROM auditoria a
             LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
             ${where}`,
            valores
        );
        const total = Number(rows[0]?.total_auditorias || 0);
        return {
            modo: f.modo,
            resumen: { total_auditorias: total, total_registros: total, total_asistencias: 0, presentes: 0, ausentes: 0, tardias: 0, justificadas: 0, tasa_presentismo: 0 },
            detalle_por_grupo: [{ tipo: "auditoria", total_auditorias: total }]
        };
    }

    const { condiciones, valores } = construirCondicionesAsistencia(f);
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

    const [sistema] = await pool.query(
        `SELECT
            (SELECT COUNT(*) FROM estudiante WHERE estado = TRUE) AS total_estudiantes,
            (SELECT COUNT(*) FROM profesor WHERE estado = TRUE) AS total_profesores,
            (SELECT COUNT(*) FROM grupo WHERE estado = TRUE) AS total_grupos,
            (SELECT COUNT(*) FROM matricula WHERE estado_matricula = 'activa') AS total_matriculas`
    );

    const grupoCondiciones = ["g.estado = TRUE"];
    const grupoValores = [];
    if (f.id_grupo) {
        grupoCondiciones.push("g.id_grupo = ?");
        grupoValores.push(f.id_grupo);
    }
    if (f.id_estudiante) {
        grupoCondiciones.push("(a.id_asistencia IS NULL OR a.id_estudiante = ?)");
        grupoValores.push(f.id_estudiante);
    }
    if (f.fecha_inicio) {
        grupoCondiciones.push("(a.id_asistencia IS NULL OR DATE(a.fecha) >= ?)");
        grupoValores.push(f.fecha_inicio);
    }
    if (f.fecha_fin) {
        grupoCondiciones.push("(a.id_asistencia IS NULL OR DATE(a.fecha) <= ?)");
        grupoValores.push(f.fecha_fin);
    }
    if (f.estado_asistencia) {
        grupoCondiciones.push("(a.id_asistencia IS NULL OR a.estado_asistencia = ?)");
        grupoValores.push(f.estado_asistencia);
    }
    if (f.busqueda) {
        const texto = `%${f.busqueda}%`;
        const student = `a.id_estudiante IN (
            SELECT e.id_estudiante FROM estudiante e
            INNER JOIN persona pe ON pe.id_persona = e.id_persona
            WHERE pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ? OR CAST(pe.id_persona AS CHAR) LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?
        )`;
        const professor = `a.id_profesor IN (
            SELECT prof.id_profesor FROM profesor prof
            INNER JOIN persona pp ON pp.id_persona = prof.id_persona
            WHERE pp.nombre LIKE ? OR pp.apellido1 LIKE ? OR pp.apellido2 LIKE ? OR CAST(pp.id_persona AS CHAR) LIKE ? OR CAST(prof.id_profesor AS CHAR) LIKE ?
        )`;
        if (f.modo === "matricula") {
            grupoCondiciones.push(`(a.id_asistencia IS NULL OR ${student})`);
            pushBusquedaValores(grupoValores, texto);
        } else if (f.modo === "profesores") {
            grupoCondiciones.push(`(a.id_asistencia IS NULL OR ${professor})`);
            pushBusquedaValores(grupoValores, texto);
        } else if (f.modo === "estudiantes") {
            grupoCondiciones.push(`(a.id_asistencia IS NULL OR ${student} OR ${professor})`);
            pushBusquedaValores(grupoValores, texto, 2);
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
            COALESCE(SUM(CASE WHEN a.estado_asistencia = 'presente' THEN 1 ELSE 0 END), 0) AS presentes,
            COALESCE(SUM(CASE WHEN a.estado_asistencia = 'ausente' THEN 1 ELSE 0 END), 0) AS ausentes
         FROM grupo g
         INNER JOIN seccion s ON s.id_seccion = g.id_seccion
         LEFT JOIN asistencia a ON a.id_grupo = g.id_grupo AND a.estado = TRUE
         WHERE ${grupoCondiciones.join(" AND ")}
         GROUP BY g.id_grupo, g.nombre_grupo, s.nombre_seccion, s.nivel, g.capacidad
         ORDER BY g.nombre_grupo`,
        grupoValores
    );

    const base = sistema[0] || {};
    const metricas = totales[0] || {};
    const total = Number(metricas.total_asistencias || 0);
    const presentes = Number(metricas.presentes || 0);

    return {
        modo: f.modo,
        resumen: {
            total_estudiantes: Number(base.total_estudiantes || 0),
            total_profesores: Number(base.total_profesores || 0),
            total_grupos: Number(base.total_grupos || 0),
            total_matriculas: Number(base.total_matriculas || 0),
            total_asistencias: total,
            presentes,
            ausentes: Number(metricas.ausentes || 0),
            tardias: Number(metricas.tardias || 0),
            justificadas: Number(metricas.justificadas || 0),
            tasa_presentismo: total ? Math.round((presentes / total) * 100) : 0
        },
        detalle_por_grupo: detallePorGrupo
    };
}

export async function generarReporteDetalle(filtros = {}) {
    const f = validarFiltrosReporte(filtros);

    if (f.modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];
        if (f.busqueda) {
            const texto = `%${f.busqueda}%`;
            condiciones.push(`(pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ? OR CAST(pe.id_persona AS CHAR) LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?)`);
            valores.push(texto, texto, texto, texto, texto);
        }
        const extra = condiciones.length ? `AND ${condiciones.join(" AND ")}` : "";
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
                   WHERE ge.id_estudiante = e.id_estudiante AND ge.estado = TRUE
               )
               ${extra}
             ORDER BY e.id_estudiante DESC
             LIMIT 500`,
            valores
        );
        return { modo: f.modo, detalle: rows };
    }

    if (f.modo === "auditoria") {
        const condiciones = [];
        const valores = [];
        if (f.busqueda) {
            const texto = `%${f.busqueda}%`;
            condiciones.push(`(a.nombre_tabla LIKE ? OR a.accion_usuario LIKE ? OR CAST(a.datos_nuevos AS CHAR) LIKE ? OR CAST(a.datos_anteriores AS CHAR) LIKE ? OR CAST(a.id_usuario AS CHAR) LIKE ? OR u.correo LIKE ?)`);
            valores.push(texto, texto, texto, texto, texto, texto);
        }
        if (f.fecha_inicio) {
            condiciones.push("DATE(a.fecha_creacion) >= ?");
            valores.push(f.fecha_inicio);
        }
        if (f.fecha_fin) {
            condiciones.push("DATE(a.fecha_creacion) <= ?");
            valores.push(f.fecha_fin);
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
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', pu.nombre, pu.apellido1, pu.apellido2)), ''), u.correo, CONCAT('Usuario #', a.id_usuario)) AS usuario_nombre
             FROM auditoria a
             LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
             LEFT JOIN persona pu ON pu.id_persona = u.id_persona
             ${where}
             ORDER BY a.fecha_creacion DESC
             LIMIT 500`,
            valores
        );
        return { modo: f.modo, detalle: rows };
    }

    const { condiciones, valores } = construirCondicionesAsistencia(f);
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

    return { modo: f.modo, detalle: rows };
}
