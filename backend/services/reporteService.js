import pool from "../config/database.js";

const MODOS_VALIDOS = new Set([
    "matricula",
    "estudiantes",
    "grupos",
    "profesores",
    "pre_matricula",
    "auditoria"
]);

const TIPOS_REPORTE_VALIDOS = new Set([
    "resumen",
    "detalle",
    "individual",
    "grupo"
]);

const ESTADOS_VALIDOS = [
    "presente",
    "ausente",
    "tardia",
    "justificada"
];

function normalizarEstado(estado) {
    return String(estado || "").toLowerCase().trim();
}

function normalizarModo(modo) {
    const valor = String(modo || "matricula").toLowerCase().trim();

    return MODOS_VALIDOS.has(valor)
        ? valor
        : "matricula";
}

function normalizarTipoReporte(tipoReporte) {
    const valor = String(tipoReporte || "resumen").toLowerCase().trim();

    return TIPOS_REPORTE_VALIDOS.has(valor)
        ? valor
        : "resumen";
}

function parsePositiveInt(value, nombreCampo) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return undefined;
    }

    const numero = Number(value);

    if (!Number.isInteger(numero) || numero <= 0) {
        throw new Error(
            `El campo ${nombreCampo} debe ser un identificador válido.`
        );
    }

    return numero;
}

function normalizarBusqueda(busqueda) {
    if (
        busqueda === undefined ||
        busqueda === null ||
        busqueda === ""
    ) {
        return "";
    }

    const texto = String(busqueda).trim();

    if (!texto) {
        return "";
    }

    if (texto.length > 120) {
        throw new Error(
            "La búsqueda no puede superar 120 caracteres."
        );
    }

    return texto;
}

function normalizarFechaISO(fecha, nombreCampo) {
    if (
        fecha === undefined ||
        fecha === null ||
        fecha === ""
    ) {
        return "";
    }

    const fechaTexto = String(fecha).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
        throw new Error(
            `La fecha ${nombreCampo} debe tener el formato YYYY-MM-DD.`
        );
    }

    const valorFecha = new Date(`${fechaTexto}T00:00:00`);

    if (Number.isNaN(valorFecha.getTime())) {
        throw new Error(
            `La fecha ${nombreCampo} no es una fecha válida.`
        );
    }

    return fechaTexto;
}

