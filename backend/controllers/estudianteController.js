import * as estudianteService from "../services/estudianteService.js";
import * as auditoriaModel from "../models/auditoriaModel.js";
import * as finanzaService from "../services/finanzaService.js";

export const getEstudiantes = async (req, res) => {
  try {
    const estudiantes = await estudianteService.obtenerEstudiantesService();
    res.json(estudiantes);
  } catch (error) {
    console.error("Error en getEstudiantes:", error);
    res.status(500).json({ error: "Error al obtener los estudiantes." });
  }
};

export const getEstudiantesMatriculados = async (req, res) => {
  try {
    const estudiantes =
      await estudianteService.obtenerEstudiantesMatriculadosService();

    res.status(200).json(estudiantes);
  } catch (error) {
    console.error(
      "Error en getEstudiantesMatriculados:",
      error
    );

    res.status(500).json({
      error:
        error.message ||
        "Error al obtener los estudiantes matriculados."
    });
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

    let cargoMatricula = null;
    try {
      cargoMatricula = await finanzaService.asegurarCargoMatriculaPreRegistro(
        nuevoEstudiante.id_estudiante,
        idUsuario
      );
    } catch (errorCargo) {
      console.error("No se pudo crear el cargo inicial de matrícula:", errorCargo);
    }

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "estudiante",
        accion_usuario: "INSERT",
        datos_anteriores: "",
        datos_nuevos: JSON.stringify(nuevoEstudiante)
      }, idUsuario);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.status(201).json({
      ...nuevoEstudiante,
      cargo_matricula: cargoMatricula
    });
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR ESTUDIANTE:", error);
    res.status(500).json({ error: error.message || "Error al registrar el estudiante." });
  }
};

export const updateEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = req.usuarioActual?.id_usuario ?? null;

    // obtener datos anteriores para auditoría
    const anterior = await estudianteService.obtenerEstudiantePorIdService(id);

    const resultado = await estudianteService.actualizarEstudianteService(id, req.body, idUsuario);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "estudiante",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify(anterior),
        datos_nuevos: JSON.stringify(req.body)
      }, idUsuario);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Estudiante actualizado correctamente", resultado });
  } catch (error) {
    console.error("Error en updateEstudiante:", error);
    res.status(400).json({ error: error.message || "Error al actualizar el estudiante." });
  }
};

export const deleteEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const anterior = await estudianteService.obtenerEstudiantePorIdService(id);

    const resultado = await estudianteService.eliminarEstudianteService(id);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "estudiante",
        accion_usuario: "DELETE",
        datos_anteriores: JSON.stringify(anterior),
        datos_nuevos: JSON.stringify({ ...anterior, estado: 0 })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Estudiante eliminado correctamente", resultado });
  } catch (error) {
    console.error("Error en deleteEstudiante:", error);
    res.status(400).json({ error: error.message || "Error al eliminar el estudiante." });
  }
};