import conexionPromise from "../config/database.js";
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
      pr.estado,
      GROUP_CONCAT(DISTINCT g.nombre_grupo ORDER BY g.nombre_grupo SEPARATOR ', ') AS grupos_asignados,
      (
        SELECT COUNT(*) FROM profesor_suplencia ps 
        WHERE ps.id_profesor_titular = pr.id_profesor AND ps.estado = TRUE
      ) AS grupos_pendientes
    FROM profesor pr
    INNER JOIN persona p ON pr.id_persona = p.id_persona
    LEFT JOIN grupo_profesor gp ON gp.id_profesor = pr.id_profesor AND gp.estado = TRUE AND gp.fecha_fin IS NULL
    LEFT JOIN grupo g ON g.id_grupo = gp.id_grupo
    GROUP BY pr.id_profesor
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

  const nombreLimpio = nombre.trim();
  const apellido1Limpio = apellido1.trim();
  const apellido2Limpio = apellido2 ? apellido2.trim() : null;

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();
    const [duplicados] = await connection.query(
      `SELECT pr.id_profesor, pr.estado
       FROM profesor pr
       INNER JOIN persona p ON p.id_persona = pr.id_persona
       WHERE LOWER(TRIM(p.nombre)) = LOWER(?)
         AND LOWER(TRIM(p.apellido1)) = LOWER(?)
         AND LOWER(TRIM(COALESCE(p.apellido2, ''))) = LOWER(TRIM(COALESCE(?, '')))
       LIMIT 1`,
      [nombreLimpio, apellido1Limpio, apellido2Limpio]
    );

    if (duplicados.length > 0) {
      const yaActivo = duplicados[0].estado == 1 || duplicados[0].estado === true;
      throw new Error(
        yaActivo
          ? `Ya existe un profesor activo (ID ${duplicados[0].id_profesor}) con ese mismo nombre y apellidos.`
          : `Ya existe un registro de ese profesor (ID ${duplicados[0].id_profesor}) con ese mismo nombre y apellidos, pero está inactivo/destituido. Usa "Reintegrar" en lugar de crear uno nuevo.`
      );
    }

    // Desactivamos temporalmente los triggers en esta sesión para evitar el bloqueo de auditoría
    await connection.query(`SET @DISABLE_TRIGGERS = 1`);

    // 1. Insertar persona
    const queryPersona = `
      INSERT INTO persona (nombre, apellido1, apellido2, fecha_nacimiento, genero, estado)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `;
    const [resPersona] = await connection.query(queryPersona, [
      nombreLimpio,
      apellido1Limpio,
      apellido2Limpio,
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

export const destituirProfesorService = async (id_profesor, motivo = '') => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id_profesor, estado FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    if (rows[0].estado == 0 || rows[0].estado === false) {
      throw new Error("El profesor ya se encuentra inactivo.");
    }

    // Grupos que el profesor tiene activos justo antes de destituirlo: son los que
    // vamos a "congelar" en profesor_suplencia para poder restaurarlos después.
    const [gruposActivos] = await connection.query(
      `SELECT id_grupo FROM grupo_profesor 
       WHERE id_profesor = ? AND estado = TRUE AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())`,
      [id_profesor]
    );

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

    for (const { id_grupo } of gruposActivos) {
      await connection.query(
        `INSERT INTO profesor_suplencia 
           (id_grupo, id_profesor_titular, id_profesor_suplente, fecha_inicio, estado, motivo)
         VALUES (?, ?, NULL, CURDATE(), TRUE, ?)`,
        [id_grupo, id_profesor, motivo || null]
      );
    }

    await connection.commit();
    return {
      id_profesor,
      grupos_liberados: gruposActivos.length,
      mensaje: "Profesor destituido / incapacitado exitosamente"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const reintegrarProfesorService = async (id_profesor) => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id_profesor, estado FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    if (rows[0].estado == 1 || rows[0].estado === true) {
      throw new Error("El profesor ya se encuentra activo.");
    }

    await connection.query(
      `UPDATE profesor SET estado = TRUE WHERE id_profesor = ?`,
      [id_profesor]
    );

    const [pendientes] = await connection.query(
      `SELECT ps.id_suplencia, ps.id_grupo, ps.id_profesor_suplente, g.estado AS grupo_activo
       FROM profesor_suplencia ps
       INNER JOIN grupo g ON g.id_grupo = ps.id_grupo
       WHERE ps.id_profesor_titular = ? AND ps.estado = TRUE`,
      [id_profesor]
    );

    const gruposRestaurados = [];
    const gruposOmitidos = [];

    for (const p of pendientes) {
      // El grupo ya no existe / fue desactivado: no hay a dónde restaurarlo.
      if (p.grupo_activo == 0 || p.grupo_activo === false) {
        gruposOmitidos.push(p.id_grupo);
        await connection.query(
          `UPDATE profesor_suplencia SET estado = FALSE, fecha_fin = CURDATE() WHERE id_suplencia = ?`,
          [p.id_suplencia]
        );
        continue;
      }

      // Si alguien quedó cubriendo el grupo provisionalmente, se le retira.
      if (p.id_profesor_suplente) {
        await connection.query(
          `UPDATE grupo_profesor 
           SET fecha_fin = CURDATE(), estado = FALSE 
           WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())`,
          [p.id_grupo, p.id_profesor_suplente]
        );
      }

      // Se restaura al titular en su grupo original.
      await connection.query(
        `INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, estado)
         VALUES (?, ?, CURDATE(), TRUE)`,
        [p.id_grupo, id_profesor]
      );

      await connection.query(
        `UPDATE profesor_suplencia SET estado = FALSE, fecha_fin = CURDATE() WHERE id_suplencia = ?`,
        [p.id_suplencia]
      );

      gruposRestaurados.push(p.id_grupo);
    }

    await connection.commit();
    return {
      id_profesor,
      grupos_restaurados: gruposRestaurados,
      grupos_omitidos: gruposOmitidos,
      mensaje: "Profesor reintegrado exitosamente"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

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

    // Error típico de MySQL cuando hay registros hijos (grupo_profesor, asistencia,
    // profesor_suplencia, etc.)
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      throw new Error(
        "No se puede eliminar: este profesor tiene grupos, asistencias o coberturas de suplencia asociadas. " +
        "Usa la opción 'Destituir' para inactivarlo en su lugar."
      );
    }

    throw new Error(error.message || "Error interno al eliminar el profesor.");
  } finally {
    connection.release();
  }
};

export const reasignarGrupoProfesorService = async (id_grupo, id_nuevo_profesor, id_profesor_anterior) => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [nuevoProf] = await connection.query(
      `SELECT id_profesor, estado FROM profesor WHERE id_profesor = ?`,
      [id_nuevo_profesor]
    );
    if (nuevoProf.length === 0) {
      throw new Error("El profesor a asignar no existe.");
    }
    if (nuevoProf[0].estado == 0 || nuevoProf[0].estado === false) {
      throw new Error("No se puede asignar un profesor inactivo al grupo.");
    }

    if (id_profesor_anterior) {
      await connection.query(
        `UPDATE grupo_profesor 
         SET fecha_fin = CURDATE(), estado = FALSE 
         WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())`,
        [id_grupo, id_profesor_anterior]
      );
    }

    const queryAsignar = `
      INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, estado)
      VALUES (?, ?, CURDATE(), TRUE)
    `;
    await connection.query(queryAsignar, [id_grupo, id_nuevo_profesor]);

    let provisional = false;
    if (id_profesor_anterior) {
      const [suplenciaPendiente] = await connection.query(
        `SELECT id_suplencia FROM profesor_suplencia 
         WHERE id_grupo = ? AND id_profesor_titular = ? AND id_profesor_suplente IS NULL AND estado = TRUE
         LIMIT 1`,
        [id_grupo, id_profesor_anterior]
      );
      if (suplenciaPendiente.length > 0) {
        await connection.query(
          `UPDATE profesor_suplencia SET id_profesor_suplente = ? WHERE id_suplencia = ?`,
          [id_nuevo_profesor, suplenciaPendiente[0].id_suplencia]
        );
        provisional = true;
      }
    }

    await connection.commit();
    return {
      id_grupo,
      id_nuevo_profesor,
      provisional,
      mensaje: provisional
        ? "Profesor asignado provisionalmente al grupo (se restaurará el titular al reintegrarlo)"
        : "Profesor reasignado con éxito al grupo"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const obtenerSuplenciasPendientesService = async () => {
  const query = `
    SELECT 
      ps.id_suplencia,
      ps.id_grupo,
      g.nombre_grupo,
      ps.id_profesor_titular,
      CONCAT(pt.nombre, ' ', pt.apellido1) AS titular_nombre,
      ps.id_profesor_suplente,
      CASE WHEN ps.id_profesor_suplente IS NOT NULL 
           THEN CONCAT(psup.nombre, ' ', psup.apellido1) ELSE NULL END AS suplente_nombre,
      ps.fecha_inicio,
      ps.motivo
    FROM profesor_suplencia ps
    INNER JOIN grupo g ON g.id_grupo = ps.id_grupo
    INNER JOIN profesor prt ON prt.id_profesor = ps.id_profesor_titular
    INNER JOIN persona pt ON pt.id_persona = prt.id_persona
    LEFT JOIN profesor prs ON prs.id_profesor = ps.id_profesor_suplente
    LEFT JOIN persona psup ON psup.id_persona = prs.id_persona
    WHERE ps.estado = TRUE
    ORDER BY ps.fecha_inicio DESC
  `;
  const [rows] = await conexionPromise.query(query);
  return rows;
};