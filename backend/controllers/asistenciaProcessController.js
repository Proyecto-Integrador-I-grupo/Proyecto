import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';
import { registrarAsistenciaProceso, listarAsistencias } from '../services/asistenciaServiceP.js';

// 1. Crear nuevo registro de asistencia
export async function crearAsistencia(req, res) {
  try {
    const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor } = req.body;

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

// 2. Obtener listado de asistencias con filtros (Filtrado por rol de profesor)
export async function obtenerAsistencias(req, res) {
  try {
    const usuario = req.usuarioActual;
    const rol = (usuario?.rol || "").toLowerCase();

    // Si es profesor, filtramos el historial exclusivamente para sus grupos asignados o suplencias activas
    if (rol === "profesor") {
      const idProfesor = usuario.id_profesor;
      if (!idProfesor) {
        return res.status(200).json([]);
      }

      const queryProfesorAsistencias = `
        SELECT DISTINCT a.* 
        FROM asistencia a
        JOIN grupo g ON a.id_grupo = g.id_grupo
        LEFT JOIN suplencia s ON s.id_grupo = g.id_grupo AND s.id_profesor_suplente = ? AND s.activo = 1
        WHERE g.id_profesor = ? OR s.id_profesor_suplente = ?
      `;
      const [filasProfesor] = await db.query(queryProfesorAsistencias, [idProfesor, idProfesor, idProfesor]);
      return res.status(200).json(filasProfesor);
    }

    // Si es administrador o asistente, se muestra todo el listado normalmente
    const filas = await listarAsistencias(req.query);
    return res.status(200).json(filas);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    return res.status(500).json({ mensaje: error.message });
  }
}

// 3. Actualizar asistencia
export async function actualizarAsistencia(req, res) {
  try {
    const { id } = req.params; 
    const { estado_asistencia, observaciones } = req.body;

    const [rowsAntes] = await db.query('SELECT * FROM asistencia WHERE id_asistencia = ?', [id]);
    if (rowsAntes.length === 0) {
      return res.status(404).json({ mensaje: 'Registro de asistencia no encontrado.' });
    }
    const datosAnteriores = JSON.stringify(rowsAntes[0]);

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