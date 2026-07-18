import { registrarAsistenciaProceso } from "../services/asistenciaServiceP.js";

export async function crearAsistencia(req, res) {
  try {
    const resultado = await registrarAsistenciaProceso(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export default crearAsistencia;