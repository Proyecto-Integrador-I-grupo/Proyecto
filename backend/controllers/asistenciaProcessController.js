import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';
import { registrarAsistenciaProceso, listarAsistencias } from '../services/asistenciaServiceP.js';

export async function crearAsistencia(req, res) {
  try {
    const { fecha, estado_asistencia, observaciones, id_estudiante, id_grupo } = req.body;
    const rol = (req.usuarioActual?.nom_rol || "").toLowerCase();

    // Un profesor nunca puede registrar asistencia en nombre de otro profesor.
    const idProfesor = rol === "profesor"
      ? Number(req.usuarioActual?.id_profesor)
      : Number(req.body.id_profesor);

    if (!idProfesor) {
      return res.status(400).json({ mensaje: "No se pudo determinar el profesor que registra la asistencia." });
    }

    if (rol === "profesor" && Number(req.body.id_profesor) && Number(req.body.id_profesor) !== idProfesor) {
      return res.status(403).json({ mensaje: "No puedes registrar asistencia en nombre de otro profesor." });
    }

    const resultado = await registrarAsistenciaProceso({
      fecha,
      estado_asistencia,
      observaciones,
      id_estudiante,
      id_grupo,
      id_profesor: idProfesor
    });

    const datosNuevos = JSON.stringify({ fecha, estado_asistencia, observaciones, id_estudiante, id_grupo, id_profesor: idProfesor });

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
    const rol = (usuario?.nom_rol || "").toLowerCase();

    if (rol === "profesor") {
      const idProfesor = usuario.id_profesor;
      if (!idProfesor) {
        return res.status(200).json([]);
      }

      // CORRECCIÓN: Filtrar directamente por el id_profesor registrado en la asistencia (a.id_profesor)
      // para que cada docente vea ÚNICAMENTE las asistencias tomadas en sus respectivas materias.
      // NUEVO: se incluye prof.materia AS materia_curso para mostrar el curso/materia en la tabla.
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
            pr.apellido1      AS profesor_apellido1,
            prof.materia      AS materia_curso
        FROM asistencia a
        INNER JOIN estudiante e   ON a.id_estudiante = e.id_estudiante
        INNER JOIN persona pe     ON e.id_persona = pe.id_persona
        INNER JOIN grupo g        ON a.id_grupo = g.id_grupo
        INNER JOIN profesor prof  ON a.id_profesor = prof.id_profesor
        INNER JOIN persona pr     ON prof.id_persona = pr.id_persona
        WHERE a.id_profesor = ? AND a.estado = TRUE
        ORDER BY a.fecha DESC, a.id_asistencia DESC
        LIMIT 500
      `;
      const [filasProfesor] = await db.query(queryProfesorAsistencias, [idProfesor]);
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

    const rol = (req.usuarioActual?.nom_rol || "").toLowerCase();
    const esProfesor = rol === "profesor";
    const idProfesor = Number(req.usuarioActual?.id_profesor);

    if (esProfesor && !idProfesor) {
      return res.status(403).json({ mensaje: "Tu usuario no tiene un profesor asociado." });
    }

    const query = esProfesor
      ? 'UPDATE asistencia SET estado_asistencia = ?, observaciones = ? WHERE id_asistencia = ? AND id_profesor = ? AND estado = TRUE'
      : 'UPDATE asistencia SET estado_asistencia = ?, observaciones = ? WHERE id_asistencia = ? AND estado = TRUE';

    const params = esProfesor
      ? [estado_asistencia, observaciones || null, id, idProfesor]
      : [estado_asistencia, observaciones || null, id];

    const [result] = await db.query(query, params);

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