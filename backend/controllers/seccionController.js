import * as seccionService from "../services/seccionService.js";

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
    res.status(201).json(nuevaSeccion);
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR SECCIÓN:", error);
    res.status(500).json({ error: error.message || "Error al crear la sección." });
  }
};