function validarFiltros(filtros = {}) {
    const modo = normalizarModo(filtros.modo);

    const tipo_reporte = normalizarTipoReporte(
        filtros.tipo_reporte || filtros.tipoReporte
    );

    const id_grupo = parsePositiveInt(
        filtros.id_grupo,
        "id_grupo"
    );

    const id_estudiante = parsePositiveInt(
        filtros.id_estudiante,
        "id_estudiante"
    );

    const fecha_inicio = normalizarFechaISO(
        filtros.fecha_inicio,
        "fecha_inicio"
    );

    const fecha_fin = normalizarFechaISO(
        filtros.fecha_fin,
        "fecha_fin"
    );

    if (
        fecha_inicio &&
        fecha_fin &&
        fecha_inicio > fecha_fin
    ) {
        throw new Error(
            "La fecha de inicio no puede ser mayor que la fecha fin."
        );
    }

    const estado_asistencia = normalizarEstado(
        filtros.estado_asistencia ??
        filtros.estado ??
        ""
    );

    if (
        estado_asistencia &&
        !ESTADOS_VALIDOS.includes(estado_asistencia)
    ) {
        throw new Error(
            "Estado de asistencia no válido. Usa presente, ausente, tardia o justificada."
        );
    }

    const busqueda = normalizarBusqueda(
        filtros.busqueda
    );

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

    const condiciones = [
        "a.estado = TRUE"
    ];

    const valores = [];

    if (id_grupo) {
        condiciones.push(
            "a.id_grupo = ?"
        );

        valores.push(id_grupo);
    }

    if (id_estudiante) {
        condiciones.push(
            "a.id_estudiante = ?"
        );

        valores.push(id_estudiante);
    }

    if (fecha_inicio) {
        condiciones.push(
            "DATE(a.fecha) >= ?"
        );

        valores.push(fecha_inicio);
    }

    if (fecha_fin) {
        condiciones.push(
            "DATE(a.fecha) <= ?"
        );

        valores.push(fecha_fin);
    }

    if (estado_asistencia) {
        condiciones.push(
            "a.estado_asistencia = ?"
        );

        valores.push(estado_asistencia);
    }

    if (busqueda) {
        const texto = `%${busqueda}%`;

        const busquedaEstudiante = `
            a.id_estudiante IN (
                SELECT e.id_estudiante
                FROM estudiante e
                INNER JOIN persona pe
                    ON pe.id_persona = e.id_persona
                WHERE pe.nombre LIKE ?
                   OR pe.apellido1 LIKE ?
                   OR pe.apellido2 LIKE ?
                   OR CAST(pe.id_persona AS CHAR) LIKE ?
                   OR CAST(e.id_estudiante AS CHAR) LIKE ?
            )
        `;

        const busquedaProfesor = `
            a.id_profesor IN (
                SELECT prof.id_profesor
                FROM profesor prof
                INNER JOIN persona pp
                    ON pp.id_persona = prof.id_persona
                WHERE pp.nombre LIKE ?
                   OR pp.apellido1 LIKE ?
                   OR pp.apellido2 LIKE ?
                   OR CAST(pp.id_persona AS CHAR) LIKE ?
                   OR CAST(prof.id_profesor AS CHAR) LIKE ?
            )
        `;

        if (modo === "profesores") {
            condiciones.push(
                busquedaProfesor
            );

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        } else if (
            modo === "estudiantes" ||
            modo === "pre_matricula" ||
            modo === "matricula"
        ) {
            condiciones.push(
                busquedaEstudiante
            );

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        } else {
            condiciones.push(`
                (
                    ${busquedaEstudiante}
                    OR
                    ${busquedaProfesor}
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto
            );
        }
    }

    return {
        condiciones,
        valores
    };
}

function construirCondicionesGrupos(filtros = {}) {
    const {
        modo,
        id_grupo,
        id_estudiante,
        fecha_inicio,
        fecha_fin,
        estado_asistencia,
        busqueda
    } = filtros;

    const condiciones = [
        "g.estado = TRUE"
    ];

    const valores = [];

    if (id_grupo) {
        condiciones.push(
            "g.id_grupo = ?"
        );

        valores.push(id_grupo);
    }

    if (id_estudiante) {
        condiciones.push(`
            EXISTS (
                SELECT 1
                FROM grupo_estudiante ge
                WHERE ge.id_grupo = g.id_grupo
                  AND ge.id_estudiante = ?
                  AND ge.estado = TRUE
            )
        `);

        valores.push(id_estudiante);
    }

    if (fecha_inicio) {
        condiciones.push(`
            (
                a.id_asistencia IS NULL
                OR DATE(a.fecha) >= ?
            )
        `);

        valores.push(fecha_inicio);
    }

    if (fecha_fin) {
        condiciones.push(`
            (
                a.id_asistencia IS NULL
                OR DATE(a.fecha) <= ?
            )
        `);

        valores.push(fecha_fin);
    }

    if (estado_asistencia) {
        condiciones.push(`
            (
                a.id_asistencia IS NULL
                OR a.estado_asistencia = ?
            )
        `);

        valores.push(estado_asistencia);
    }

    if (busqueda) {
        const texto = `%${busqueda}%`;

        const busquedaEstudiante = `
            EXISTS (
                SELECT 1
                FROM estudiante e
                INNER JOIN persona pe
                    ON pe.id_persona = e.id_persona
                INNER JOIN grupo_estudiante ge2
                    ON ge2.id_estudiante = e.id_estudiante
                WHERE ge2.id_grupo = g.id_grupo
                  AND ge2.estado = TRUE
                  AND (
                      pe.nombre LIKE ?
                      OR pe.apellido1 LIKE ?
                      OR pe.apellido2 LIKE ?
                      OR CAST(pe.id_persona AS CHAR) LIKE ?
                      OR CAST(e.id_estudiante AS CHAR) LIKE ?
                  )
            )
        `;

        const busquedaProfesor = `
            EXISTS (
                SELECT 1
                FROM profesor pf
                INNER JOIN persona pp
                    ON pp.id_persona = pf.id_persona
                WHERE pf.id_profesor = a.id_profesor
                  AND (
                      pp.nombre LIKE ?
                      OR pp.apellido1 LIKE ?
                      OR pp.apellido2 LIKE ?
                      OR CAST(pp.id_persona AS CHAR) LIKE ?
                      OR CAST(pf.id_profesor AS CHAR) LIKE ?
                  )
            )
        `;

        if (modo === "profesores") {
            condiciones.push(`
                (
                    a.id_asistencia IS NULL
                    OR ${busquedaProfesor}
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        } else if (
            modo === "estudiantes" ||
            modo === "matricula"
        ) {
            condiciones.push(`
                (
                    a.id_asistencia IS NULL
                    OR ${busquedaEstudiante}
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        } else {
            condiciones.push(`
                (
                    a.id_asistencia IS NULL
                    OR ${busquedaEstudiante}
                    OR ${busquedaProfesor}
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto,
                texto
            );
        }
    }

    return {
        condiciones,
        valores
    };
}

function construirDetallePorEstudiante(detalle = []) {
    const mapa = new Map();

    for (const row of detalle) {
        const id = row.id_estudiante ?? "sin-id";

        if (!mapa.has(id)) {
            mapa.set(id, {
                id_estudiante: id,
                estudiante_nombre:
                    row.estudiante_nombre || "-",
                estudiante_apellido1:
                    row.estudiante_apellido1 || "",
                estudiante_apellido2:
                    row.estudiante_apellido2 || "",
                grupo:
                    row.nombre_grupo || "-",
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const item = mapa.get(id);

        item.asistencias_registradas += 1;

        const estado = normalizarEstado(
            row.estado_asistencia
        );

        if (estado === "presente") {
            item.presentes += 1;
        }

        if (estado === "ausente") {
            item.ausentes += 1;
        }

        if (estado === "tardia") {
            item.tardias += 1;
        }

        if (estado === "justificada") {
            item.justificadas += 1;
        }
    }

    return [...mapa.values()].sort(
        (a, b) =>
            `${a.estudiante_nombre} ${a.estudiante_apellido1}`
                .localeCompare(
                    `${b.estudiante_nombre} ${b.estudiante_apellido1}`
                )
    );
}

function construirDetallePorProfesor(detalle = []) {
    const mapa = new Map();

    for (const registro of detalle) {
        const idProfesor =
            registro.id_profesor ??
            registro.profesor_id ??
            "sin-id";

        const key = `profesor-${idProfesor}`;

        if (!mapa.has(key)) {
            const profesorEstado =
                registro.profesor_estado ??
                registro.estado_profesor ??
                registro.estado ??
                1;

            const materia =
                registro.materia_curso ||
                registro.materia ||
                registro.materia_profesor ||
                "-";

            mapa.set(key, {
                id_profesor: idProfesor,
                profesor_nombre:
                    registro.profesor_nombre || "-",
                profesor_apellido1:
                    registro.profesor_apellido1 || "",
                profesor_apellido2:
                    registro.profesor_apellido2 || "",
                materia,
                estado:
                    Number(profesorEstado) === 0 ||
                    String(profesorEstado).toLowerCase() === "inactivo"
                        ? "Inactivo"
                        : "Activo",
                grupos_asignados: [],
                secciones_asignadas: [],
                asistencias_registradas: 0,
                presentes: 0,
                ausentes: 0,
                tardias: 0,
                justificadas: 0
            });
        }

        const acumulado = mapa.get(key);

        acumulado.asistencias_registradas += 1;

        const grupoNombre =
            registro.nombre_grupo || "-";

        if (
            grupoNombre !== "-" &&
            !acumulado.grupos_asignados.includes(grupoNombre)
        ) {
            acumulado.grupos_asignados.push(
                grupoNombre
            );
        }

        const seccionNombre =
            registro.nombre_seccion || "-";

        if (
            seccionNombre !== "-" &&
            !acumulado.secciones_asignadas.includes(
                seccionNombre
            )
        ) {
            acumulado.secciones_asignadas.push(
                seccionNombre
            );
        }

        const estado = normalizarEstado(
            registro.estado_asistencia
        );

        if (estado === "presente") {
            acumulado.presentes += 1;
        }

        if (estado === "ausente") {
            acumulado.ausentes += 1;
        }

        if (estado === "tardia") {
            acumulado.tardias += 1;
        }

        if (estado === "justificada") {
            acumulado.justificadas += 1;
        }
    }

    return Array.from(mapa.values())
        .sort((a, b) => {
            const nombreA =
                `${a.profesor_nombre} ${a.profesor_apellido1} ${a.profesor_apellido2}`
                    .trim();

            const nombreB =
                `${b.profesor_nombre} ${b.profesor_apellido1} ${b.profesor_apellido2}`
                    .trim();

            return nombreA.localeCompare(nombreB);
        })
        .map((profesor) => ({
            ...profesor,
            grupos:
                profesor.grupos_asignados.join(", ") || "-",
            secciones:
                profesor.secciones_asignadas.join(", ") || "-"
        }));
}

export async function generarReporteCaso(filtros = {}) {
    const filtrosNormalizados =
        validarFiltros(filtros);

    const modo =
        filtrosNormalizados.modo;

    const resumen =
        await generarReporteResumen(
            filtrosNormalizados
        );

    const detalleResultado =
        await generarReporteDetalle(
            filtrosNormalizados
        );

    const detalleArray =
        Array.isArray(detalleResultado?.detalle)
            ? detalleResultado.detalle
            : Array.isArray(detalleResultado)
                ? detalleResultado
                : [];

    let detallePorGrupo =
        resumen?.detalle_por_grupo || [];

    if (modo === "estudiantes") {
        detallePorGrupo =
            construirDetallePorEstudiante(
                detalleArray
            );
    }

    if (modo === "profesores") {
        detallePorGrupo =
            construirDetallePorProfesor(
                detalleArray
            );
    }

    return {
        modo,
        resumen: resumen?.resumen || {},
        detalle_por_grupo: detallePorGrupo,
        detalle: detalleArray,
        filtros: filtrosNormalizados
    };
}

export async function generarReporteResumen(filtros = {}) {
    const filtrosNormalizados =
        validarFiltros(filtros);

    const modo =
        filtrosNormalizados.modo;

    if (modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda) {
            const texto =
                `%${filtrosNormalizados.busqueda}%`;

            condiciones.push(`
                (
                    pe.nombre LIKE ?
                    OR pe.apellido1 LIKE ?
                    OR pe.apellido2 LIKE ?
                    OR CAST(pe.id_persona AS CHAR) LIKE ?
                    OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        }

        const where =
            condiciones.length
                ? `AND ${condiciones.join(" AND ")}`
                : "";

        const [rows] = await pool.query(
            `
            SELECT
                e.id_estudiante,
                pe.nombre,
                pe.apellido1,
                pe.apellido2,
                e.estado
            FROM estudiante e
            INNER JOIN persona pe
                ON pe.id_persona = e.id_persona
            WHERE e.estado = TRUE
              AND NOT EXISTS (
                  SELECT 1
                  FROM grupo_estudiante ge
                  WHERE ge.id_estudiante = e.id_estudiante
                    AND ge.estado = TRUE
              )
              ${where}
            ORDER BY e.id_estudiante DESC
            LIMIT 500
            `,
            valores
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
            detalle_por_grupo: [
                {
                    tipo: "pre_matricula",
                    total_pre_matriculas:
                        rows.length,
                    total_estudiantes_activos:
                        rows.length
                }
            ]
        };
    }

    if (modo === "auditoria") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda) {
            const texto =
                `%${filtrosNormalizados.busqueda}%`;

            condiciones.push(`
                (
                    a.nombre_tabla LIKE ?
                    OR a.accion_usuario LIKE ?
                    OR a.datos_nuevos LIKE ?
                    OR CAST(a.id_usuario AS CHAR) LIKE ?
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto
            );
        }

        if (filtrosNormalizados.fecha_inicio) {
            condiciones.push(
                "DATE(a.fecha_creacion) >= ?"
            );

            valores.push(
                filtrosNormalizados.fecha_inicio
            );
        }

        if (filtrosNormalizados.fecha_fin) {
            condiciones.push(
                "DATE(a.fecha_creacion) <= ?"
            );

            valores.push(
                filtrosNormalizados.fecha_fin
            );
        }

        const where =
            condiciones.length
                ? `WHERE ${condiciones.join(" AND ")}`
                : "";

        const [rows] = await pool.query(
            `
            SELECT COUNT(*) AS total_auditorias
            FROM auditoria a
            ${where}
            `,
            valores
        );

        const total =
            Number(
                rows[0]?.total_auditorias || 0
            );

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
            detalle_por_grupo: [
                {
                    tipo: "auditoria",
                    total_auditorias: total
                }
            ]
        };
    }

    const {
        condiciones,
        valores
    } = construirCondicionesAsistencia(
        filtrosNormalizados
    );

    const [totalsRows] =
        await pool.query(
            `
            SELECT
                SUM(
                    CASE
                        WHEN a.estado_asistencia = 'presente'
                        THEN 1
                        ELSE 0
                    END
                ) AS presentes,

                SUM(
                    CASE
                        WHEN a.estado_asistencia = 'ausente'
                        THEN 1
                        ELSE 0
                    END
                ) AS ausentes,

                SUM(
                    CASE
                        WHEN a.estado_asistencia = 'tardia'
                        THEN 1
                        ELSE 0
                    END
                ) AS tardias,

                SUM(
                    CASE
                        WHEN a.estado_asistencia = 'justificada'
                        THEN 1
                        ELSE 0
                    END
                ) AS justificadas,

                COUNT(*) AS total_asistencias

            FROM asistencia a

            WHERE ${condiciones.join(" AND ")}
            `,
            valores
        );

    const [systemRows] =
        await pool.query(
            `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM estudiante
                    WHERE estado = TRUE
                ) AS total_estudiantes,

                (
                    SELECT COUNT(*)
                    FROM profesor
                    WHERE estado = TRUE
                ) AS total_profesores,

                (
                    SELECT COUNT(*)
                    FROM grupo
                    WHERE estado = TRUE
                ) AS total_grupos,

                (
                    SELECT COUNT(*)
                    FROM matricula
                    WHERE estado_matricula = 'activa'
                ) AS total_matriculas
            `
        );

    const {
        condiciones: grupoCondiciones,
        valores: grupoValores
    } = construirCondicionesGrupos(
        filtrosNormalizados
    );

    const [detailByGroup] =
        await pool.query(
            `
            SELECT
                g.id_grupo,
                g.nombre_grupo,
                s.nombre_seccion,
                s.nivel,

                fn_estudiantes_grupo(
                    g.id_grupo
                ) AS ocupados,

                g.capacidad,

                COUNT(
                    a.id_asistencia
                ) AS asistencias_registradas,

                COALESCE(
                    SUM(
                        CASE
                            WHEN a.estado_asistencia = 'presente'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS presentes,

                COALESCE(
                    SUM(
                        CASE
                            WHEN a.estado_asistencia = 'ausente'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS ausentes

            FROM grupo g

            INNER JOIN seccion s
                ON s.id_seccion = g.id_seccion

            LEFT JOIN asistencia a
                ON a.id_grupo = g.id_grupo
                AND a.estado = TRUE

            WHERE ${grupoCondiciones.join(" AND ")}

            GROUP BY
                g.id_grupo,
                g.nombre_grupo,
                s.nombre_seccion,
                s.nivel,
                g.capacidad

            ORDER BY g.nombre_grupo
            `,
            grupoValores
        );

    const base =
        systemRows[0] || {};

    const metric =
        totalsRows[0] || {};

    const total =
        Number(metric.total_asistencias || 0);

    const presentes =
        Number(metric.presentes || 0);

    return {
        modo,

        resumen: {
            total_estudiantes:
                Number(
                    base.total_estudiantes || 0
                ),

            total_profesores:
                Number(
                    base.total_profesores || 0
                ),

            total_grupos:
                Number(
                    base.total_grupos || 0
                ),

            total_matriculas:
                Number(
                    base.total_matriculas || 0
                ),

            total_asistencias:
                total,

            presentes,

            ausentes:
                Number(
                    metric.ausentes || 0
                ),

            tardias:
                Number(
                    metric.tardias || 0
                ),

            justificadas:
                Number(
                    metric.justificadas || 0
                ),

            tasa_presentismo:
                total
                    ? Math.round(
                        (presentes / total) * 100
                    )
                    : 0
        },

        detalle_por_grupo:
            detailByGroup
    };
}

export async function generarReporteDetalle(filtros = {}) {
    const filtrosNormalizados =
        validarFiltros(filtros);

    const modo =
        filtrosNormalizados.modo;

    if (modo === "pre_matricula") {
        const condiciones = [];
        const valores = [];

        if (filtrosNormalizados.busqueda) {
            const texto =
                `%${filtrosNormalizados.busqueda}%`;

            condiciones.push(`
                (
                    pe.nombre LIKE ?
                    OR pe.apellido1 LIKE ?
                    OR pe.apellido2 LIKE ?
                    OR CAST(pe.id_persona AS CHAR) LIKE ?
                    OR CAST(e.id_estudiante AS CHAR) LIKE ?
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto,
                texto
            );
        }

        const where =
            condiciones.length
                ? `AND ${condiciones.join(" AND ")}`
                : "";

        const [rows] =
            await pool.query(
                `
                SELECT
                    e.id_estudiante,

                    pe.nombre
                        AS estudiante_nombre,

                    pe.apellido1
                        AS estudiante_apellido1,

                    pe.apellido2
                        AS estudiante_apellido2,

                    e.estado,

                    NULL
                        AS nombre_grupo,

                    NULL
                        AS profesor_nombre,

                    NULL
                        AS estado_asistencia,

                    'Pendiente'
                        AS estado_matricula,

                    'Pre-matrícula'
                        AS tipo_reporte

                FROM estudiante e

                INNER JOIN persona pe
                    ON pe.id_persona = e.id_persona

                WHERE e.estado = TRUE

                  AND NOT EXISTS (
                      SELECT 1
                      FROM grupo_estudiante ge
                      WHERE ge.id_estudiante =
                            e.id_estudiante
                        AND ge.estado = TRUE
                  )

                  ${where}

                ORDER BY e.id_estudiante DESC

                LIMIT 500
                `,
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

        if (filtrosNormalizados.busqueda) {
            const texto =
                `%${filtrosNormalizados.busqueda}%`;

            condiciones.push(`
                (
                    a.nombre_tabla LIKE ?
                    OR a.accion_usuario LIKE ?
                    OR a.datos_nuevos LIKE ?
                    OR CAST(a.id_usuario AS CHAR) LIKE ?
                )
            `);

            valores.push(
                texto,
                texto,
                texto,
                texto
            );
        }

        if (filtrosNormalizados.fecha_inicio) {
            condiciones.push(
                "DATE(a.fecha_creacion) >= ?"
            );

            valores.push(
                filtrosNormalizados.fecha_inicio
            );
        }

        if (filtrosNormalizados.fecha_fin) {
            condiciones.push(
                "DATE(a.fecha_creacion) <= ?"
            );

            valores.push(
                filtrosNormalizados.fecha_fin
            );
        }

        const where =
            condiciones.length
                ? `WHERE ${condiciones.join(" AND ")}`
                : "";

        const [rows] =
            await pool.query(
                `
                SELECT
                    a.id_auditoria,
                    a.nombre_tabla,
                    a.accion_usuario,
                    a.datos_anteriores,
                    a.datos_nuevos,
                    a.fecha_creacion,
                    a.fecha_modificacion,
                    a.id_usuario,
                    u.nombre_usuario
                        AS usuario_nombre

                FROM auditoria a

                LEFT JOIN usuario u
                    ON u.id_usuario = a.id_usuario

                ${where}

                ORDER BY a.fecha_creacion DESC

                LIMIT 500
                `,
                valores
            );

        return {
            modo,
            detalle: rows
        };
    }

    const {
        condiciones,
        valores
    } = construirCondicionesAsistencia(
        filtrosNormalizados
    );

    const [rows] =
        await pool.query(
            `
            SELECT
                a.id_asistencia,
                a.fecha,
                a.id_estudiante,
                a.id_profesor,
                a.estado_asistencia,
                a.observaciones,

                pe.nombre
                    AS estudiante_nombre,

                pe.apellido1
                    AS estudiante_apellido1,

                pe.apellido2
                    AS estudiante_apellido2,

                g.nombre_grupo,

                s.nombre_seccion,

                pr.nombre
                    AS profesor_nombre,

                pr.apellido1
                    AS profesor_apellido1,

                pr.apellido2
                    AS profesor_apellido2,

                prof.materia
                    AS materia_curso,

                prof.estado
                    AS profesor_estado

            FROM asistencia a

            INNER JOIN estudiante e
                ON e.id_estudiante =
                   a.id_estudiante

            INNER JOIN persona pe
                ON pe.id_persona =
                   e.id_persona

            INNER JOIN grupo g
                ON g.id_grupo =
                   a.id_grupo

            INNER JOIN seccion s
                ON s.id_seccion =
                   g.id_seccion

            INNER JOIN profesor prof
                ON prof.id_profesor =
                   a.id_profesor

            INNER JOIN persona pr
                ON pr.id_persona =
                   prof.id_persona

            WHERE ${condiciones.join(" AND ")}

            ORDER BY
                a.fecha DESC,
                a.id_asistencia DESC

            LIMIT 500
            `,
            valores
        );

    return {
        modo,
        detalle: rows
    };
}
