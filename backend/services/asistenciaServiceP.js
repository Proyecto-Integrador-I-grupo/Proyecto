import pool from "../config/database.js";
import { validarFechaAsistencia } from "./businessRulesService.js";

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

    await validarFechaAsistencia(connection, id_grupo, fecha);

    const [profesorGrupo] = await connection.query(
      `SELECT gp.id_grupo_profesor FROM grupo_profesor gp
       WHERE gp.id_grupo = ? AND gp.id_profesor = ? AND gp.estado = TRUE
         AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE())
       UNION
       SELECT ps.id_suplencia FROM profesor_suplencia ps
       WHERE ps.id_grupo = ? AND ps.id_profesor_suplente = ? AND ps.estado = TRUE
         AND CURDATE() BETWEEN ps.fecha_inicio AND ps.fecha_fin`,
      [id_grupo, id_profesor, id_grupo, id_profesor]
    );
    if (profesorGrupo.length === 0) {
      throw new Error("El profesor no está asignado activamente a este grupo ni lo cubre como sustituto.");
    }

    const [estudianteGrupo] = await connection.query(
      `SELECT id_grupo_estudiante FROM grupo_estudiante
       WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE`,
      [id_grupo, id_estudiante]
    );
    if (estudianteGrupo.length === 0) {
      throw new Error("El estudiante no pertenece activamente a este grupo.");
    }

    // La asistencia es del estudiante en el grupo y día; el profesor identifica al responsable,
    // no crea una bitácora paralela. Así administrador y profesor ven el mismo registro.
    const [duplicado] = await connection.query(
      `SELECT id_asistencia FROM asistencia
       WHERE id_estudiante = ? AND id_grupo = ? AND fecha = ? AND estado = TRUE LIMIT 1`,
      [id_estudiante, id_grupo, fecha]
    );
    if (duplicado.length > 0) {
      await connection.query(
        `UPDATE asistencia SET estado_asistencia = ?, observaciones = ?, id_profesor = ? WHERE id_asistencia = ?`,
        [estadoNormalizado, observaciones || null, id_profesor, duplicado[0].id_asistencia]
      );
      await connection.commit();
      return { mensaje: 'Asistencia actualizada correctamente.', id_asistencia: duplicado[0].id_asistencia, actualizada: true };
    }

    const [resultado] = await connection.query(
      `INSERT INTO asistencia
        (fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor, estado)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [fecha, estadoNormalizado, observaciones || null, id_estudiante, id_grupo, id_profesor]
    );

    await connection.commit();
    return {
      mensaje: "Asistencia registrada correctamente.",
      id_asistencia: resultado.insertId
    };

  } catch (error) {
    await connection.rollback();
    throw new Error(error.sqlMessage || error.message);
  } finally {
    connection.release();
  }
}

/**
 * Lista asistencias con soporte para filtros y restricción de seguridad si el usuario es profesor.
 * NUEVO: soporta filtro por "materia" (curso) y devuelve materia_curso en cada registro.
 */
export async function listarAsistencias(filtros = {}, usuarioActual = null) {
  const {
    id_grupo,
    id_estudiante,
    id_profesor,
    estado_asistencia,
    fecha_inicio,
    fecha_fin,
    busqueda,
    materia
  } = filtros;

  const condiciones = ["a.estado = TRUE"];
  const valores = [];

  const rol = (usuarioActual?.nom_rol || "").toLowerCase();

  // El profesor consulta la bitácora compartida de los grupos que imparte o cubre.
  if (rol === "profesor") {
    const idProfesor = usuarioActual.id_profesor;
    if (!idProfesor) return [];
    condiciones.push(`(
      EXISTS (SELECT 1 FROM grupo_profesor gpv WHERE gpv.id_grupo = a.id_grupo AND gpv.id_profesor = ? AND gpv.estado = TRUE AND (gpv.fecha_fin IS NULL OR gpv.fecha_fin >= CURDATE()))
      OR EXISTS (SELECT 1 FROM profesor_suplencia psv WHERE psv.id_grupo = a.id_grupo AND psv.id_profesor_suplente = ? AND psv.estado = TRUE AND CURDATE() BETWEEN psv.fecha_inicio AND psv.fecha_fin)
    )`);
    valores.push(idProfesor, idProfesor);
  } else if (id_profesor) {
    condiciones.push("a.id_profesor = ?");
    valores.push(id_profesor);
  }

  if (id_grupo) {
    condiciones.push("a.id_grupo = ?");
    valores.push(id_grupo);
  }

  if (id_estudiante) {
    condiciones.push("a.id_estudiante = ?");
    valores.push(id_estudiante);
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

  // NUEVO: filtro por materia/curso (columna materia vive en la tabla `profesor`, alias `prof`)
  if (materia && materia.trim()) {
    condiciones.push("prof.materia = ?");
    valores.push(materia.trim());
  }

  if (busqueda && busqueda.trim()) {
    condiciones.push("(pe.nombre LIKE ? OR pe.apellido1 LIKE ? OR pe.apellido2 LIKE ?)");
    const like = `%${busqueda.trim()}%`;
    valores.push(like, like, like);
  }

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
        sec.nombre_seccion,
        pr.nombre         AS profesor_nombre,
        pr.apellido1      AS profesor_apellido1,
        prof.materia      AS materia_curso
     FROM asistencia a
     INNER JOIN estudiante e   ON a.id_estudiante = e.id_estudiante
     INNER JOIN persona pe     ON e.id_persona = pe.id_persona
     INNER JOIN grupo g        ON a.id_grupo = g.id_grupo
     INNER JOIN seccion sec     ON g.id_seccion = sec.id_seccion
     INNER JOIN profesor prof  ON a.id_profesor = prof.id_profesor
     INNER JOIN persona pr     ON prof.id_persona = pr.id_persona
     WHERE ${condiciones.join(" AND ")}
     ORDER BY a.fecha DESC, a.id_asistencia DESC
     LIMIT 500`,
    valores
  );

  return filas;
}


export async function eliminarAsistenciaProceso(idAsistencia, usuarioActual = null) {
  const id = Number(idAsistencia);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("El identificador de asistencia no es válido.");
  }

  const rol = String(usuarioActual?.nom_rol || usuarioActual?.rol || "").toLowerCase().trim();
  if (rol !== "administrador") {
    throw new Error("Solo un administrador puede eliminar registros de asistencia.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM asistencia WHERE id_asistencia = ? FOR UPDATE",
      [id]
    );

    if (!rows.length) {
      throw new Error("Registro de asistencia no encontrado.");
    }

    await validarFechaAsistencia(connection, rows[0].id_grupo, rows[0].fecha);
    await connection.query(
      "UPDATE asistencia SET estado = FALSE WHERE id_asistencia = ?",
      [id]
    );

    await connection.commit();
    return { mensaje: "Registro de asistencia anulado correctamente.", registro: rows[0] };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default registrarAsistenciaProceso;