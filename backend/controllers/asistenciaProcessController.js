import { registrarAsistenciaProceso, listarAsistencias } from "../services/asistenciaServiceP.js";
import * as auditoriaModel from "../models/auditoriaModel.js";
import db from "../config/database.js";

export async function crearAsistencia(req, res) {
  try {
    const resultado = await registrarAsistenciaProceso(req.body);
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "asistencia",
        accion_usuario: "INSERT",
        datos_anteriores: "",
        datos_nuevos: JSON.stringify(req.body)
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export async function obtenerAsistencias(req, res) {
  try {
    const resultado = await listarAsistencias(req.query);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export async function actualizarAsistencia(req, res) {
  try {
    const { id } = req.params;
    const { estado_asistencia, observaciones } = req.body;

    // Obtener los datos anteriores para la auditoría
    const [rowsAntes] = await db.query('SELECT * FROM asistencia WHERE id_asistencia = ?', [id]);
    if (rowsAntes.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }
    const datosAnteriores = JSON.stringify(rowsAntes[0]);

    // Actualizar el registro en la base de datos
    const query = 'UPDATE asistencia SET estado_asistencia = ?, observaciones = ? WHERE id_asistencia = ?';
    const [result] = await db.query(query, [estado_asistencia, observaciones || null, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se pudo actualizar el registro de asistencia.' });
    }

    const datosNuevos = JSON.stringify({ id_asistencia: id, estado_asistencia, observaciones });

    // Registrar en auditoría la modificación
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

    res.status(200).json({ mensaje: 'Asistencia actualizada correctamente' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export default crearAsistencia;