import { registrarAsistenciaProceso, listarAsistencias } from "../services/asistenciaServiceP.js";
import * as auditoriaModel from "../models/auditoriaModel.js";

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

export default crearAsistencia;