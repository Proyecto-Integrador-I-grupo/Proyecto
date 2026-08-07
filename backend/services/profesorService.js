import conexionPromise from "../config/database.js";
import bcrypt from "bcryptjs";
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
      GROUP_CONCAT(DISTINCT g.id_grupo ORDER BY g.nombre_grupo SEPARATOR ',') AS grupos_ids,
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
  const { nombre, apellido1, apellido2, fecha_nacimiento, genero, materia, fecha_ingreso, correo, contrasena } = datos;

  if (!nombre || !apellido1 || !materia || !fecha_nacimiento || !genero) {
    throw new Error("Faltan campos obligatorios para registrar al profesor.");
  }

  if (!correo || !contrasena) {
    throw new Error("El correo y la contraseña de acceso son obligatorios para registrar al profesor.");
  }

  if (contrasena.length < 6) {
    throw new Error("La contraseña de acceso debe tener al menos 6 caracteres.");
  }

  const nombreLimpio = nombre.trim();
  const apellido1Limpio = apellido1.trim();
  const apellido2Limpio = apellido2 ? apellido2.trim() : null;
  const correoLimpio = correo.trim().toLowerCase();

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

    const [correoExistente] = await connection.query(
      `SELECT id_usuario FROM usuario WHERE correo = ? LIMIT 1`,
      [correoLimpio]
    );

    if (correoExistente.length > 0) {
      throw new Error("Ya existe un usuario registrado con ese correo.");
    }

    const [rolProfesor] = await connection.query(
      `SELECT id_rol FROM rol WHERE LOWER(TRIM(nom_rol)) = 'profesor' LIMIT 1`
    );

    if (rolProfesor.length === 0) {
      throw new Error("No se encontró el rol 'Profesor' configurado en el sistema.");
    }

    const id_rol_profesor = rolProfesor[0].id_rol;

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

    // 3. Insertar el usuario de acceso del profesor (rol "Profesor", acceso limitado)
    const hashContrasena = await bcrypt.hash(contrasena, 10);
    const queryUsuario = `
      INSERT INTO usuario (correo, contrasena, id_persona, id_rol, estado)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    const [resUsuario] = await connection.query(queryUsuario, [
      correoLimpio,
      hashContrasena,
      id_persona,
      id_rol_profesor
    ]);

    // Reactivamos los triggers
    await connection.query(`SET @DISABLE_TRIGGERS = NULL`);

    await connection.commit();

    return {
      id_profesor: resProfesor.insertId,
      id_persona,
      id_usuario: resUsuario.insertId,
      nombre,
      apellido1,
      apellido2,
      materia,
      fecha_ingreso,
      correo: correoLimpio,
      estado: 1
    };
  } catch (error) {
    await connection.rollback();
    // Asegurar limpieza de la variable en caso de error
    try { await connection.query(`SET @DISABLE_TRIGGERS = NULL`); } catch (e) {}

    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error("Ya existe un usuario registrado con ese correo.");
    }

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
      `SELECT ps.id_suplencia, ps.id_grupo, ps.id_profesor_suplente, ps.fecha_inicio, g.estado AS grupo_activo
       FROM profesor_suplencia ps
       INNER JOIN grupo g ON g.id_grupo = ps.id_grupo
       WHERE ps.id_profesor_titular = ? AND ps.estado = TRUE`,
      [id_profesor]
    );

    const gruposRestaurados = [];
    const gruposOmitidos = [];
    let asistenciasReasignadas = 0;

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

        // NUEVO: reasignar al titular las asistencias que tomó el suplente
        // durante la ventana real de esta suplencia (fecha_inicio -> hoy).
        // El trigger trg_asistencia_after_update ya registra esto en `auditoria`
        // fila por fila (OLD.id_profesor = suplente, NEW.id_profesor = titular),
        // así que no hace falta auditar esto manualmente aquí.
        const [reasignadas] = await connection.query(
          `UPDATE asistencia
           SET id_profesor = ?
           WHERE id_grupo = ? 
             AND id_profesor = ? 
             AND fecha BETWEEN ? AND CURDATE()
             AND estado = TRUE`,
          [id_profesor, p.id_grupo, p.id_profesor_suplente, p.fecha_inicio]
        );
        asistenciasReasignadas += reasignadas.affectedRows;
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
      asistencias_reasignadas: asistenciasReasignadas,
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

/**
 * Sincroniza los grupos activos de un profesor con la lista recibida:
 * agrega los que falten y desactiva (con fecha_fin) los que ya no vengan.
 * Es aditivo/no-destructivo hacia otros profesores: solo toca las filas
 * de grupo_profesor que pertenecen a este id_profesor.
 *
 * Nota de diseño: cada profesor ya tiene una única "materia" fija en su
 * ficha. Si quieres que un mismo grupo tenga Español, Matemáticas y
 * Ciencias cubiertas, asigna ese grupo a los 3 profesores correspondientes
 * (cada uno desde este mismo endpoint); grupo_profesor admite muchos
 * profesores por grupo.
 */
export const asignarGruposProfesorService = async (id_profesor, idsGrupos = []) => {
  const listaGrupos = Array.isArray(idsGrupos)
    ? [...new Set(idsGrupos.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [profRows] = await connection.query(
      `SELECT id_profesor, estado FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );
    if (profRows.length === 0) {
      throw new Error("El profesor no existe.");
    }
    if (profRows[0].estado == 0 || profRows[0].estado === false) {
      throw new Error("No se pueden asignar grupos a un profesor inactivo/destituido.");
    }

    if (listaGrupos.length > 0) {
      const placeholders = listaGrupos.map(() => '?').join(',');
      const [gruposValidos] = await connection.query(
        `SELECT id_grupo FROM grupo WHERE id_grupo IN (${placeholders}) AND estado = TRUE`,
        listaGrupos
      );
      if (gruposValidos.length !== listaGrupos.length) {
        throw new Error("Uno o más grupos seleccionados no existen o están inactivos.");
      }
    }

    const [actuales] = await connection.query(
      `SELECT id_grupo FROM grupo_profesor WHERE id_profesor = ? AND estado = TRUE`,
      [id_profesor]
    );
    const actualesIds = actuales.map((r) => r.id_grupo);

    const aQuitar = actualesIds.filter((id) => !listaGrupos.includes(id));
    const aAgregar = listaGrupos.filter((id) => !actualesIds.includes(id));

    if (aQuitar.length > 0) {
      const placeholders = aQuitar.map(() => '?').join(',');
      await connection.query(
        `UPDATE grupo_profesor 
         SET estado = FALSE, fecha_fin = CURDATE()
         WHERE id_profesor = ? AND estado = TRUE AND id_grupo IN (${placeholders})`,
        [id_profesor, ...aQuitar]
      );
    }

    for (const idGrupo of aAgregar) {
      await connection.query(
        `INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, estado)
         VALUES (?, ?, CURDATE(), TRUE)`,
        [idGrupo, id_profesor]
      );
    }

    await connection.commit();
    return {
      id_profesor,
      grupos_asignados: listaGrupos,
      agregados: aAgregar,
      removidos: aQuitar,
      mensaje: "Grupos del profesor actualizados correctamente."
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