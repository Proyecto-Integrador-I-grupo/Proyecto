import conexionPromise from "../config/database.js";
import bcrypt from "bcryptjs";
import { validarCorreoInstitucional } from "../utils/emailDomain.js";
import { normalizarDiasSemana, validarChoqueProfesor, asegurarTablaHorarioAcademico } from "./matriculaServiceP.js";
import { validarCargaDocente, validarPeriodoNoCerrado, horasSemanalesGrupo } from "./businessRulesService.js";


let profesorHorarioSchemaPromise = null;
async function asegurarHorarioGruposProfesor() {
  if (profesorHorarioSchemaPromise) return profesorHorarioSchemaPromise;
  profesorHorarioSchemaPromise = (async () => {
    const [inicio] = await conexionPromise.query("SHOW COLUMNS FROM grupo LIKE 'hora_inicio'");
    if (!inicio.length) await conexionPromise.query("ALTER TABLE grupo ADD COLUMN hora_inicio TIME NULL");
    const [fin] = await conexionPromise.query("SHOW COLUMNS FROM grupo LIKE 'hora_fin'");
    if (!fin.length) await conexionPromise.query("ALTER TABLE grupo ADD COLUMN hora_fin TIME NULL");
    const [dias] = await conexionPromise.query("SHOW COLUMNS FROM grupo LIKE 'dias_semana'");
    if (!dias.length) await conexionPromise.query("ALTER TABLE grupo ADD COLUMN dias_semana VARCHAR(80) NOT NULL DEFAULT ''");
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
  const texto = String(valor ?? "").replace(/\s+/g, " ").trim();
  if (!texto && !obligatorio) return null;
  if (!texto) throw new Error(`${etiqueta} es obligatorio.`);
  if (texto.length < 2 || texto.length > 60) throw new Error(`${etiqueta} debe contener entre 2 y 60 caracteres.`);
  if (!/^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u.test(texto)) {
    throw new Error(`${etiqueta} solo puede contener letras, espacios, apóstrofes y guiones.`);
  }
  return texto;
};

const validarFechaIngresoProfesor = (valor) => {
  const fecha = String(valor || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error("La fecha de ingreso no es válida.");
  }

  const hoyIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const anioActual = Number(hoyIso.slice(0, 4));
  const inicioAnio = `${anioActual}-01-01`;

  if (fecha < inicioAnio) {
    throw new Error(`La fecha de ingreso debe pertenecer al año ${anioActual}.`);
  }
  if (fecha > hoyIso) {
    throw new Error("La fecha de ingreso no puede ser futura.");
  }
  return fecha;
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

export async function procesarSuplenciasVencidas() {
  const connection = await conexionPromise.getConnection();
  try {
    await connection.beginTransaction();
    const [vencidas] = await connection.query(
      `SELECT ps.id_suplencia, ps.id_grupo, ps.id_profesor_titular, ps.id_profesor_suplente,
              g.nombre_grupo, g.dias_semana, g.hora_inicio, g.hora_fin, s.periodo_lectivo,
              pl.estado AS estado_periodo, pr.id_persona
       FROM profesor_suplencia ps
       INNER JOIN grupo g ON g.id_grupo = ps.id_grupo
       INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       INNER JOIN periodo_lectivo pl ON pl.anio = s.periodo_lectivo
       INNER JOIN profesor pr ON pr.id_profesor = ps.id_profesor_titular
       WHERE ps.estado = TRUE AND ps.fecha_fin IS NOT NULL AND ps.fecha_fin < CURDATE()
       ORDER BY ps.fecha_fin, ps.id_suplencia
       FOR UPDATE`
    );

    for (const item of vencidas) {
      try {
        if (item.id_profesor_suplente) {
          await connection.query(
            `UPDATE grupo_profesor SET estado = FALSE, fecha_fin = LEAST(COALESCE(fecha_fin, CURDATE()), CURDATE())
             WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE`,
            [item.id_grupo, item.id_profesor_suplente]
          );
        }
        if (String(item.estado_periodo).toUpperCase() === 'CERRADO') {
          await connection.query(`UPDATE profesor_suplencia SET estado = FALSE WHERE id_suplencia = ?`, [item.id_suplencia]);
          continue;
        }
        await validarPeriodoNoCerrado(connection, Number(item.periodo_lectivo));
        const dias = normalizarDiasSemana(item.dias_semana, item.nombre_grupo);
        await validarChoqueProfesor(connection, Number(item.id_profesor_titular), dias, item.hora_inicio, item.hora_fin, Number(item.id_grupo));
        await validarCargaDocente(connection, Number(item.id_profesor_titular), dias, item.hora_inicio, item.hora_fin, Number(item.id_grupo));
        const [[yaAsignado]] = await connection.query(
          `SELECT id_grupo_profesor FROM grupo_profesor
           WHERE id_grupo = ? AND id_profesor = ? AND estado = TRUE LIMIT 1`,
          [item.id_grupo, item.id_profesor_titular]
        );
        if (!yaAsignado) {
          await connection.query(
            `INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, fecha_fin, estado)
             VALUES (?, ?, CURDATE(), NULL, TRUE)`,
            [item.id_grupo, item.id_profesor_titular]
          );
        }
        await connection.query(`UPDATE profesor_suplencia SET estado = FALSE WHERE id_suplencia = ?`, [item.id_suplencia]);
      } catch (error) {
        console.warn(`Suplencia ${item.id_suplencia}: no se pudo restaurar automáticamente todavía:`, error.message);
      }
    }

    const [titulares] = await connection.query(
      `SELECT pr.id_profesor, pr.id_persona
       FROM profesor pr
       WHERE pr.estado = FALSE AND pr.inactivo_hasta IS NOT NULL AND pr.inactivo_hasta < CURDATE()
         AND COALESCE(pr.motivo_inactividad, '') <> 'Baja lógica administrativa'
         AND NOT EXISTS (SELECT 1 FROM profesor_suplencia ps WHERE ps.id_profesor_titular = pr.id_profesor AND ps.estado = TRUE)`
    );
    for (const titular of titulares) {
      await connection.query(
        `UPDATE profesor SET estado = TRUE, inactivo_desde = NULL, inactivo_hasta = NULL, motivo_inactividad = NULL WHERE id_profesor = ?`,
        [titular.id_profesor]
      );
      await connection.query(`UPDATE usuario SET estado = TRUE WHERE id_persona = ?`, [titular.id_persona]);
    }
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.warn('No se pudo procesar la restauración automática de suplencias:', error.message);
  } finally {
    connection.release();
  }
}

export const obtenerProfesoresService = async () => {
  await asegurarHorarioGruposProfesor();
  await procesarSuplenciasVencidas();
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
      pr.horas_maximas_semana,
      pr.inactivo_desde,
      pr.inactivo_hasta,
      pr.motivo_inactividad,
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
    WHERE NOT (pr.estado = FALSE AND COALESCE(pr.motivo_inactividad, '') = 'Baja lógica administrativa')
    GROUP BY pr.id_profesor
    ORDER BY pr.id_profesor ASC
  `;
  const [rows] = await conexionPromise.query(query);
  return rows;
};

/**
 * Registra un profesor insertando la persona y el profesor dentro de una transacción.
 */
export const crearProfesorService = async (datos, idUsuario = null) => {
  const { nombre, apellido1, apellido2, fecha_nacimiento, genero, materia, fecha_ingreso, correo, contrasena, horas_maximas_semana } = datos;

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
  const fechaIngresoValidada = validarFechaIngresoProfesor(fecha_ingreso);
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
    const horasMaximas = Number(horas_maximas_semana || 40);
    if (!Number.isFinite(horasMaximas) || horasMaximas <= 0 || horasMaximas > 60) throw new Error("La carga máxima semanal debe estar entre 1 y 60 horas.");
    const queryProfesor = `
      INSERT INTO profesor (id_persona, materia, fecha_ingreso, horas_maximas_semana, estado)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    const [resProfesor] = await connection.query(queryProfesor, [
      id_persona,
      materiaNormalizada,
      fechaIngresoValidada,
      horasMaximas
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
      fecha_ingreso: fechaIngresoValidada,
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
  const fechaIngreso = validarFechaIngresoProfesor(datos.fecha_ingreso);
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
      [materia, fechaIngreso, id]
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

export const destituirProfesorService = async (id_profesor, motivo = '', fechaInicio = null, fechaFin = null) => {
  const connection = await conexionPromise.getConnection();
  try {
    await connection.beginTransaction();
    const inicio = String(fechaInicio || new Date().toISOString().slice(0,10)).slice(0,10);
    const fin = String(fechaFin || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
      throw new Error('Debes indicar fecha de inicio y fecha de finalización de la incapacidad.');
    }
    if (fin < inicio) throw new Error('La fecha de finalización no puede ser anterior al inicio.');

    const [rows] = await connection.query(`SELECT id_profesor, id_persona, estado FROM profesor WHERE id_profesor = ?`, [id_profesor]);
    if (!rows.length) throw new Error('El profesor no existe.');
    if (!rows[0].estado) throw new Error('El profesor ya se encuentra inactivo.');
    const id_persona = rows[0].id_persona;

    const [gruposActivos] = await connection.query(
      `SELECT gp.id_grupo, s.periodo_lectivo FROM grupo_profesor gp
       INNER JOIN grupo g ON g.id_grupo = gp.id_grupo
       INNER JOIN seccion s ON s.id_seccion = g.id_seccion
       WHERE gp.id_profesor = ? AND gp.estado = TRUE AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE())`,
      [id_profesor]
    );
    for (const grupo of gruposActivos) await validarPeriodoNoCerrado(connection, Number(grupo.periodo_lectivo));

    await connection.query(
      `UPDATE profesor SET estado = FALSE, inactivo_desde = ?, inactivo_hasta = ?, motivo_inactividad = ? WHERE id_profesor = ?`,
      [inicio, fin, String(motivo || '').trim().slice(0,250) || null, id_profesor]
    );
    await connection.query(`UPDATE usuario SET estado = FALSE WHERE id_persona = ?`, [id_persona]);
    await connection.query(
      `UPDATE grupo_profesor SET fecha_fin = ?, estado = FALSE
       WHERE id_profesor = ? AND estado = TRUE`,
      [inicio, id_profesor]
    );
    for (const { id_grupo } of gruposActivos) {
      await connection.query(
        `INSERT INTO profesor_suplencia
         (id_grupo, id_profesor_titular, id_profesor_suplente, fecha_inicio, fecha_fin, estado, motivo)
         VALUES (?, ?, NULL, ?, ?, TRUE, ?)`,
        [id_grupo, id_profesor, inicio, fin, String(motivo || '').trim().slice(0,250) || null]
      );
    }
    await connection.commit();
    return { id_profesor, grupos_liberados: gruposActivos.length, fecha_inicio: inicio, fecha_fin: fin, acceso_bloqueado: true, mensaje: 'Profesor incapacitado temporalmente.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
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
      `UPDATE profesor SET estado = TRUE, inactivo_desde = NULL, inactivo_hasta = NULL, motivo_inactividad = NULL WHERE id_profesor = ?`,
      [id_profesor]
    );

    // NUEVO: restaurar el acceso a la plataforma al reintegrar al profesor.
    await connection.query(
      `UPDATE usuario SET estado = TRUE WHERE id_persona = ?`,
      [id_persona]
    );

    const [pendientes] = await connection.query(
      `SELECT ps.id_suplencia, ps.id_grupo, ps.id_profesor_suplente, ps.fecha_inicio,
              g.estado AS grupo_activo, g.nombre_grupo, g.dias_semana, g.hora_inicio, g.hora_fin
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

        // Las asistencias históricas permanecen asociadas al profesor que realmente
        // las registró. Cambiarlas al titular rompería la trazabilidad académica.
      }

      // Se restaura al titular solo si el horario sigue siendo compatible.
      const diasGrupo = normalizarDiasSemana(p.dias_semana, p.nombre_grupo);
      if (!diasGrupo.length || !p.hora_inicio || !p.hora_fin) {
        throw new Error(`No se puede restaurar ${p.nombre_grupo || 'el grupo'} porque no tiene días y horario completos.`);
      }
      await validarChoqueProfesor(connection, Number(id_profesor), diasGrupo, p.hora_inicio, p.hora_fin, Number(p.id_grupo));
      await validarCargaDocente(connection, Number(id_profesor), diasGrupo, p.hora_inicio, p.hora_fin, Number(p.id_grupo));
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
      asistencias_reasignadas: 0,
      historial_asistencia_preservado: true,
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
    const [[profesor]] = await connection.query(
      `SELECT pr.id_profesor, pr.id_persona, pr.estado FROM profesor pr WHERE pr.id_profesor = ? LIMIT 1 FOR UPDATE`,
      [id_profesor]
    );
    if (!profesor) throw new Error('El profesor no existe.');
    const [[historial]] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM asistencia WHERE id_profesor = ?) AS asistencias,
        (SELECT COUNT(*) FROM grupo_profesor WHERE id_profesor = ?) AS asignaciones`,
      [id_profesor, id_profesor]
    );
    await connection.query(
      `UPDATE profesor
       SET estado = FALSE,
           motivo_inactividad = 'Baja lógica administrativa',
           inactivo_desde = NULL,
           inactivo_hasta = NULL
       WHERE id_profesor = ?`,
      [id_profesor]
    );
    await connection.query(`UPDATE usuario SET estado = FALSE WHERE id_persona = ?`, [profesor.id_persona]);
    await connection.query(
      `UPDATE grupo_profesor SET estado = FALSE, fecha_fin = COALESCE(fecha_fin, CURDATE()) WHERE id_profesor = ? AND estado = TRUE`,
      [id_profesor]
    );
    await connection.commit();
    return {
      id_profesor: Number(id_profesor),
      baja_logica: true,
      historial_preservado: true,
      asistencias_historicas: Number(historial?.asistencias || 0),
      asignaciones_historicas: Number(historial?.asignaciones || 0),
      mensaje: 'Profesor desactivado. El historial académico se conserva.'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
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

    const [[grupoDestino]] = await connection.query(
      `SELECT id_grupo, nombre_grupo, dias_semana, hora_inicio, hora_fin, estado
       FROM grupo WHERE id_grupo = ? LIMIT 1 FOR UPDATE`,
      [id_grupo]
    );
    if (!grupoDestino || !grupoDestino.estado) throw new Error('El grupo no existe o está inactivo.');
    const diasDestino = normalizarDiasSemana(grupoDestino.dias_semana, grupoDestino.nombre_grupo);
    if (!diasDestino.length || !grupoDestino.hora_inicio || !grupoDestino.hora_fin) {
      throw new Error('El grupo debe tener días y horario definidos antes de asignar un profesor o sustituto.');
    }
    // Para sustituciones validamos la disponibilidad real de la materia cuando existe horario académico.
    // Si aún no hay bloques, se usa la jornada general del grupo como respaldo.
    const [bloquesMateria] = await connection.query(`SELECT dia_semana, hora_inicio, hora_fin FROM grupo_horario_academico WHERE id_grupo = ? AND estado = TRUE AND LOWER(TRIM(materia)) = LOWER(TRIM(?))`, [id_grupo, nuevoProf[0].materia]);
    if (bloquesMateria.length) {
      for (const b of bloquesMateria) {
        await validarChoqueProfesor(connection, Number(id_nuevo_profesor), [b.dia_semana], b.hora_inicio, b.hora_fin, Number(id_grupo));
      }
    } else {
      await validarChoqueProfesor(connection, Number(id_nuevo_profesor), diasDestino, grupoDestino.hora_inicio, grupoDestino.hora_fin, Number(id_grupo));
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

    let provisional = false;
    let fechaAsignacionInicio = new Date().toISOString().slice(0,10);
    let fechaAsignacionFin = null;
    if (id_profesor_anterior) {
      const [suplenciaPendiente] = await connection.query(
        `SELECT id_suplencia, fecha_inicio, fecha_fin FROM profesor_suplencia 
         WHERE id_grupo = ? AND id_profesor_titular = ? AND estado = TRUE
         LIMIT 1`,
        [id_grupo, id_profesor_anterior]
      );
      if (suplenciaPendiente.length > 0) {
        await connection.query(
          `UPDATE profesor_suplencia SET id_profesor_suplente = ? WHERE id_suplencia = ?`,
          [id_nuevo_profesor, suplenciaPendiente[0].id_suplencia]
        );
        provisional = true;
        fechaAsignacionInicio = String(suplenciaPendiente[0].fecha_inicio).slice(0,10);
        fechaAsignacionFin = String(suplenciaPendiente[0].fecha_fin).slice(0,10);
      }
    }

    await connection.query(
      `INSERT INTO grupo_profesor (id_grupo, id_profesor, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, TRUE)`,
      [id_grupo, id_nuevo_profesor, fechaAsignacionInicio, fechaAsignacionFin]
    );

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

async function validarAsignacionMateriaGrupo(connection, idProfesor, materia, grupo) {
  await asegurarTablaHorarioAcademico();
  const [slots] = await connection.query(
    `SELECT dia_semana, TIME_FORMAT(hora_inicio,'%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin,'%H:%i') AS hora_fin
     FROM grupo_horario_academico
     WHERE id_grupo = ? AND estado = TRUE AND LOWER(TRIM(materia)) = LOWER(TRIM(?))
     ORDER BY FIELD(dia_semana,'lunes','martes','miercoles','jueves','viernes'), hora_inicio`,
    [grupo.id_grupo, materia]
  );
  // El profesor puede quedar asignado al grupo antes de construir el horario.
  // Si todavía no existen bloques de su materia, la asignación se conserva
  // y comenzará a aparecer en Horarios cuando esa materia sea programada.
  const [ocupada] = await connection.query(
    `SELECT gp.id_profesor, CONCAT_WS(' ',p.nombre,p.apellido1) AS profesor_nombre
     FROM grupo_profesor gp
     INNER JOIN profesor pr ON pr.id_profesor=gp.id_profesor
     INNER JOIN persona p ON p.id_persona=pr.id_persona
     WHERE gp.id_grupo=? AND gp.estado=TRUE AND (gp.fecha_fin IS NULL OR gp.fecha_fin>=CURDATE())
       AND LOWER(TRIM(pr.materia))=LOWER(TRIM(?)) AND gp.id_profesor<>?
     LIMIT 1`,
    [grupo.id_grupo, materia, idProfesor]
  );
  if (ocupada.length) throw new Error(`${materia} en ${grupo.nombre_grupo} ya está cubierta por ${ocupada[0].profesor_nombre}.`);

  const [existentes] = await connection.query(
    `SELECT g.id_grupo,g.nombre_grupo,gha.dia_semana,
            TIME_FORMAT(gha.hora_inicio,'%H:%i') AS hora_inicio,
            TIME_FORMAT(gha.hora_fin,'%H:%i') AS hora_fin
     FROM grupo_profesor gp
     INNER JOIN grupo g ON g.id_grupo=gp.id_grupo AND g.estado=TRUE
     INNER JOIN seccion s ON s.id_seccion=g.id_seccion
     INNER JOIN grupo_horario_academico gha ON gha.id_grupo=g.id_grupo AND gha.estado=TRUE
     WHERE gp.id_profesor=? AND gp.estado=TRUE AND (gp.fecha_fin IS NULL OR gp.fecha_fin>=CURDATE())
       AND g.id_grupo<>? AND s.periodo_lectivo=? AND LOWER(TRIM(gha.materia))=LOWER(TRIM(?))`,
    [idProfesor, grupo.id_grupo, grupo.periodo_lectivo, materia]
  );
  for (const slot of slots) {
    const choque = existentes.find((e) => e.dia_semana === slot.dia_semana && String(slot.hora_inicio) < String(e.hora_fin) && String(slot.hora_fin) > String(e.hora_inicio));
    if (choque) throw new Error(`El profesor ya tiene ${materia} en ${choque.nombre_grupo} el ${slot.dia_semana} de ${choque.hora_inicio} a ${choque.hora_fin}.`);
  }
  const horas = slots.reduce((sum, slot) => {
    const mins = (v) => { const [h,m]=String(v).split(':').map(Number); return h*60+m; };
    return sum + Math.max(0, mins(slot.hora_fin)-mins(slot.hora_inicio))/60;
  },0);
  return { slots, horas };
}

export const asignarGruposProfesorService = async (id_profesor, idsGrupos = []) => {
  const listaGrupos = Array.isArray(idsGrupos)
    ? [...new Set(idsGrupos.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const [profRows] = await connection.query(
      `SELECT id_profesor, estado, materia FROM profesor WHERE id_profesor = ?`,
      [id_profesor]
    );
    if (profRows.length === 0) {
      throw new Error("El profesor no existe.");
    }
    if (profRows[0].estado == 0 || profRows[0].estado === false) {
      throw new Error("No se pueden asignar grupos a un profesor inactivo/destituido.");
    }

    if (listaGrupos.length > 0) {
      await asegurarTablaHorarioAcademico();
      const placeholders = listaGrupos.map(() => '?').join(',');
      const [gruposValidos] = await connection.query(
        `SELECT g.id_grupo, g.nombre_grupo, g.dias_semana, g.hora_inicio, g.hora_fin, s.periodo_lectivo
         FROM grupo g INNER JOIN seccion s ON s.id_seccion=g.id_seccion
         WHERE g.id_grupo IN (${placeholders}) AND g.estado = TRUE`,
        listaGrupos
      );
      if (gruposValidos.length !== listaGrupos.length) throw new Error("Uno o más grupos seleccionados no existen o están inactivos.");
      const materiaProfesor = String(profRows[0].materia || '').trim();
      let cargaPropuesta = 0;
      for (const grupo of gruposValidos) {
        const validacion = await validarAsignacionMateriaGrupo(connection, Number(id_profesor), materiaProfesor, grupo);
        cargaPropuesta += validacion.horas;
      }
      const [[limiteCarga]] = await connection.query(`SELECT horas_maximas_semana FROM profesor WHERE id_profesor = ? LIMIT 1`, [id_profesor]);
      const maximo = Number(limiteCarga?.horas_maximas_semana || 40);
      if (cargaPropuesta > maximo + 0.001) {
        throw new Error(`La asignación propuesta suma ${cargaPropuesta.toFixed(1)} horas semanales y supera el máximo permitido de ${maximo.toFixed(1)} horas.`);
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
      ps.fecha_fin,
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
/**
 * Devuelve la agenda académica usando la asignación real grupo-profesor.
 * No duplica información de horario: los días, horas y aula viven en `grupo`.
 */
export const obtenerHorariosService = async ({ idProfesor = null } = {}) => {
  await asegurarHorarioGruposProfesor();
  await asegurarTablaHorarioAcademico();
  await procesarSuplenciasVencidas();

  const params = [];
  let filtroProfesor = '';
  if (idProfesor) {
    filtroProfesor = 'AND pr.id_profesor = ?';
    params.push(Number(idProfesor));
  }

  const [horarios] = await conexionPromise.query(
    `SELECT
       gp.id_grupo_profesor,
       gp.fecha_inicio AS asignacion_desde,
       gp.fecha_fin AS asignacion_hasta,
       pr.id_profesor,
       CONCAT_WS(' ', p.nombre, p.apellido1, NULLIF(p.apellido2, '')) AS profesor_nombre,
       pr.materia,
       pr.estado AS profesor_activo,
       g.id_grupo,
       g.nombre_grupo,
       g.aula,
       gha.dia_semana AS dias_semana,
       TIME_FORMAT(gha.hora_inicio, '%H:%i') AS hora_inicio,
       TIME_FORMAT(gha.hora_fin, '%H:%i') AS hora_fin,
       s.id_seccion,
       s.nombre_seccion,
       s.nivel,
       s.periodo_lectivo,
       pl.estado AS estado_periodo,
       CASE WHEN EXISTS (
         SELECT 1
         FROM profesor_suplencia ps
         WHERE ps.id_grupo = g.id_grupo
           AND ps.id_profesor_suplente = pr.id_profesor
           AND ps.estado = TRUE
           AND CURDATE() BETWEEN ps.fecha_inicio AND ps.fecha_fin
       ) THEN TRUE ELSE FALSE END AS es_suplencia
     FROM grupo_profesor gp
     INNER JOIN profesor pr ON pr.id_profesor = gp.id_profesor
     INNER JOIN persona p ON p.id_persona = pr.id_persona AND p.estado = TRUE
     INNER JOIN grupo g ON g.id_grupo = gp.id_grupo AND g.estado = TRUE
     INNER JOIN grupo_horario_academico gha
       ON gha.id_grupo = g.id_grupo
      AND gha.estado = TRUE
      AND LOWER(TRIM(gha.materia)) = LOWER(TRIM(pr.materia))
     INNER JOIN seccion s ON s.id_seccion = g.id_seccion AND s.estado = TRUE
     INNER JOIN periodo_lectivo pl ON pl.anio = s.periodo_lectivo
     WHERE gp.estado = TRUE
       AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE())
       ${filtroProfesor}
     ORDER BY s.periodo_lectivo DESC, p.apellido1, p.nombre, g.hora_inicio, g.nombre_grupo`,
    params
  );

  const profesoresParams = [];
  let profesoresFiltro = '';
  if (idProfesor) {
    profesoresFiltro = 'AND pr.id_profesor = ?';
    profesoresParams.push(Number(idProfesor));
  }
  const [profesores] = await conexionPromise.query(
    `SELECT pr.id_profesor,
            CONCAT_WS(' ', p.nombre, p.apellido1, NULLIF(p.apellido2, '')) AS nombre,
            pr.materia,
            pr.estado
     FROM profesor pr
     INNER JOIN persona p ON p.id_persona = pr.id_persona AND p.estado = TRUE
     WHERE 1=1 ${profesoresFiltro}
     ORDER BY p.apellido1, p.nombre`,
    profesoresParams
  );

  const gruposParams = [];
  let gruposJoinProfesor = '';
  let gruposFiltroProfesor = '';
  if (idProfesor) {
    gruposJoinProfesor = 'INNER JOIN grupo_profesor gp2 ON gp2.id_grupo = g.id_grupo AND gp2.estado = TRUE AND (gp2.fecha_fin IS NULL OR gp2.fecha_fin >= CURDATE())';
    gruposFiltroProfesor = 'AND gp2.id_profesor = ?';
    gruposParams.push(Number(idProfesor));
  }
  const [grupos] = await conexionPromise.query(
    `SELECT DISTINCT g.id_grupo, g.nombre_grupo, g.aula,
            g.dias_semana,
            TIME_FORMAT(g.hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(g.hora_fin, '%H:%i') AS hora_fin,
            s.nombre_seccion, s.nivel, s.periodo_lectivo
     FROM grupo g
     INNER JOIN seccion s ON s.id_seccion = g.id_seccion AND s.estado = TRUE
     ${gruposJoinProfesor}
     WHERE g.estado = TRUE ${gruposFiltroProfesor}
     ORDER BY s.periodo_lectivo DESC, g.nombre_grupo, s.nombre_seccion`,
    gruposParams
  );

  const [periodos] = await conexionPromise.query(
    `SELECT anio, estado, fecha_inicio, fecha_fin
     FROM periodo_lectivo
     ORDER BY anio DESC`
  );

  return { horarios, profesores, grupos, periodos };
};
