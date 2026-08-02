import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';

// 1. Crear nuevo registro de asistencia
export async function crearAsistencia(req, res) {
  try {
    const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor } = req.body;

    const query = `
      INSERT INTO asistencia (fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [fecha, estado_asistencia, observaciones || null, id_estudiante, id_grupo, id_profesor]);

    const datosNuevos = JSON.stringify({ id_asistencia: result.insertId, fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor });

    // Registrar en auditoría de forma segura
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "asistencia",
        accion_usuario: "INSERT",
        datos_anteriores: null,
        datos_nuevos: datosNuevos
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría de inserción:", e);
    }

    return res.status(201).json({ mensaje: 'Asistencia creada correctamente', id_asistencia: result.insertId });
  } catch (error) {
    console.error("Error al crear asistencia:", error);
    return res.status(400).json({ mensaje: error.message });
  }
}

// 2. Obtener listado de asistencias con filtros
export async function obtenerAsistencias(req, res) {
  try {
    const { id_grupo, id_estudiante, id_profesor, estado_asistencia, fecha_inicio, fecha_fin, busqueda } = req.query;
    
    let query = `
      SELECT a.*, 
             CONCAT(e.nombre, ' ', e.apellido) AS estudiante_nombre,
             CONCAT(p.nombre, ' ', p.apellido) AS profesor_nombre,
             g.nombre_grupo
      FROM asistencia a
      LEFT JOIN estudiantes e ON a.id_estudiante = e.id_estudiante
      LEFT JOIN profesores p ON a.id_profesor = p.id_profesor
      LEFT JOIN grupos g ON a.id_grupo = g.id_grupo
      WHERE 1=1
    `;
    const params = [];

    if (id_grupo) {
      query += ` AND a.id_grupo = ?`;
      params.push(id_grupo);
    }
    if (id_estudiante) {
      query += ` AND a.id_estudiante = ?`;
      params.push(id_estudiante);
    }
    if (id_profesor) {
      query += ` AND a.id_profesor = ?`;
      params.push(id_profesor);
    }
    if (estado_asistencia) {
      query += ` AND a.estado_asistencia = ?`;
      params.push(estado_asistencia);
    }
    if (fecha_inicio && fecha_fin) {
      query += ` AND a.fecha BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    query += ` ORDER BY a.fecha DESC`;

    const [rows] = await db.query(query, params);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    return res.status(500).json({ mensaje: error.message });
  }
}

// 3. Actualizar asistencia
export async function actualizarAsistencia(req, res) {
  try {
    const { id } = req.params; // Corresponde al id_asistencia de la ruta
    const { estado_asistencia, observaciones } = req.body;

    // 1. Verificar existencia del registro usando 'id_asistencia'
    const [rowsAntes] = await db.query('SELECT * FROM asistencia WHERE id_asistencia = ?', [id]);
    if (rowsAntes.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }
    const datosAnteriores = JSON.stringify(rowsAntes[0]);

    // 2. Ejecutar la actualización con la columna correcta 'estado_asistencia'
    const query = 'UPDATE asistencia SET estado_asistencia = ?, observaciones = ? WHERE id_asistencia = ?';
    const [result] = await db.query(query, [estado_asistencia, observaciones || null, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se pudo actualizar el registro de asistencia.' });
    }

    const datosNuevos = JSON.stringify({ id_asistencia: id, estado_asistencia, observaciones });

    // 3. Registrar en auditoría de forma segura
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "asistencia",
        accion_usuario: "UPDATE",
        datos_anteriores: datosAnteriores,
        datos_nuevos: datosNuevos
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría de actualización:", e);
    }

    return res.status(200).json({ mensaje: 'Asistencia actualizada correctamente' });
  } catch (error) {
    console.error("Error al actualizar asistencia:", error);
    return res.status(400).json({ mensaje: error.message });
  }
}