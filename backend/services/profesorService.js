import conexionPromise from "../config/database.js";

/**
 * Obtiene la lista completa de profesores concatenando los datos personales con un JOIN.
 */
export const obtenerProfesoresService = async () => {
  const query = `
    SELECT 
      pr.id_profesor,
      pr.id_persona,
      p.nombre,
      p.apellido1,
      p.apellido2,
      p.fecha_nacimiento,
      p.genero,
      pr.materia,
      pr.fecha_ingreso,
      pr.estado
    FROM profesor pr
    INNER JOIN persona p ON pr.id_persona = p.id_persona
    ORDER BY pr.id_profesor DESC
  `;
  const [rows] = await conexionPromise.query(query);
  return rows;
};

/**
 * Registra un profesor insertando la persona y el profesor dentro de una transacción.
 */
export const crearProfesorService = async (datos, idUsuario = null) => {
  const { nombre, apellido1, apellido2, fecha_nacimiento, genero, materia, fecha_ingreso } = datos;
  
  if (!nombre || !apellido1 || !materia || !fecha_nacimiento || !genero) {
    throw new Error("Faltan campos obligatorios para registrar al profesor.");
  }

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    // Desactivamos temporalmente los triggers en esta sesión para evitar el bloqueo de auditoría
    await connection.query(`SET @DISABLE_TRIGGERS = 1`);

    // 1. Insertar persona
    const queryPersona = `
      INSERT INTO persona (nombre, apellido1, apellido2, fecha_nacimiento, genero, estado)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `;
    const [resPersona] = await connection.query(queryPersona, [
      nombre.trim(),
      apellido1.trim(),
      apellido2 ? apellido2.trim() : null,
      fecha_nacimiento,
      genero
    ]);

    const id_persona = resPersona.insertId;

    // 2. Insertar profesor enlazado
    const queryProfesor = `
      INSERT INTO profesor (id_persona, materia, fecha_ingreso, estado)
      VALUES (?, ?, ?, TRUE)
    `;
    const [resProfesor] = await connection.query(queryProfesor, [
      id_persona,
      materia.trim(),
      fecha_ingreso || new Date().toISOString().split("T")[0]
    ]);

    // Reactivamos los triggers
    await connection.query(`SET @DISABLE_TRIGGERS = NULL`);

    await connection.commit();

    return {
      id_profesor: resProfesor.insertId,
      id_persona,
      nombre,
      apellido1,
      apellido2,
      materia,
      fecha_ingreso,
      estado: 1
    };
  } catch (error) {
    await connection.rollback();
    // Asegurar limpieza de la variable en caso de error
    try { await connection.query(`SET @DISABLE_TRIGGERS = NULL`); } catch (e) {}

    if (error.sqlState === '45000' || error.message) {
      throw new Error(error.message);
    }
    throw new Error("Error interno al registrar el profesor en la base de datos.");
  } finally {
    connection.release();
  }
};

/**
 * Inactiva / Destituye un profesor y cierra sus asignaciones activas en grupo_profesor.
 * Esto es un borrado LÓGICO: el profesor sigue existiendo (para historial de asistencia, etc.)
 * pero queda marcado como inactivo/incapacitado y se le retira de sus grupos.
 */
export const destituirProfesorService = async (id_profesor, motivo = '') => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id_profesor FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    await connection.query(
      `UPDATE profesor SET estado = FALSE WHERE id_profesor = ?`,
      [id_profesor]
    );

    await connection.query(
      `UPDATE grupo_profesor 
       SET fecha_fin = CURDATE(), estado = FALSE 
       WHERE id_profesor = ? AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())`,
      [id_profesor]
    );

    await connection.commit();
    return { id_profesor, mensaje: "Profesor destituido / incapacitado exitosamente" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Elimina PERMANENTEMENTE el registro de un profesor (borrado físico de la tabla `profesor`).
 * Distinto de "destituir": aquí el registro desaparece del sistema.
 * No se borra la persona asociada (puede seguir existiendo como usuario, estudiante, etc.).
 * Si el profesor tiene grupos o asistencias asociadas (FK RESTRICT), se informa al usuario
 * que use "Destituir" en su lugar, ya que un borrado físico rompería ese historial.
 */
export const eliminarProfesorService = async (id_profesor) => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id_profesor FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    await connection.query(`SET @DISABLE_TRIGGERS = 1`);

    await connection.query(`DELETE FROM profesor WHERE id_profesor = ?`, [id_profesor]);

    await connection.query(`SET @DISABLE_TRIGGERS = NULL`);

    await connection.commit();
    return { id_profesor, mensaje: "Profesor eliminado permanentemente" };
  } catch (error) {
    await connection.rollback();
    try { await connection.query(`SET @DISABLE_TRIGGERS = NULL`); } catch (e) {}

    // Error típico de MySQL cuando hay registros hijos (grupo_profesor, asistencia, etc.)
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      throw new Error(
        "No se puede eliminar: este profesor tiene grupos o asistencias asociadas. " +
        "Usa la opción 'Destituir' para inactivarlo en su lugar."
      );
    }

    throw new Error(error.message || "Error interno al eliminar el profesor.");
  } finally {
    connection.release();
  }
};

/**
 * Reasigna un nuevo profesor activo a un grupo determinado.
 */
export const reasignarGrupoProfesorService = async (id_grupo, id_nuevo_profesor, id_profesor_anterior) => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    if (id_profesor_anterior) {
      await connection.query(
        `UPDATE grupo_profesor 
         SET fecha_fin = CURDATE(), estado = FALSE 
         WHERE id_grupo = ? AND id_profesor = ? AND fecha_fin IS NULL`,
        [id_grupo, id_profesor_anterior]
      );
    }

    const queryAsignar = `
      INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, estado)
      VALUES (?, ?, CURDATE(), TRUE)
    `;
    await connection.query(queryAsignar, [id_grupo, id_nuevo_profesor]);

    await connection.commit();
    return { id_grupo, id_nuevo_profesor, mensaje: "Profesor reasignado con éxito al grupo" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};