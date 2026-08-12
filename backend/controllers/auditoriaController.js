import * as auditoriaModel from "../models/auditoriaModel.js";

// Listar auditorías
export const listarAuditorias = async (req, res) => {

    try {

        const auditorias = await auditoriaModel.obtenerAuditorias();

        res.status(200).json(auditorias);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al obtener las auditorías."
        });

    }

};


// Obtener una auditoría por ID
export const obtenerAuditoria = async (req, res) => {

    try {

        const { id } = req.params;

        const auditoria = await auditoriaModel.obtenerAuditoriaPorId(id);

        if (!auditoria) {

            return res.status(404).json({ mensaje: "Registro de auditoría no encontrado." });

        }

        res.status(200).json(auditoria);

    } catch (error) {

        console.error(error);

        res.status(500).json({ mensaje: "Error al buscar la auditoría." });

    }

};


// Registrar una auditoría
export const registrarAuditoria = async (req, res) => {

    try {

        const idUsuario = req.usuarioActual?.id_usuario ?? null;

        const resultado = await auditoriaModel.crearAuditoria(req.body, idUsuario);

        res.status(201).json({
            mensaje: "Auditoría registrada correctamente.",
            id: resultado.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({ mensaje: "Error al registrar la auditoría." });

    }

};
