import pool from "../config/database.js";

/* ==========================================
   MATRÍCULA
   ========================================== */
export async function procesarMatricula(datos) {
  const {
    fecha,
    periodo,
    anio,
    tipo,
    estado,
    observaciones,
    id_estudiante,
    id_usuario,
    id_grupo
  } = datos;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Validar existencia y estado del estudiante
    const [estudianteRows] = await connection.query(
      "SELECT estado FROM estudiante WHERE id_estudiante = ?",
      [id_estudiante]
    );
    if (estudianteRows.length === 0) {
      throw new Error("El estudiante no existe.");
    }
    if (!estudianteRows[0].estado) {
      throw new Error("No se puede matricular a un estudiante inactivo.");
    }

    // 2. Validar que el usuario que procesa exista y esté activo
    const [usuarioRows] = await connection.query(
      "SELECT estado FROM usuario WHERE id_usuario = ?",
      [id_usuario]
    );
    if (usuarioRows.length === 0 || !usuarioRows[0].estado) {
      throw new Error("El usuario que procesa la matrícula no es válido.");
    }

    // 3. Validar existencia y capacidad del grupo (bloquea la fila para actualizar cupos de forma segura)
    const [grupoRows] = await connection.query(
      "SELECT capacidad, estado, fn_estudiantes_grupo(id_grupo) AS ocupados FROM grupo WHERE id_grupo = ? FOR UPDATE",
      [id_grupo]
    );
    if (grupoRows.length === 0) {
      throw new Error("El grupo no existe.");
    }
    if (!grupoRows[0].estado) {
      throw new Error("El grupo seleccionado está inactivo.");
    }
    const { capacidad, ocupados } = grupoRows[0];
    if (ocupados >= capacidad) {
      throw new Error("El grupo ya no tiene cupo disponible.");
    }

    // 4. Evitar matricular dos veces al mismo estudiante en el mismo grupo
    const [yaEnGrupo] = await connection.query(
      "SELECT id_grupo_estudiante FROM grupo_estudiante WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE",
      [id_grupo, id_estudiante]
    );
    if (yaEnGrupo.length > 0) {
      throw new Error("El estudiante ya está matriculado en este grupo.");
    }

    // 5. Registrar matrícula
    // OJO: sp_registrar_matricula declara p_observaciones como VARCHAR(20)
    // (no 100, como sí permite la columna real). En modo estricto de MySQL,
    // mandarle algo más largo revienta la transacción entera con
    // "Data too long for column", así que se recorta de forma segura aquí.
    const observacionesMatricula = observaciones ? observaciones.trim().slice(0, 20) : null;
    const observacionesDetalle = observaciones ? observaciones.trim().slice(0, 150) : null;

    await connection.query(
      "CALL sp_registrar_matricula(?, ?, ?, ?, ?, ?, ?, ?)",
      [fecha, periodo, anio, tipo, estado, observacionesMatricula, id_estudiante, id_usuario]
    );
    const [[{ id_matricula }]] = await connection.query(
      "SELECT LAST_INSERT_ID() AS id_matricula"
    );

    // 6. Registrar detalle de matrícula
    if (id_matricula) {
      await connection.query(
        "CALL sp_registrar_detalle_matricula(?, ?, ?, ?)",
        [fecha, observacionesDetalle, id_matricula, id_grupo]
      );
    }

    // 7. Asignar al estudiante al grupo (esto llena formalmente el cupo en base de datos)
    await connection.query(
      "CALL sp_asignar_estudiante_grupo(?, ?, ?)",
      [fecha, id_grupo, id_estudiante]
    );

    await connection.commit();
    return { mensaje: "Matrícula procesada correctamente.", id_matricula };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ==========================================
   GRUPOS
   ========================================== */
export async function obtenerGruposService() {
  const [rows] = await pool.query(
    `SELECT
        g.id_grupo,
        g.nombre_grupo,
        g.capacidad,
        g.aula,
        g.id_seccion,
        s.nombre_seccion,
        s.nivel,
        s.periodo_lectivo,
        fn_estudiantes_grupo(g.id_grupo) AS ocupados
     FROM grupo g
     INNER JOIN seccion s ON g.id_seccion = s.id_seccion
     WHERE g.estado = TRUE
     ORDER BY s.periodo_lectivo DESC, s.nivel, g.nombre_grupo`
  );
  return rows;
}

export async function crearGrupoService(datos) {
  const { nombre_grupo, capacidad, aula, id_profesor, id_seccion } = datos;

  const nombreLimpio = (nombre_grupo || "").trim();
  const capacidadNum = Number(capacidad);
  const idProfesorNum = Number(id_profesor);
  const idSeccionNum = Number(id_seccion);

  if (!nombreLimpio) throw new Error("El nombre del grupo es obligatorio.");
  if (!Number.isInteger(capacidadNum) || capacidadNum <= 0) throw new Error("La capacidad debe ser un número entero mayor a cero.");
  if (!Number.isInteger(idSeccionNum) || idSeccionNum <= 0) throw new Error("Debe seleccionar una sección académica.");
  if (!Number.isInteger(idProfesorNum) || idProfesorNum <= 0) throw new Error("Debe asignar un profesor encargado.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [seccionRows] = await connection.query(
      "SELECT id_seccion FROM seccion WHERE id_seccion = ? AND estado = TRUE",
      [idSeccionNum]
    );
    if (seccionRows.length === 0) throw new Error("La sección seleccionada no existe o está inactiva.");

    const [profesorRows] = await connection.query(
      "SELECT estado FROM profesor WHERE id_profesor = ?",
      [idProfesorNum]
    );
    if (profesorRows.length === 0) throw new Error("El profesor seleccionado no existe.");
    if (!profesorRows[0].estado) throw new Error("No se puede asignar un profesor inactivo a un grupo.");

    const [dupRows] = await connection.query(
      "SELECT id_grupo FROM grupo WHERE nombre_grupo = ? AND id_seccion = ? AND estado = TRUE",
      [nombreLimpio, idSeccionNum]
    );
    if (dupRows.length > 0) throw new Error("Ya existe un grupo con ese nombre en la sección seleccionada.");

    const [result] = await connection.query(
      "INSERT INTO grupo (nombre_grupo, estado, capacidad, aula, id_seccion) VALUES (?, TRUE, ?, ?, ?)",
      [nombreLimpio, capacidadNum, aula ? aula.trim() : null, idSeccionNum]
    );
    const id_grupo = result.insertId;

    await connection.query(
      "CALL sp_asignar_profesor_grupo(?, ?, ?, ?)",
      [new Date().toISOString().split("T")[0], null, id_grupo, idProfesorNum]
    );

    await connection.commit();
    return { mensaje: "Grupo creado correctamente.", id_grupo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ==========================================
   ROSTER DE GRUPO (para Asistencia)
   ========================================== */
// Los estudiantes matriculados YA NO aparecen en /api/estudiantes (esa lista es
// solo el pre-registro de pendientes). Asistencia necesita justo lo contrario:
// quién SÍ está activo en el grupo, más quién es su profesor asignado.
export async function obtenerDetalleGrupoService(id_grupo) {
  const [estudiantes] = await pool.query(
    `SELECT e.id_estudiante, p.nombre, p.apellido1, p.apellido2
     FROM grupo_estudiante ge
     INNER JOIN estudiante e ON ge.id_estudiante = e.id_estudiante
     INNER JOIN persona p ON e.id_persona = p.id_persona
     WHERE ge.id_grupo = ? AND ge.estado = TRUE AND e.estado = TRUE
     ORDER BY p.apellido1, p.apellido2, p.nombre`,
    [id_grupo]
  );

  const [profesores] = await pool.query(
    `SELECT pr.id_profesor, p.nombre, p.apellido1, p.apellido2, pr.materia
     FROM grupo_profesor gp
     INNER JOIN profesor pr ON gp.id_profesor = pr.id_profesor
     INNER JOIN persona p ON pr.id_persona = p.id_persona
     WHERE gp.id_grupo = ? AND gp.estado = TRUE AND pr.estado = TRUE`,
    [id_grupo]
  );

  return { estudiantes, profesores };
}

export default procesarMatricula;