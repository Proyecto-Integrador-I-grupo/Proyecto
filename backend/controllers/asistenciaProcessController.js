import { registrarAsistenciaProceso, listarAsistencias } from "../services/asistenciaServiceP.js";

export async function crearAsistencia(req, res) {
  try {
    const resultado = await registrarAsistenciaProceso(req.body);
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