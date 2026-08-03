import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';
import { registrarAsistenciaProceso, listarAsistencias } from '../services/asistenciaServiceP.js';

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

export async function obtenerAsistencias(req, res) {
  try {
    const usuario = req.usuarioActual;
    // FIX #1: el campo real del rol en el usuario autenticado (ver usuarioModel.js) es "nom_rol".
    const rol = (usuario?.nom_rol || "").toLowerCase();

    if (rol === "profesor") {
      const idProfesor = usuario.id_profesor;
      if (!idProfesor) {
        return res.status(200).json([]);
      }

      // FIX #2: la tabla se llama "profesor_suplencia" (no "suplencia") y su columna
      // de estado se llama "estado" (no "activo"). Con los nombres viejos, MySQL
      // tiraba "Table 'suplencia' doesn't exist" y por eso el historial nunca cargaba
      // para las cuentas de profesor.
      const queryProfesorAsistencias = `
        SELECT DISTINCT
            a.id_asistencia,
            a.fecha,
            a.estado_asistencia,
            a.observaciones,
            a.id_estudiante,
            a.id_grupo,
            a.id_profesor,
            pe.nombre        AS estudiante_nombre,
            pe.apellido1      AS estudiante_apellido1,
            pe.apellido2      AS estudiante_apellido2,
            g.nombre_grupo,
            pr.nombre         AS profesor_nombre,
            pr.apellido1      AS profesor_apellido1
        FROM asistencia a
        INNER JOIN estudiante e   ON a.id_estudiante = e.id_estudiante
        INNER JOIN persona pe     ON e.id_persona = pe.id_persona
        INNER JOIN grupo g        ON a.id_grupo = g.id_grupo
        INNER JOIN profesor prof  ON a.id_profesor = prof.id_profesor
        INNER JOIN persona pr     ON prof.id_persona = pr.id_persona
        LEFT JOIN profesor_suplencia s ON s.id_grupo = g.id_grupo AND s.id_profesor_suplente = ? AND s.estado = TRUE
        WHERE (g.id_profesor = ? OR s.id_profesor_suplente = ?) AND a.estado = TRUE
        ORDER BY a.fecha DESC, a.id_asistencia DESC
        LIMIT 500
      `;
      const [filasProfesor] = await db.query(queryProfesorAsistencias, [idProfesor, idProfesor, idProfesor]);
      return res.status(200).json(filasProfesor);
    }

    const filas = await listarAsistencias(req.query, usuario);
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