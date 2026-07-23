import bcrypt from "bcryptjs";
import * as usuarioModel from "../models/usuarioModel.js";

export const listarUsuarios = async (req, res) => {
    try {
        const usuarios = await usuarioModel.obtenerUsuarios();
        res.status(200).json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener los usuarios." });
    }
};

export const obtenerUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await usuarioModel.obtenerUsuarioPorId(id);

        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        res.status(200).json(usuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al buscar el usuario." });
    }
};

export const crearUsuario = async (req, res) => {
    try {
        const { correo, contrasena, id_persona, id_rol, estado } = req.body;
        const existente = await usuarioModel.obtenerUsuarioPorCorreo(correo);

        if (existente) {
            return res.status(409).json({ mensaje: "Ya existe un usuario con ese correo." });
        }

        const hash = await bcrypt.hash(contrasena, 10);
        const resultado = await usuarioModel.crearUsuario({ correo, contrasena: hash, id_persona, id_rol, estado }, req.usuarioActual?.id_usuario ?? null);

        res.status(201).json({ mensaje: "Usuario creado correctamente.", id: resultado.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al crear el usuario." });
    }
};

export const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { correo, contrasena, id_persona, id_rol, estado } = req.body;
        const usuario = await usuarioModel.obtenerUsuarioPorId(id);

        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        if (correo && correo !== usuario.correo) {
            const existente = await usuarioModel.obtenerUsuarioPorCorreo(correo);
            if (existente && existente.id_usuario !== id) {
                return res.status(409).json({ mensaje: "Ya existe un usuario con ese correo." });
            }
        }

        const datosActualizados = {
            correo: correo ?? usuario.correo,
            contrasena: contrasena ? await bcrypt.hash(contrasena, 10) : usuario.contrasena,
            id_persona: id_persona ?? usuario.id_persona,
            id_rol: id_rol ?? usuario.id_rol,
            estado: typeof estado === "boolean" ? estado : usuario.estado
        };

        const resultado = await usuarioModel.actualizarUsuario(id, datosActualizados, req.usuarioActual?.id_usuario ?? null);

        res.status(200).json({ mensaje: "Usuario actualizado correctamente.", cambios: resultado.changedRows ?? 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al actualizar el usuario." });
    }
};

export const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await usuarioModel.obtenerUsuarioPorId(id);

        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        const resultado = await usuarioModel.eliminarUsuario(id, req.usuarioActual?.id_usuario ?? null);

        res.status(200).json({ mensaje: "Usuario eliminado correctamente." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al eliminar el usuario." });
    }
};
