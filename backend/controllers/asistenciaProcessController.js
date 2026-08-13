import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';
import { registrarAsistenciaProceso, listarAsistencias, eliminarAsistenciaProceso } from '../services/asistenciaServiceP.js';

export async function crearAsistencia(req, res) {
  try {
    const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor } = req.body;

    const rol = String(req.usuarioActual?.nom_rol || "").toLowerCase();
    if (rol === "profesor" && Number(req.usuarioActual?.id_profesor) !== Number(id_profesor)) {
      return res.status(403).json({ mensaje: "Un profesor solo puede registrar asistencia bajo su propio usuario." });
    }

    const resultado = await registrarAsistenciaProceso({
      fecha,
      estado_asistencia,
      observaciones,
      id_estudiante,
      id_grupo,
      id_profesor
    });

    const datosNuevos = JSON.stringify({ fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor });

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

    return res.status(201).json(resultado);
  } catch (error) {
    console.error("Error al crear asistencia:", error);
    return res.status(400).json({ mensaje: error.message });
  }
}

export async function obtenerAsistencias(req, res) {
  try {
    const filas = await listarAsistencias(req.query, req.usuarioActual);
    return res.status(200).json(filas);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    return res.status(500).json({ mensaje: error.message });
  }
}

export async function actualizarAsistencia(req, res) {
  try {
    const { id } = req.params; 
    const { estado_asistencia, observaciones } = req.body;

    const [rowsAntes] = await db.query('SELECT * FROM asistencia WHERE id_asistencia = ?', [id]);
    if (rowsAntes.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }
    const datosAnteriores = JSON.stringify(rowsAntes[0]);

    const rol = String(req.usuarioActual?.nom_rol || "").toLowerCase();
    if (rol === "profesor" && Number(rowsAntes[0].id_profesor) !== Number(req.usuarioActual?.id_profesor)) {
      return res.status(403).json({ mensaje: "Solo puedes modificar asistencias registradas por tu usuario." });
    }

    const query = 'UPDATE asistencia SET estado_asistencia = ?, observaciones = ? WHERE id_asistencia = ?';
    const [result] = await db.query(query, [estado_asistencia, observaciones || null, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'No se pudo actualizar el registro de asistencia.' });
    }

    const datosNuevos = JSON.stringify({ id_asistencia: id, estado_asistencia, observaciones });

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


export async function eliminarAsistencia(req, res) {
  try {
    const { id } = req.params;

    const resultado = await eliminarAsistenciaProceso(id, req.usuarioActual);
    const datosAnteriores = JSON.stringify(resultado.registro || null);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "asistencia",
        accion_usuario: "DELETE",
        datos_anteriores: datosAnteriores,
        datos_nuevos: null
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría de eliminación:", e);
    }

    return res.status(200).json({ mensaje: resultado.mensaje });
  } catch (error) {
    console.error("Error al eliminar asistencia:", error);
    const status = String(error.message || "").includes("Solo un administrador") ? 403 : 400;
    return res.status(status).json({ mensaje: error.message });
  }
}

/**
 * NUEVO: Devuelve la lista de materias distintas registradas en la tabla profesor,
 * usada para poblar el filtro "Materia/Curso" del historial de asistencia.
 */
export async function obtenerMateriasDisponibles(req, res) {
  try {
    const [filas] = await db.query(
      `SELECT DISTINCT materia FROM profesor WHERE estado = TRUE AND materia IS NOT NULL AND materia <> '' ORDER BY materia`
    );
    return res.status(200).json(filas.map((f) => f.materia));
  } catch (error) {
    console.error("Error al obtener materias:", error);
    return res.status(500).json({ mensaje: error.message });
  }
}