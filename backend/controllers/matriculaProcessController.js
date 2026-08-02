import {
  procesarMatricula,
  obtenerGruposService,
  crearGrupoService,
  actualizarGrupoService,
  obtenerDetalleGrupoService
} from "../services/matriculaServiceP.js";
import * as auditoriaModel from "../models/auditoriaModel.js";

export async function crearMatricula(req, res) {
  try {
    const resultado = await procesarMatricula(req.body);
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "matricula",
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
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "grupo",
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

export async function actualizarGrupo(req, res) {
  try {
    const { id } = req.params;
    const resultado = await actualizarGrupoService(Number(id), req.body);
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "grupo",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify({ id_grupo: Number(id) }),
        datos_nuevos: JSON.stringify({ ...req.body, id_grupo: Number(id) })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json(resultado);
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