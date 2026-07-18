const pool = require('../config/database');

/**
 * Proceso de registro de asistencia:
 * 1. Verifica que el profesor esté asignado activamente al grupo
 * 2. Verifica que el estudiante esté activo en ese grupo
 * 3. Registra la asistencia (sp_registrar_asistencia)
 */
async function registrarAsistenciaProceso(datos) {
  const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor } = datos;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verificar que el profesor esté asignado al grupo activamente
    const [profesorGrupo] = await connection.query(
      `SELECT id_grupo_profesor FROM grupo_profesor
       WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE`,
      [id_grupo, id_profesor]
    );
    if (profesorGrupo.length === 0) {
      throw new Error('El profesor no está asignado activamente a este grupo.');
    }

    // 2. Verificar que el estudiante pertenezca activamente al grupo
    const [estudianteGrupo] = await connection.query(
      `SELECT id_grupo_estudiante FROM grupo_estudiante
       WHERE id_grupo = ? AND id_estudiante = ? AND estado = TRUE`,
      [id_grupo, id_estudiante]
    );
    if (estudianteGrupo.length === 0) {
      throw new Error('El estudiante no pertenece activamente a este grupo.');
    }

    // 3. Registrar asistencia (el trigger valida que la fecha no sea futura)
    await connection.query(
      'CALL sp_registrar_asistencia(?, ?, ?, ?, ?, ?)',
      [fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor]
    );

    await connection.commit();
    return { success: true, message: 'Asistencia registrada correctamente.' };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { registrarAsistenciaProceso };