import pool from '../config/database.js';

function validarAnio(anio) {
  const n = Number(anio);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) {
    const e = new Error('El año lectivo no es válido.'); e.statusCode = 400; throw e;
  }
  return n;
}

export async function listarPeriodosService() {
  const [rows] = await pool.query(
    `SELECT anio, fecha_inicio, fecha_fin, estado, fecha_cierre
     FROM periodo_lectivo ORDER BY anio DESC`
  );
  return rows;
}

export async function actualizarPeriodoService(anio, datos, idUsuario) {
  const year = validarAnio(anio);
  const estado = String(datos?.estado || '').trim().toUpperCase();
  if (!['PLANIFICADO','ACTIVO','CERRADO'].includes(estado)) {
    const e = new Error('Estado de período no válido.'); e.statusCode = 400; throw e;
  }
  const inicio = String(datos?.fecha_inicio || '').slice(0,10);
  const fin = String(datos?.fecha_fin || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fin) || inicio > fin) {
    const e = new Error('Indica un rango de fechas válido para el período.'); e.statusCode = 400; throw e;
  }
  if (Number(inicio.slice(0,4)) !== year || Number(fin.slice(0,4)) !== year) {
    const e = new Error('Las fechas del período deben pertenecer al año lectivo seleccionado.'); e.statusCode = 400; throw e;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[actual]] = await connection.query(`SELECT * FROM periodo_lectivo WHERE anio = ? FOR UPDATE`, [year]);
    if (!actual) { const e = new Error('El período lectivo no existe.'); e.statusCode = 404; throw e; }

    if (String(actual.estado).toUpperCase() === 'CERRADO' && estado !== 'CERRADO') {
      const e = new Error('Un período cerrado no puede reabrirse desde la operación normal.'); e.statusCode = 409; throw e;
    }

    await connection.query(
      `UPDATE periodo_lectivo
       SET fecha_inicio = ?, fecha_fin = ?, estado = ?,
           fecha_cierre = CASE WHEN ? = 'CERRADO' THEN COALESCE(fecha_cierre, NOW()) ELSE NULL END,
           id_usuario_cierre = CASE WHEN ? = 'CERRADO' THEN ? ELSE NULL END
       WHERE anio = ?`,
      [inicio, fin, estado, estado, estado, idUsuario || null, year]
    );
    await connection.commit();
    return { anio: year, fecha_inicio: inicio, fecha_fin: fin, estado };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally { connection.release(); }
}
