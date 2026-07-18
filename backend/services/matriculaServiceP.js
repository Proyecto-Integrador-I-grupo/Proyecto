import pool from "../config/database.js";

/**
 * Proceso completo de matrícula:
 * 1. Verifica que el estudiante exista y esté activo
 * 2. Verifica cupo disponible en el grupo
 * 3. Registra la matrícula (sp_registrar_matricula)
 * 4. Asigna al estudiante al grupo (sp_asignar_estudiante_grupo)
 * Todo dentro de una transacción: si algo falla, se revierte todo.
 */
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

    // 1. Verificar que el estudiante esté activo
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

    // 2. Verificar cupo disponible en el grupo (usa fn_estudiantes_grupo)
    const [grupoRows] = await connection.query(
      "SELECT capacidad, fn_estudiantes_grupo(?) AS ocupados FROM grupo WHERE id_grupo = ?",
      [id_grupo, id_grupo]
    );

    if (grupoRows.length === 0) {
      throw new Error("El grupo no existe.");
    }
    const { capacidad, ocupados } = grupoRows[0];
    if (ocupados >= capacidad) {
      throw new Error("El grupo ya no tiene cupo disponible.");
    }

    // 3. Registrar matrícula vía stored procedure
    await connection.query(
      "CALL sp_registrar_matricula(?, ?, ?, ?, ?, ?, ?, ?)",
      [fecha, periodo, anio, tipo, estado, observaciones, id_estudiante, id_usuario]
    );

    // 4. Asignar estudiante al grupo vía stored procedure
    await connection.query(
      "CALL sp_asignar_estudiante_grupo(?, ?, ?)",
      [fecha, id_grupo, id_estudiante]
    );

    await connection.commit();
    return { success: true, message: "Matrícula procesada correctamente." };

  } catch (error) {
    await connection.rollback();
    throw error; // el controller decide cómo responder al cliente
  } finally {
    connection.release();
  }
}

export default procesarMatricula;