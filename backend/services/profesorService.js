import conexionPromise from "../config/database.js";
import bcrypt from "bcryptjs";
import { validarCorreoInstitucional } from "../utils/emailDomain.js";


let profesorHorarioSchemaPromise = null;
async function asegurarHorarioGruposProfesor() {
  if (profesorHorarioSchemaPromise) return profesorHorarioSchemaPromise;
  profesorHorarioSchemaPromise = (async () => {
    const [inicio] = await conexionPromise.query("SHOW COLUMNS FROM grupo LIKE 'hora_inicio'");
    if (!inicio.length) await conexionPromise.query("ALTER TABLE grupo ADD COLUMN hora_inicio TIME NULL");
    const [fin] = await conexionPromise.query("SHOW COLUMNS FROM grupo LIKE 'hora_fin'");
    if (!fin.length) await conexionPromise.query("ALTER TABLE grupo ADD COLUMN hora_fin TIME NULL");
  })().catch((error) => { profesorHorarioSchemaPromise = null; throw error; });
  return profesorHorarioSchemaPromise;
}

const MATERIAS_BASICAS = new Map([
  ["español", "Español"],
  ["espanol", "Español"],
  ["matemática", "Matemáticas"],
  ["matematica", "Matemáticas"],
  ["matemáticas", "Matemáticas"],
  ["matematicas", "Matemáticas"],
  ["ciencias", "Ciencias"],
  ["ciencias naturales", "Ciencias"],
  ["estudios sociales", "Estudios Sociales"],
  ["inglés", "Inglés"],
  ["ingles", "Inglés"],
  ["educación física", "Educación Física"],
  ["educacion fisica", "Educación Física"],
  ["informática", "Informática"],
  ["informatica", "Informática"],
  ["artes", "Artes"]
]);

const normalizarMateriaProfesor = (materia) => {
  const clave = String(materia ?? "").trim().toLowerCase();
  const normalizada = MATERIAS_BASICAS.get(clave);
  if (!normalizada) {
    throw new Error("La materia seleccionada no es válida. Selecciona una de las 8 materias básicas disponibles.");
  }
  return normalizada;
};


const validarNombreHumano = (valor, etiqueta, obligatorio = true) => {
  const texto = String(valor ?? "").trim();
  if (!texto && !obligatorio) return null;
  if (!texto) throw new Error(`${etiqueta} es obligatorio.`);
  if (texto.length < 2 || texto.length > 60) throw new Error(`${etiqueta} debe contener entre 2 y 60 caracteres.`);
  if (!/^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u.test(texto)) {
    throw new Error(`${etiqueta} solo puede contener letras, espacios, apóstrofes y guiones.`);
  }
  return texto;
};

