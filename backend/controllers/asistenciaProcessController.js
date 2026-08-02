import db from '../config/database.js';
import * as auditoriaModel from '../models/auditoriaModel.js';
import { registrarAsistenciaProceso, listarAsistencias } from '../services/asistenciaServiceP.js';

// 1. Crear nuevo registro de asistencia
// Antes este controlador hacía un INSERT directo a la tabla `asistencia`
// sin pasar por ninguna validación. Ahora delega en registrarAsistenciaProceso()
// (asistenciaServiceP.js), que valida: profesor asignado activamente al grupo,
// estudiante activo en el grupo, y que no exista ya un registro duplicado para
// ese estudiante/grupo/fecha. Esto evita que se guarden combinaciones
// profesor-grupo o estudiante-grupo que no corresponden.
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

    return res.status(201).json(resultado);
  } catch (error) {
    console.error("Error al crear asistencia:", error);
    return res.status(400).json({ mensaje: error.message });
  }
}

// 2. Obtener listado de asistencias con filtros
// Antes este controlador consultaba tablas `estudiantes`, `profesores` y
// `grupos` (en plural) que no existen en el esquema real (el esquema usa
// `estudiante`, `profesor`, `grupo` + `persona`, tal como en
// asistenciaServiceP.js). Eso causaba el error 500 al cargar el historial.
// Ahora delega en listarAsistencias(), que ya usa los nombres correctos.
export async function obtenerAsistencias(req, res) {
  try {
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