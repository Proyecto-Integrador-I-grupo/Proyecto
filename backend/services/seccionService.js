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
  const [rows] = await conexionPromise.query(`
    SELECT id_seccion, nombre_seccion AS nombre, nivel, periodo_lectivo AS anio_lectivo, descripcion, estado 
    FROM seccion 
    WHERE estado = TRUE
  `);
  return rows;
};