const validarMayorEdad = (fechaNacimiento) => {
  const fecha = new Date(`${String(fechaNacimiento || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) throw new Error("La fecha de nacimiento no es válida.");
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  if (edad < 18) throw new Error("El profesor debe ser mayor de 18 años.");
  if (edad > 100) throw new Error("La fecha de nacimiento no es válida para un profesor activo.");
};

const normalizarGeneroProfesor = (genero) => {
  const valor = String(genero ?? "").trim().toLowerCase();
  const mapa = {
    m: "M",
    masculino: "M",
    f: "F",
    femenino: "F",
    o: "O",
    otro: "O",
    otra: "O"
  };
  const normalizado = mapa[valor];
  if (!normalizado) {
    throw new Error("El género debe ser Masculino, Femenino u Otro.");
  }
  return normalizado;
};
export const obtenerProfesoresService = async () => {
  await asegurarHorarioGruposProfesor();
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
      (SELECT u.correo FROM usuario u WHERE u.id_persona = pr.id_persona AND u.estado = TRUE LIMIT 1) AS correo,
      GROUP_CONCAT(
        DISTINCT CONCAT(
          g.nombre_grupo,
          CASE
            WHEN s.nombre_seccion IS NOT NULL AND s.nombre_seccion <> ''
              THEN CONCAT(' · ', s.nombre_seccion)
            ELSE ''
          END,
          CASE
            WHEN g.hora_inicio IS NOT NULL AND g.hora_fin IS NOT NULL
              THEN CONCAT(' · ', TIME_FORMAT(g.hora_inicio, '%H:%i'), ' - ', TIME_FORMAT(g.hora_fin, '%H:%i'))
            ELSE ''
          END
        )
        ORDER BY g.nombre_grupo SEPARATOR ', '
      ) AS grupos_asignados,
      GROUP_CONCAT(DISTINCT g.id_grupo ORDER BY g.nombre_grupo SEPARATOR ',') AS grupos_ids,
      (
        SELECT COUNT(*) FROM profesor_suplencia ps 
        WHERE ps.id_profesor_titular = pr.id_profesor AND ps.estado = TRUE
      ) AS grupos_pendientes
    FROM profesor pr
    INNER JOIN persona p ON pr.id_persona = p.id_persona
    LEFT JOIN grupo_profesor gp ON gp.id_profesor = pr.id_profesor AND gp.estado = TRUE AND gp.fecha_fin IS NULL
    LEFT JOIN grupo g ON g.id_grupo = gp.id_grupo
    LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
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

  if (contrasena.length < 6 || contrasena.length > 128) {
    throw new Error("La contraseña de acceso debe tener entre 6 y 128 caracteres.");
  }

  const generoNormalizado = normalizarGeneroProfesor(genero);
  const materiaNormalizada = normalizarMateriaProfesor(materia);
  const nombreLimpio = validarNombreHumano(nombre, "El nombre");
  const apellido1Limpio = validarNombreHumano(apellido1, "El primer apellido");
  const apellido2Limpio = validarNombreHumano(apellido2, "El segundo apellido", false);
  validarMayorEdad(fecha_nacimiento);
  const correoLimpio = validarCorreoInstitucional(correo);

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
      generoNormalizado
    ]);

    const id_persona = resPersona.insertId;

    // 2. Insertar profesor enlazado
    const queryProfesor = `
      INSERT INTO profesor (id_persona, materia, fecha_ingreso, estado)
      VALUES (?, ?, ?, TRUE)
    `;
    const [resProfesor] = await connection.query(queryProfesor, [
      id_persona,
      materiaNormalizada,
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
      materia: materiaNormalizada,
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

export const actualizarProfesorService = async (idProfesor, datos) => {
  const id = Number(idProfesor);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Profesor no válido.");

  const nombre = validarNombreHumano(datos.nombre, "El nombre");
  const apellido1 = validarNombreHumano(datos.apellido1, "El primer apellido");
  const apellido2 = validarNombreHumano(datos.apellido2, "El segundo apellido", false);
  const materia = normalizarMateriaProfesor(datos.materia);
  const genero = normalizarGeneroProfesor(datos.genero);
  const fechaNacimiento = String(datos.fecha_nacimiento || "").slice(0, 10);
  const fechaIngreso = String(datos.fecha_ingreso || "").slice(0, 10);
  const correo = validarCorreoInstitucional(datos.correo);
  validarMayorEdad(fechaNacimiento);

  const connection = await conexionPromise.getConnection();
  try {
    await connection.beginTransaction();
    const [[profesor]] = await connection.query(
      `SELECT pr.id_profesor, pr.id_persona FROM profesor pr WHERE pr.id_profesor = ? LIMIT 1`,
      [id]
    );
    if (!profesor) throw new Error("El profesor no existe.");

    const [correoDuplicado] = await connection.query(
      `SELECT id_usuario FROM usuario WHERE correo = ? AND id_persona <> ? LIMIT 1`,
      [correo, profesor.id_persona]
    );
    if (correoDuplicado.length) throw new Error("Ese correo ya pertenece a otro usuario.");

    await connection.query(
      `UPDATE persona SET nombre = ?, apellido1 = ?, apellido2 = ?, fecha_nacimiento = ?, genero = ? WHERE id_persona = ?`,
      [nombre, apellido1, apellido2, fechaNacimiento, genero, profesor.id_persona]
    );
    await connection.query(
      `UPDATE profesor SET materia = ?, fecha_ingreso = ? WHERE id_profesor = ?`,
      [materia, fechaIngreso || new Date().toISOString().slice(0, 10), id]
    );
    await connection.query(`UPDATE usuario SET correo = ? WHERE id_persona = ?`, [correo, profesor.id_persona]);

    await connection.commit();
    return { id_profesor: id, nombre, apellido1, apellido2, materia, fecha_nacimiento: fechaNacimiento, fecha_ingreso: fechaIngreso, genero, correo };
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    connection.release();
  }
};

export const destituirProfesorService = async (id_profesor, motivo = '') => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id_profesor, id_persona, estado FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    if (rows[0].estado == 0 || rows[0].estado === false) {
      throw new Error("El profesor ya se encuentra inactivo.");
    }

    const id_persona = rows[0].id_persona;

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

    // NUEVO: bloquear el acceso a la plataforma mientras esté destituido/incapacitado.
    // authController.login ya rechaza usuario.estado = FALSE, así que esto es suficiente
    // para cerrarle el paso sin tocar nada del login.
    await connection.query(
      `UPDATE usuario SET estado = FALSE WHERE id_persona = ?`,
      [id_persona]
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
      acceso_bloqueado: true,
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
      `SELECT id_profesor, id_persona, estado FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    if (rows[0].estado == 1 || rows[0].estado === true) {
      throw new Error("El profesor ya se encuentra activo.");
    }

    const id_persona = rows[0].id_persona;

    await connection.query(
      `UPDATE profesor SET estado = TRUE WHERE id_profesor = ?`,
      [id_profesor]
    );

    // NUEVO: restaurar el acceso a la plataforma al reintegrar al profesor.
    await connection.query(
      `UPDATE usuario SET estado = TRUE WHERE id_persona = ?`,
      [id_persona]
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
      acceso_restaurado: true,
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
      `SELECT pr.id_profesor, pr.id_persona, p.nombre, p.apellido1, p.apellido2
       FROM profesor pr
       INNER JOIN persona p ON p.id_persona = pr.id_persona
       WHERE pr.id_profesor = ?
       LIMIT 1`,
      [id_profesor]
    );

    if (rows.length === 0) {
      throw new Error("El profesor no existe.");
    }

    const profesor = rows[0];
    const idPersona = profesor.id_persona;

    const [usuarios] = await connection.query(
      `SELECT id_usuario FROM usuario WHERE id_persona = ?`,
      [idPersona]
    );
    const idsUsuario = usuarios.map((u) => Number(u.id_usuario)).filter(Number.isInteger);

    await connection.query(`SET @DISABLE_TRIGGERS = 1`);

    // El borrado solicitado es permanente. Primero se eliminan las referencias
    // que impiden borrar la fila principal del profesor.
    await connection.query(
      `DELETE FROM profesor_suplencia
       WHERE id_profesor_titular = ? OR id_profesor_suplente = ?`,
      [id_profesor, id_profesor]
    );

    await connection.query(
      `DELETE FROM grupo_profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    await connection.query(
      `DELETE FROM asistencia WHERE id_profesor = ?`,
      [id_profesor]
    );

    // Compatibilidad con instalaciones anteriores que todavía conservan
    // id_profesor directamente en grupo o la tabla suplencia antigua.
    const [grupoProfesorColumn] = await connection.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'grupo'
         AND COLUMN_NAME = 'id_profesor'
       LIMIT 1`
    );
    if (grupoProfesorColumn.length) {
      await connection.query(
        `UPDATE grupo SET id_profesor = NULL WHERE id_profesor = ?`,
        [id_profesor]
      );
    }

    const [suplenciaTable] = await connection.query(
      `SELECT 1
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'suplencia'
       LIMIT 1`
    );
    if (suplenciaTable.length) {
      const [suplenciaCols] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'suplencia'
           AND COLUMN_NAME IN ('id_profesor', 'id_profesor_titular', 'id_profesor_suplente')`
      );
      const columnas = new Set(suplenciaCols.map((c) => c.COLUMN_NAME));
      const condiciones = [];
      const valores = [];
      ['id_profesor', 'id_profesor_titular', 'id_profesor_suplente'].forEach((columna) => {
        if (columnas.has(columna)) {
          condiciones.push(`${columna} = ?`);
          valores.push(id_profesor);
        }
      });
      if (condiciones.length) {
        await connection.query(
          `DELETE FROM suplencia WHERE ${condiciones.join(' OR ')}`,
          valores
        );
      }
    }

    // Conservamos la auditoría cuando la FK permite NULL. Si una instalación
    // antigua no lo permite, se eliminan únicamente las auditorías del usuario
    // que está siendo borrado para que la operación pueda completarse.
    for (const idUsuarioProfesor of idsUsuario) {
      try {
        await connection.query(
          `UPDATE auditoria SET id_usuario = NULL WHERE id_usuario = ?`,
          [idUsuarioProfesor]
        );
      } catch (auditError) {
        await connection.query(
          `DELETE FROM auditoria WHERE id_usuario = ?`,
          [idUsuarioProfesor]
        );
      }
    }

    await connection.query(
      `DELETE FROM usuario WHERE id_persona = ?`,
      [idPersona]
    );

    await connection.query(
      `DELETE FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );

    const [estudianteRelacionado] = await connection.query(
      `SELECT id_estudiante FROM estudiante WHERE id_persona = ? LIMIT 1`,
      [idPersona]
    );
    const [usuarioRelacionado] = await connection.query(
      `SELECT id_usuario FROM usuario WHERE id_persona = ? LIMIT 1`,
      [idPersona]
    );

    if (estudianteRelacionado.length === 0 && usuarioRelacionado.length === 0) {
      await connection.query(
        `DELETE FROM persona WHERE id_persona = ?`,
        [idPersona]
      );
    }

    await connection.query(`SET @DISABLE_TRIGGERS = NULL`);
    await connection.commit();

    return {
      id_profesor: Number(id_profesor),
      id_persona: idPersona,
      nombre: `${profesor.nombre ?? ""} ${profesor.apellido1 ?? ""} ${profesor.apellido2 ?? ""}`.trim(),
      eliminacion_permanente: true,
      mensaje: "Profesor y datos asociados eliminados permanentemente"
    };
  } catch (error) {
    await connection.rollback();
    try { await connection.query(`SET @DISABLE_TRIGGERS = NULL`); } catch (e) {}
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
      `SELECT id_profesor, estado, materia FROM profesor WHERE id_profesor = ?`,
      [id_nuevo_profesor]
    );
    if (nuevoProf.length === 0) {
      throw new Error("El profesor a asignar no existe.");
    }
    if (nuevoProf[0].estado == 0 || nuevoProf[0].estado === false) {
      throw new Error("No se puede asignar un profesor inactivo al grupo.");
    }

    if (id_profesor_anterior) {
      const [titularRows] = await connection.query(
        `SELECT id_profesor, materia FROM profesor WHERE id_profesor = ? LIMIT 1`,
        [id_profesor_anterior]
      );
      if (!titularRows.length) {
        throw new Error("No se encontró el profesor titular.");
      }

      const materiaTitular = String(titularRows[0].materia || "").trim().toLowerCase();
      const materiaSustituto = String(nuevoProf[0].materia || "").trim().toLowerCase();
      if (!materiaTitular || !materiaSustituto || materiaTitular !== materiaSustituto) {
        throw new Error(
          `El sustituto debe impartir la misma materia del profesor titular (${titularRows[0].materia || "sin materia definida"}).`
        );
      }
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
      s.nombre_seccion,
      ps.id_profesor_titular,
      CONCAT(pt.nombre, ' ', pt.apellido1) AS titular_nombre,
      prt.materia AS titular_materia,
      ps.id_profesor_suplente,
      CASE WHEN ps.id_profesor_suplente IS NOT NULL 
           THEN CONCAT(psup.nombre, ' ', psup.apellido1) ELSE NULL END AS suplente_nombre,
      ps.fecha_inicio,
      ps.motivo
    FROM profesor_suplencia ps
    INNER JOIN grupo g ON g.id_grupo = ps.id_grupo
    LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
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