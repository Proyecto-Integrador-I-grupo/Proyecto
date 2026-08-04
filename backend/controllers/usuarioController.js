import bcrypt from "bcryptjs";
import * as usuarioModel from "../models/usuarioModel.js";
import * as auditoriaModel from "../models/auditoriaModel.js";
import * as personaModel from "../models/personaModel.js";

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
        const { nombre, primer_apellido, apellido1, correo, contrasena, id_rol } = req.body;

        const existente = await usuarioModel.obtenerUsuarioPorCorreo(correo);
        if (existente) {
            return res.status(409).json({ mensaje: "Ya existe un usuario con ese correo." });
        }

        const apellidoFinal = primer_apellido || apellido1 || "";

        // 1. Insertar primero en la tabla 'persona' para generar el id_persona
        const resultadoPersona = await personaModel.registrarPersona({
            nombre: nombre,
            apellido1: apellidoFinal,
            apellido2: "",
            cedula: null,
            telefono: null,
            correo: correo,
            tipo_persona: id_rol == 1 ? "Administrador" : "Asistente"
        }, req.usuarioActual?.id_usuario ?? null);

        const idPersonaGenerada = resultadoPersona.insertId;

        // 2. Cifrar contraseña e insertar en la tabla 'usuario'
        const hash = await bcrypt.hash(contrasena, 10);
        const resultadoUsuario = await usuarioModel.crearUsuario({
            correo,
            contrasena: hash,
            id_persona: idPersonaGenerada,
            id_rol: id_rol || 2,
            estado: 1
        }, req.usuarioActual?.id_usuario ?? null);

        // Auditoría
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "usuario",
                accion_usuario: "INSERT",
                datos_anteriores: "",
                datos_nuevos: JSON.stringify({ correo, id_persona: idPersonaGenerada, id_rol, estado: 1 })
            }, req.usuarioActual?.id_usuario ?? null);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

        res.status(201).json({ mensaje: "Usuario creado correctamente.", id: resultadoUsuario.insertId });
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

        // Auditoría
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "usuario",
                accion_usuario: "UPDATE",
                datos_anteriores: JSON.stringify(usuario),
                datos_nuevos: JSON.stringify(datosActualizados)
            }, req.usuarioActual?.id_usuario ?? null);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

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

        // Auditoría de eliminación (borrado lógico)
        try {
            await auditoriaModel.crearAuditoria({
                nombre_tabla: "usuario",
                accion_usuario: "DELETE",
                datos_anteriores: JSON.stringify(usuario),
                datos_nuevos: JSON.stringify({ ...usuario, estado: 0 })
            }, req.usuarioActual?.id_usuario ?? null);
        } catch (e) {
            console.error("Error registrando auditoría:", e);
        }

        res.status(200).json({ mensaje: "Usuario eliminado correctamente." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al eliminar el usuario." });
    }
};

export const obtenerMiPerfil = async (req, res) => {
    try {
        const idUsuario = req.usuarioActual?.id_usuario;

        if (!idUsuario) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión para consultar tu perfil."
            });
        }

        const usuario =
            await usuarioModel.obtenerUsuarioPorId(idUsuario);

        if (!usuario) {
            return res.status(404).json({
                mensaje: "No se encontró la información del perfil."
            });
        }

        res.status(200).json({
            id_usuario: usuario.id_usuario,
            id_persona: usuario.id_persona,
            nombre: usuario.nombre,
            apellido1: usuario.apellido1,
            apellido2: usuario.apellido2,
            correo: usuario.correo,
            rol: usuario.nom_rol,
            id_profesor: usuario.id_profesor ?? null
        });
    } catch (error) {
        console.error("Error al obtener el perfil:", error);

        res.status(500).json({
            mensaje: "Error al obtener la información del perfil."
        });
    }
};

