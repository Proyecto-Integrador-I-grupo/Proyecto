import conexionPromise from "../config/database.js";
import { validarPeriodoNoCerrado } from "./businessRulesService.js";

export const crearSeccionService = async (datos) => {
  const nombre = String(datos?.nombre || '').trim().toUpperCase();
  const nivel = String(datos?.nivel || '').trim();
  const anioLectivo = Number(datos?.anio_lectivo);
  const descripcionTexto = String(datos?.descripcion ?? '').trim().slice(0, 250);
  const descripcion = descripcionTexto || null;

  if (!/^[1-6]-[A-F]$/.test(nombre) || !/^[1-6]$/.test(nivel) || !Number.isInteger(anioLectivo) || anioLectivo < 2000 || anioLectivo > 2100) {
    const error = new Error('La sección debe usar el formato grado-letra, por ejemplo 1-A.');
    error.statusCode = 400;
    throw error;
  }

  if (!nombre.startsWith(`${nivel}-`)) {
    const error = new Error('El grado no coincide con el nombre de la sección.');
    error.statusCode = 400;
    throw error;
  }

  const connection = await conexionPromise.getConnection();
  try {
    await connection.beginTransaction();

    const [[periodoExiste]] = await connection.query(`SELECT anio FROM periodo_lectivo WHERE anio = ? LIMIT 1`, [anioLectivo]);
    if (!periodoExiste) {
      const estadoInicial = anioLectivo === new Date().getFullYear() ? 'ACTIVO' : 'PLANIFICADO';
      await connection.query(
        `INSERT INTO periodo_lectivo (anio, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?)`,
        [anioLectivo, `${anioLectivo}-02-01`, `${anioLectivo}-12-18`, estadoInicial]
      );
    }
    await validarPeriodoNoCerrado(connection, anioLectivo);

    const [coincidencias] = await connection.query(
      `SELECT id_seccion, estado FROM seccion
       WHERE UPPER(TRIM(nombre_seccion)) = ? AND periodo_lectivo = ?
       ORDER BY estado DESC, id_seccion DESC
       LIMIT 1 FOR UPDATE`,
      [nombre, anioLectivo]
    );

    if (coincidencias.length && Number(coincidencias[0].estado) === 1) {
      const error = new Error(`La sección ${nombre} (${anioLectivo}) ya existe.`);
      error.statusCode = 409;
      throw error;
    }

    // Si la sección existía pero había sido eliminada lógicamente, se reactiva
    // en vez de intentar insertar otra fila que pueda chocar con una restricción
    // UNIQUE de instalaciones anteriores. La descripción sigue siendo opcional.
    let idSeccion;
    if (coincidencias.length) {
      idSeccion = Number(coincidencias[0].id_seccion);
      await connection.query(
        `UPDATE seccion
         SET nivel = ?, descripcion = ?, estado = TRUE
         WHERE id_seccion = ?`,
        [nivel, descripcion, idSeccion]
      );
    } else {
      const [resultado] = await connection.query(
        `INSERT INTO seccion (nombre_seccion, nivel, periodo_lectivo, descripcion, estado)
         VALUES (?, ?, ?, ?, TRUE)`,
        [nombre, nivel, anioLectivo, descripcion]
      );
      idSeccion = resultado.insertId;
    }

    await connection.commit();
    return {
      id_seccion: idSeccion,
      nombre,
      nivel,
      anio_lectivo: anioLectivo,
      descripcion,
      estado: 1
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const obtenerSeccionesService = async () => {
  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(`
      SELECT id_seccion, nombre_seccion AS nombre, nivel, periodo_lectivo AS anio_lectivo, descripcion, estado
      FROM seccion
      WHERE estado = TRUE
      ORDER BY id_seccion ASC
    `);

    const anioActual = new Date().getFullYear();
    const [[periodoActual]] = await connection.query(`SELECT anio FROM periodo_lectivo WHERE anio = ? LIMIT 1`, [anioActual]);
    if (!periodoActual) {
      await connection.query(
        `INSERT INTO periodo_lectivo (anio, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, 'ACTIVO')`,
        [anioActual, `${anioActual}-02-01`, `${anioActual}-12-18`]
      );
    }

    const baseSeed = [];
    for (let nivel = 1; nivel <= 6; nivel += 1) {
      baseSeed.push({ nombre: `${nivel}-A`, nivel, anio_lectivo: anioActual, descripcion: `Sección base institucional ${nivel}-A` });
      baseSeed.push({ nombre: `${nivel}-B`, nivel, anio_lectivo: anioActual, descripcion: `Sección base institucional ${nivel}-B` });
    }

    const existingNames = new Set((existingRows || []).map((row) => `${String(row.nombre || '').trim().toLowerCase()}|${Number(row.anio_lectivo)}`));
    const baseToInsert = baseSeed.filter((item) => !existingNames.has(`${item.nombre.toLowerCase()}|${Number(item.anio_lectivo)}`));

    for (const item of baseToInsert) {
      await connection.query(
        `INSERT INTO seccion (nombre_seccion, nivel, periodo_lectivo, descripcion, estado)
         VALUES (?, ?, ?, ?, TRUE)`,
        [item.nombre, item.nivel, item.anio_lectivo, item.descripcion]
      );
    }

    await connection.commit();

    const [rows] = await connection.query(`
      SELECT id_seccion, nombre_seccion AS nombre, nivel, periodo_lectivo AS anio_lectivo, descripcion, estado
      FROM seccion
      WHERE estado = TRUE
      ORDER BY id_seccion ASC
    `);

    return rows;
  } catch (error) {
    await connection.rollback();
    throw new Error(error.message || "Error al consultar las secciones.");
  } finally {
    connection.release();
  }
};

export const eliminarSeccionService = async (idSeccion) => {
  const connection = await conexionPromise.getConnection();
  try {
    await connection.beginTransaction();

    const [[seccion]] = await connection.query(`SELECT periodo_lectivo FROM seccion WHERE id_seccion = ? LIMIT 1 FOR UPDATE`, [idSeccion]);
    if (!seccion) { const error = new Error('No se encontró la sección.'); error.statusCode = 404; throw error; }
    await validarPeriodoNoCerrado(connection, Number(seccion.periodo_lectivo));

    const [ocupaciones] = await connection.query(
      `SELECT g.id_grupo, g.nombre_grupo
       FROM grupo g
       WHERE g.id_seccion = ? AND g.estado = TRUE
       LIMIT 1 FOR UPDATE`,
      [idSeccion]
    );
    if (ocupaciones.length) {
      const error = new Error(`La sección está ocupada por ${ocupaciones[0].nombre_grupo || 'un grupo activo'} y no puede eliminarse.`);
      error.statusCode = 409;
      throw error;
    }

    const [result] = await connection.query(
      `UPDATE seccion SET estado = FALSE WHERE id_seccion = ? AND estado = TRUE`,
      [idSeccion]
    );
    if ((result?.affectedRows ?? 0) === 0) {
      const error = new Error('No se encontró la sección o ya estaba inactiva.');
      error.statusCode = 404;
      throw error;
    }

    await connection.commit();
    return { id_seccion: idSeccion, estado: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

