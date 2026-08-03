import pool from "../config/database.js";

const ESTADOS_VALIDOS = ["presente", "ausente", "tardia", "justificada"];

export async function registrarAsistenciaProceso(datos) {
  const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor } = datos;

  const estadoNormalizado = (estado_asistencia || "").toLowerCase().trim();
  if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
    throw new Error(`Estado de asistencia no válido. Usa uno de: ${ESTADOS_VALIDOS.join(", ")}.`);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [profesorGrupo] = await connection.query(
      `SELECT id_grupo_profesor FROM grupo_profesor
       WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE`,
      [id_grupo, id_profesor]
    );
    if (profesorGrupo.length === 0) {
      throw new Error("El profesor no está asignado activamente a este grupo.");
    }

    const [estudianteGrupo] = await connection.query(
      `SELECT id_grupo_estudiante FROM grupo_estudiante
       WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE`,
      [id_grupo, id_estudiante]
    );
    if (estudianteGrupo.length === 0) {
      throw new Error("El estudiante no pertenece activamente a este grupo.");
    }

    const [duplicado] = await connection.query(
      `SELECT id_asistencia FROM asistencia
       WHERE id_estudiante = ? AND id_grupo = ? AND fecha = ? AND estado = TRUE`,
      [id_estudiante, id_grupo, fecha]
    );
    if (duplicado.length > 0) {
      throw new Error("Ya existe un registro de asistencia para este estudiante, en este grupo, en esa fecha.");
    }

    await connection.query(
      "CALL sp_registrar_asistencia(?, ?, ?, ?, ?, ?)",
      [fecha, estadoNormalizado, observaciones || null, id_estudiante, id_grupo, id_profesor]
    );

    await connection.commit();
    return { mensaje: "Asistencia registrada correctamente." };

  } catch (error) {
    await connection.rollback();
    throw new Error(error.sqlMessage || error.message);
  } finally {
    connection.release();
  }
}

/**
 * Lista asistencias con soporte para filtros y restricción de seguridad si el usuario es profesor.
 */
export async function listarAsistencias(filtros = {}, usuarioActual = null) {
  const {
    id_grupo,
    id_estudiante,
    id_profesor,
    estado_asistencia,
    fecha_inicio,
    fecha_fin,
    busqueda
  } = filtros;

  const condiciones = ["a.estado = TRUE"];
  const valores = [];

  // Seguridad por rol: Si es profesor, limitamos a sus grupos o suplencias activas
  // FIX #1: el campo real del rol es "nom_rol" (ver usuarioModel.js), no "rol".
  const rol = (usuarioActual?.nom_rol || "").toLowerCase();
  if (rol === "profesor") {
    const idProfesor = usuarioActual.id_profesor;
    if (!idProfesor) {
      return [];
    }
    // FIX #3: "grupo" no tiene columna "id_profesor". La asignación profesor-grupo
    // vive en "grupo_profesor" (join añadido más abajo, alias gp_filtro).
    condiciones.push("(gp_filtro.id_profesor = ? OR s_filtro.id_profesor_suplente = ?)");
    valores.push(idProfesor, idProfesor);
  }

  if (id_grupo) {
    condiciones.push("a.id_grupo = ?");
    valores.push(id_grupo);
  }

  if (id_estudiante) {
    condiciones.push("a.id_estudiante = ?");
    valores.push(id_estudiante);
  }

  if (id_profesor && rol !== "profesor") {
    condiciones.push("a.id_profesor = ?");
    valores.push(id_profesor);
  }

  if (estado_asistencia) {
    const estadoNormalizado = String(estado_asistencia).toLowerCase().trim();
    if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
      throw new Error(`Estado de asistencia no válido. Usa uno de: ${ESTADOS_VALIDOS.join(", ")}.`);
    }
    condiciones.push("a.estado_asistencia = ?");
    valores.push(estadoNormalizado);
  }

  if (fecha_inicio) {
    condiciones.push("a.fecha >= ?");
    valores.push(fecha_inicio);
  }

  if (fecha_fin) {
    condiciones.push("a.fecha <= ?");
    valores.push(fecha_fin);
  }

  if (busqueda && busqueda.trim()) {
    condiciones.push("(pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ?)");
    const like = `%${busqueda.trim()}%`;
    valores.push(like, like, like);
  }

  // FIX #2 y #3: la tabla se llama "profesor_suplencia" (no "suplencia"), su columna
  // de estado se llama "estado" (no "activo"), y se añade el JOIN a "grupo_profesor"
  // porque "grupo" no tiene columna "id_profesor" propia.
  const [filas] = await pool.query(
    `SELECT DISTINCT
        a.id_asistencia,
        a.fecha,
        a.estado_asistencia,
        a.observaciones,
        a.id_estudiante,
        a.id_grupo,
        a.id_profesor,
        pe.nombre        AS estudiante_nombre,
        pe.apellido1      AS estudiante_apellido1,
        pe.apellido2      AS estudiante_apellido2,
        g.nombre_grupo,
        pr.nombre         AS profesor_nombre,
        pr.apellido1      AS profesor_apellido1
     FROM asistencia a
     INNER JOIN estudiante e   ON a.id_estudiante = e.id_estudiante
     INNER JOIN persona pe     ON e.id_persona = pe.id_persona
     INNER JOIN grupo g        ON a.id_grupo = g.id_grupo
     INNER JOIN profesor prof  ON a.id_profesor = prof.id_profesor
     INNER JOIN persona pr     ON prof.id_persona = pr.id_persona
     LEFT JOIN grupo_profesor gp_filtro     ON gp_filtro.id_grupo = g.id_grupo AND gp_filtro.estado = TRUE
     LEFT JOIN profesor_suplencia s_filtro  ON s_filtro.id_grupo = g.id_grupo AND s_filtro.estado = TRUE
     WHERE ${condiciones.join(" AND ")}
     ORDER BY a.fecha DESC, a.id_asistencia DESC
     LIMIT 500`,
    valores
  );

  return filas;
}

export default registrarAsistenciaProceso;