export const actualizarMiPerfil = async (req, res) => {
    try {
        const idUsuario = req.usuarioActual?.id_usuario;

        if (!idUsuario) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión para actualizar tu perfil."
            });
        }

        const {
            nombre,
            apellido1,
            apellido2,
            correo
        } = req.body;

        if (
            !nombre?.trim() ||
            !apellido1?.trim() ||
            !correo?.trim()
        ) {
            return res.status(400).json({
                mensaje:
                    "El nombre, el primer apellido y el correo son obligatorios."
            });
        }

        const usuarioActual =
            await usuarioModel.obtenerUsuarioPorId(idUsuario);

        if (!usuarioActual) {
            return res.status(404).json({
                mensaje: "Usuario no encontrado."
            });
        }

        if (correo.trim() !== usuarioActual.correo) {
            const existente =
                await usuarioModel.obtenerUsuarioPorCorreo(
                    correo.trim()
                );

            if (
                existente &&
                Number(existente.id_usuario) !== Number(idUsuario)
            ) {
                return res.status(409).json({
                    mensaje:
                        "Ya existe otro usuario con ese correo."
                });
            }
        }

        const datosNuevos = {
            nombre: nombre.trim(),
            apellido1: apellido1.trim(),
            apellido2: apellido2?.trim() || "",
            correo: correo.trim()
        };

        await usuarioModel.actualizarDatosPerfil(
            idUsuario,
            datosNuevos
        );

        try {
            await auditoriaModel.crearAuditoria(
                {
                    nombre_tabla: "usuario/persona",
                    accion_usuario: "UPDATE",
                    datos_anteriores: JSON.stringify({
                        nombre: usuarioActual.nombre,
                        apellido1: usuarioActual.apellido1,
                        apellido2: usuarioActual.apellido2,
                        correo: usuarioActual.correo
                    }),
                    datos_nuevos: JSON.stringify(datosNuevos)
                },
                idUsuario
            );
        } catch (errorAuditoria) {
            console.error(
                "Error registrando auditoría del perfil:",
                errorAuditoria
            );
        }

        const perfilActualizado =
            await usuarioModel.obtenerUsuarioPorId(idUsuario);

        res.status(200).json({
            mensaje: "Perfil actualizado correctamente.",
            perfil: {
                id_usuario: perfilActualizado.id_usuario,
                id_persona: perfilActualizado.id_persona,
                nombre: perfilActualizado.nombre,
                apellido1: perfilActualizado.apellido1,
                apellido2: perfilActualizado.apellido2,
                correo: perfilActualizado.correo,
                rol: perfilActualizado.nom_rol
            }
        });
    } catch (error) {
        console.error("Error al actualizar el perfil:", error);

        res.status(500).json({
            mensaje: "Error al actualizar el perfil."
        });
    }
};

export const cambiarMiClave = async (req, res) => {
    try {
        const idUsuario = req.usuarioActual?.id_usuario;

        if (!idUsuario) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión para cambiar tu clave."
            });
        }

        const {
            claveActual,
            claveNueva,
            claveConfirmar
        } = req.body;

        if (
            !claveActual ||
            !claveNueva ||
            !claveConfirmar
        ) {
            return res.status(400).json({
                mensaje:
                    "Debes completar todos los campos de seguridad."
            });
        }

        if (claveNueva !== claveConfirmar) {
            return res.status(400).json({
                mensaje:
                    "La nueva clave y la confirmación no coinciden."
            });
        }

        if (claveNueva.length < 8) {
            return res.status(400).json({
                mensaje:
                    "La nueva clave debe tener al menos 8 caracteres."
            });
        }

        const usuario =
            await usuarioModel.obtenerUsuarioPerfilPorId(
                idUsuario
            );

        if (!usuario) {
            return res.status(404).json({
                mensaje: "Usuario no encontrado."
            });
        }

        const claveValida = await bcrypt.compare(
            claveActual,
            usuario.contrasena
        );

        if (!claveValida) {
            return res.status(400).json({
                mensaje: "La clave actual no es correcta."
            });
        }

        const mismaClave = await bcrypt.compare(
            claveNueva,
            usuario.contrasena
        );

        if (mismaClave) {
            return res.status(400).json({
                mensaje:
                    "La nueva clave debe ser diferente de la actual."
            });
        }

        const nuevaClaveHash = await bcrypt.hash(
            claveNueva,
            10
        );

        await usuarioModel.actualizarContrasenaPerfil(
            idUsuario,
            nuevaClaveHash
        );

        try {
            await auditoriaModel.crearAuditoria(
                {
                    nombre_tabla: "usuario",
                    accion_usuario: "UPDATE",
                    datos_anteriores: JSON.stringify({
                        contrasena: "PROTEGIDA"
                    }),
                    datos_nuevos: JSON.stringify({
                        contrasena: "ACTUALIZADA"
                    })
                },
                idUsuario
            );
        } catch (errorAuditoria) {
            console.error(
                "Error registrando auditoría de contraseña:",
                errorAuditoria
            );
        }

        res.status(200).json({
            mensaje: "Clave actualizada correctamente."
        });
    } catch (error) {
        console.error("Error al cambiar la clave:", error);

        res.status(500).json({
            mensaje: "Error al cambiar la clave."
        });
    }
};