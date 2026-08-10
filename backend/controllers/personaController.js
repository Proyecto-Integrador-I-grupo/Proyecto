import * as personaModel from "../models/personaModel.js";
import * as auditoriaModel from "../models/auditoriaModel.js";

// Obtener todas las personas
export const listarPersonas = async (req, res) => {
    try {
        const personas = await personaModel.obtenerPersonas();
        res.status(200).json(personas);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al obtener las personas."
        });
    }
};

// Obtener una persona por ID
export const obtenerPersona = async (req, res) => {
    try {
        const { id } = req.params;
        const persona = await personaModel.obtenerPersonaPorId(id);

        if (!persona) {
            return res.status(404).json({
                mensaje: "Persona no encontrada."
            });
        }

        res.status(200).json(persona);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al buscar la persona."
        });
    }
};

// Registrar una persona
export const registrarPersona = async (req, res) => {
    try {
        const idUsuario = req.usuarioActual?.id_usuario ?? null;
        const resultado = await personaModel.crearPersona(req.body, idUsuario);

        // Registrar auditoría
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "persona",
                accion_usuario: "INSERT",
                datos_anteriores: "",
                datos_nuevos: JSON.stringify(req.body)
            }, idUsuario);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

        res.status(201).json({
            mensaje: "Persona registrada correctamente.",
            id: resultado.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al registrar la persona."
        });
    }
};

// Actualizar una persona
export const actualizarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        const idUsuario = req.usuarioActual?.id_usuario ?? null;
        const personaExiste = await personaModel.obtenerPersonaPorId(id);

        if (!personaExiste) {
            return res.status(404).json({
                mensaje: "Persona no encontrada."
            });
        }

        const resultado = await personaModel.actualizarPersona(id, req.body, idUsuario);

        // Registrar auditoría
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "persona",
                accion_usuario: "UPDATE",
                datos_anteriores: JSON.stringify(personaExiste),
                datos_nuevos: JSON.stringify(req.body)
            }, idUsuario);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

        res.status(200).json({
            mensaje: "Persona actualizada correctamente.",
            cambios: resultado.changedRows ?? 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al actualizar la persona."
        });
    }
};

// Eliminar una persona (borrado lógico)
export const eliminarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        const idUsuario = req.usuarioActual?.id_usuario ?? null;

        const personaExiste = await personaModel.obtenerPersonaPorId(id);
        if (!personaExiste) {
            return res.status(404).json({
                mensaje: "Persona no encontrada."
            });
        }

        const resultado = await personaModel.eliminarPersona(id, idUsuario);

        // Registrar auditoría del borrado lógico
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "persona",
                accion_usuario: "DELETE",
                datos_anteriores: JSON.stringify(personaExiste),
                datos_nuevos: JSON.stringify({ ...personaExiste, estado: 0 })
            }, idUsuario);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

        res.status(200).json({
            mensaje: "Persona eliminada correctamente."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al eliminar la persona."
        });
    }
};