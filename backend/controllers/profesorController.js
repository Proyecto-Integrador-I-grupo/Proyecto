import * as profesorService from "../services/profesorService.js";

export const getProfesores = async (req, res) => {
  try {
    const profesores = await profesorService.obtenerProfesoresService();
    res.json(profesores);
  } catch (error) {
    console.error("Error en getProfesores:", error);
    res.status(500).json({ error: "Error al obtener los profesores." });
  }
};

export const createProfesor = async (req, res) => {
  try {
    const idUsuario = req.usuarioActual?.id_usuario ?? null;
    
    const nuevoProfesor = await profesorService.crearProfesorService(req.body, idUsuario);
    res.status(201).json(nuevoProfesor);
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR PROFESOR:", error);
    res.status(500).json({ error: error.message || "Error al registrar el profesor." });
  }
};

export const destituirProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const resultado = await profesorService.destituirProfesorService(id, motivo);
    res.json({ message: "Profesor destituido correctamente", resultado });
  } catch (error) {
    console.error("Error en destituirProfesor:", error);
    res.status(400).json({ error: error.message || "Error al destituir al profesor." });
  }
};

export const eliminarProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await profesorService.eliminarProfesorService(id);
    res.json({ message: "Profesor eliminado correctamente", resultado });
  } catch (error) {
    console.error("Error en eliminarProfesor:", error);
    res.status(400).json({ error: error.message || "Error al eliminar al profesor." });
  }
};

export const reasignarGrupo = async (req, res) => {
  try {
    const { profesorId, grupoId, profesorAnteriorId } = req.body;
    const resultado = await profesorService.reasignarGrupoProfesorService(grupoId, profesorId, profesorAnteriorId);
    res.json({ message: "Grupo reasignado exitosamente", resultado });
  } catch (error) {
    console.error("Error en reasignarGrupo:", error);
    res.status(500).json({ error: "Error al reasignar el grupo." });
  }
};