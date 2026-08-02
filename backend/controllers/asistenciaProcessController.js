import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';

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