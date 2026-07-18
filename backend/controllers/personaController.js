import * as personaModel from "../models/personaModel.js";

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

        const resultado = await personaModel.crearPersona(req.body);

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

        const resultado = await personaModel.actualizarPersona(id, req.body);

        if (resultado.affectedRows === 0) {

            return res.status(404).json({

                mensaje: "Persona no encontrada."

            });

        }

        res.status(200).json({

            mensaje: "Persona actualizada correctamente."

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

        const resultado = await personaModel.eliminarPersona(id);

        if (resultado.affectedRows === 0) {

            return res.status(404).json({

                mensaje: "Persona no encontrada."

            });

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