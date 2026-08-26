import * as profesorService from "../services/profesorService.js";
import * as auditoriaModel from "../models/auditoriaModel.js";

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
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "profesor",
        accion_usuario: "INSERT",
        datos_anteriores: "",
        datos_nuevos: JSON.stringify(nuevoProfesor)
      }, idUsuario);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.status(201).json(nuevoProfesor);
  } catch (error) {
    console.error("DETALLE DEL ERROR AL CREAR PROFESOR:", error);
    res.status(400).json({ error: error.message || "Error al registrar el profesor." });
  }
};


export const actualizarProfesor = async (req, res) => {
  try {
    const anterior = { id_profesor: req.params.id };
    const resultado = await profesorService.actualizarProfesorService(req.params.id, req.body);
    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "profesor",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify(anterior),
        datos_nuevos: JSON.stringify(resultado)
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }
    res.json({ message: "Profesor actualizado correctamente", profesor: resultado });
  } catch (error) {
    console.error("Error en actualizarProfesor:", error);
    res.status(400).json({ error: error.message || "Error al actualizar el profesor." });
  }
};

export const destituirProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, fecha_inicio, fecha_fin } = req.body;
    const resultado = await profesorService.destituirProfesorService(id, motivo, fecha_inicio, fecha_fin);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "profesor",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify({ id_profesor: id, estado: true }),
        datos_nuevos: JSON.stringify({ id_profesor: id, estado: false, motivo, accion: "destituir", ...resultado })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Profesor destituido correctamente", resultado });
  } catch (error) {
    console.error("Error en destituirProfesor:", error);
    res.status(400).json({ error: error.message || "Error al destituir al profesor." });
  }
};

export const reintegrarProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await profesorService.reintegrarProfesorService(id);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "profesor",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify({ id_profesor: id, estado: false }),
        datos_nuevos: JSON.stringify({ id_profesor: id, estado: true, accion: "reintegrar", ...resultado })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Profesor reintegrado correctamente", resultado });
  } catch (error) {
    console.error("Error en reintegrarProfesor:", error);
    res.status(400).json({ error: error.message || "Error al reintegrar al profesor." });
  }
};

export const eliminarProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await profesorService.eliminarProfesorService(id);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "profesor",
        accion_usuario: "DELETE",
        datos_anteriores: JSON.stringify({ id_profesor: id }),
        datos_nuevos: ""
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

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

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "grupo_profesor",
        accion_usuario: "UPDATE",
        datos_anteriores: JSON.stringify({ id_grupo: grupoId, id_profesor_anterior: profesorAnteriorId ?? null }),
        datos_nuevos: JSON.stringify({ id_grupo: grupoId, id_profesor_nuevo: profesorId, ...resultado })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Grupo reasignado exitosamente", resultado });
  } catch (error) {
    console.error("Error en reasignarGrupo:", error);
    res.status(400).json({ error: error.message || "Error al reasignar el grupo." });
  }
};

export const asignarGruposProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const { grupos } = req.body;

    const resultado = await profesorService.asignarGruposProfesorService(id, grupos);

    try {
      await auditoriaModel.crearAuditoria({
        nombre_tabla: "grupo_profesor",
        accion_usuario: "UPDATE",
        datos_anteriores: "",
        datos_nuevos: JSON.stringify({ id_profesor: id, grupos, ...resultado })
      }, req.usuarioActual?.id_usuario ?? null);
    } catch (e) {
      console.error("Error registrando auditoría:", e);
    }

    res.json({ message: "Grupos asignados correctamente al profesor", resultado });
  } catch (error) {
    console.error("Error en asignarGruposProfesor:", error);
    res.status(400).json({ error: error.message || "Error al asignar grupos al profesor." });
  }
};

export const getSuplenciasPendientes = async (req, res) => {
  try {
    const suplencias = await profesorService.obtenerSuplenciasPendientesService();
    res.json(suplencias);
  } catch (error) {
    console.error("Error en getSuplenciasPendientes:", error);
    res.status(500).json({ error: "Error al obtener las coberturas pendientes." });
  }
};
export const getHorarios = async (req, res) => {
  try {
    const rol = String(req.usuarioActual?.nom_rol || '').trim().toLowerCase();
    if (!['administrador', 'profesor'].includes(rol)) {
      return res.status(403).json({ error: 'La consulta de horarios está disponible para administradores y profesores.' });
    }

    let idProfesor = null;
    if (rol === 'profesor') {
      idProfesor = Number(req.usuarioActual?.id_profesor || 0);
      if (!idProfesor) {
        return res.status(403).json({ error: 'Tu usuario no está vinculado a un registro de profesor.' });
      }
    }

    const datos = await profesorService.obtenerHorariosService({ idProfesor });
    return res.json({
      alcance: rol === 'administrador' ? 'institucional' : 'personal',
      id_profesor_actual: idProfesor,
      ...datos
    });
  } catch (error) {
    console.error('Error en getHorarios:', error);
    return res.status(500).json({ error: error.message || 'No se pudieron cargar los horarios.' });
  }
};

