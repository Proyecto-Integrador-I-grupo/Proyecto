import * as seccionService from "../services/seccionService.js";
import * as auditoriaModel from "../models/auditoriaModel.js";

export const getSecciones = async (req, res) => {
  try {
    const secciones = await seccionService.obtenerSeccionesService();
    res.json(secciones);
  } catch (error) {
    console.error("Error en getSecciones:", error);
    res.status(500).json({ error: "Error al obtener las secciones." });
  }
};

export const createSeccion = async (req, res) => {
  try {
    const nuevaSeccion = await seccionService.crearSeccionService(req.body);
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "seccion",
        accion_usuario: "INSERT",
        datos_anteriores: "",
        datos_nuevos: JSON.stringify(nuevaSeccion)
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.status(201).json(nuevaSeccion);
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR SECCIÓN:", error);
    res.status(500).json({ error: error.message || "Error al crear la sección." });
  }
};

export const deleteSeccion = async (req, res) => {
  try {
    const { id } = req.params;
    const seccionBorrada = await seccionService.eliminarSeccionService(Number(id));

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "seccion",
        accion_usuario: "DELETE",
        datos_anteriores: JSON.stringify({ id_seccion: Number(id) }),
        datos_nuevos: JSON.stringify(seccionBorrada)
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ mensaje: "Sección borrada correctamente.", seccion: seccionBorrada });
  } catch (error) {
    console.error("Error al borrar sección:", error);
    res.status(500).json({ error: error.message || "Error al borrar la sección." });
  }
};