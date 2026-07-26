import {
  procesarMatricula,
  obtenerGruposService,
  crearGrupoService,
  obtenerDetalleGrupoService
} from "../services/matriculaServiceP.js";

export async function crearMatricula(req, res) {
  try {
    const resultado = await procesarMatricula(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export async function obtenerGrupos(req, res) {
  try {
    const grupos = await obtenerGruposService();
    res.json(grupos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
}

export async function crearGrupo(req, res) {
  try {
    const resultado = await crearGrupoService(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
}

export async function obtenerDetalleGrupo(req, res) {
  try {
    const { id } = req.params;
    const detalle = await obtenerDetalleGrupoService(id);
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
}

export default crearMatricula;