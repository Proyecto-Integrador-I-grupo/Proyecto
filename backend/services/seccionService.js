import conexionPromise from "../config/database.js";

export const crearSeccionService = async (datos) => {
  const { nombre, anio_lectivo, nivel, descripcion } = datos;
  
  if (!nombre || !anio_lectivo || !nivel) {
    throw new Error("Faltan campos obligatorios para registrar la sección.");
  }

  const connection = await conexionPromise.getConnection();

  try {
    await connection.beginTransaction();

    const querySeccion = `
      INSERT INTO seccion (nombre_seccion, nivel, periodo_lectivo, descripcion, estado)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    
    const [resultado] = await connection.query(querySeccion, [
      nombre.trim(),
      nivel.trim(),
      anio_lectivo,
      descripcion ? descripcion.trim() : null
    ]);

    await connection.commit();

    return {
      id_seccion: resultado.insertId,
      nombre,
      nivel,
      anio_lectivo,
      descripcion,
      estado: 1
    };
  } catch (error) {
    await connection.rollback();
    throw new Error(error.message || "Error al registrar la sección en la base de datos.");
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
      ORDER BY periodo_lectivo DESC, nombre_seccion ASC
    `);

    const baseSeed = [];
    for (let nivel = 1; nivel <= 6; nivel += 1) {
      baseSeed.push({ nombre: `${nivel}-A`, nivel, anio_lectivo: new Date().getFullYear(), descripcion: `Sección base institucional ${nivel}-A` });
      baseSeed.push({ nombre: `${nivel}-B`, nivel, anio_lectivo: new Date().getFullYear(), descripcion: `Sección base institucional ${nivel}-B` });
    }

    const existingNames = new Set((existingRows || []).map((row) => String(row.nombre || '').trim().toLowerCase()));
    const baseToInsert = baseSeed.filter((item) => !existingNames.has(item.nombre.toLowerCase()));

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
      ORDER BY periodo_lectivo DESC, nombre_seccion ASC
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

    const [result] = await connection.query(
      `UPDATE seccion SET estado = FALSE WHERE id_seccion = ? AND estado = TRUE`,
      [idSeccion]
    );

    if ((result?.affectedRows ?? 0) === 0) {
      throw new Error("No se encontró la sección o ya estaba inactiva.");
    }

    await connection.commit();
    return { id_seccion: idSeccion, estado: false };
  } catch (error) {
    await connection.rollback();
    throw new Error(error.message || "Error al desactivar la sección.");
  } finally {
    connection.release();
  }
};