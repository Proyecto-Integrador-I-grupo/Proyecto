import * as estudianteService from "../services/estudianteService.js";

export const getEstudiantes = async (req, res) => {
  try {
    const estudiantes = await estudianteService.obtenerEstudiantesService();
    res.json(estudiantes);
  } catch (error) {
    console.error("Error en getEstudiantes:", error);
    res.status(500).json({ error: "Error al obtener los estudiantes." });
  }
};

export const getEstudiantePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const estudiante = await estudianteService.obtenerEstudiantePorIdService(id);

    if (!estudiante) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    res.json(estudiante);
  } catch (error) {
    console.error("Error en getEstudiantePorId:", error);
    res.status(500).json({ error: "Error al buscar el estudiante." });
  }
};

export const createEstudiante = async (req, res) => {
  try {
    const idUsuario = req.usuarioActual?.id_usuario ?? null;

    const nuevoEstudiante = await estudianteService.crearEstudianteService(req.body, idUsuario);
    res.status(201).json(nuevoEstudiante);
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR ESTUDIANTE:", error);
    res.status(500).json({ error: error.message || "Error al registrar el estudiante." });
  }
};

export const updateEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = req.usuarioActual?.id_usuario ?? null;

    const resultado = await estudianteService.actualizarEstudianteService(id, req.body, idUsuario);
    res.json({ message: "Estudiante actualizado correctamente", resultado });
  } catch (error) {
    console.error("Error en updateEstudiante:", error);
    res.status(400).json({ error: error.message || "Error al actualizar el estudiante." });
  }
};

export const deleteEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await estudianteService.eliminarEstudianteService(id);
    res.json({ message: "Estudiante eliminado correctamente", resultado });
  } catch (error) {
    console.error("Error en deleteEstudiante:", error);
    res.status(400).json({ error: error.message || "Error al eliminar el estudiante." });
  }
};