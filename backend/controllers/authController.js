import bcrypt from "bcryptjs";
import * as usuarioModel from "../models/usuarioModel.js";

export const login = async (req, res) => {

    try {

        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {

            return res.status(400).json({
                mensaje: "Correo y contraseña son obligatorios."
            });

        }

        const usuario = await usuarioModel.obtenerUsuarioPorCorreo(correo.trim().toLowerCase());

        if (!usuario || !usuario.estado) {

            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos."
            });

        }

        const rolNormalizado = usuario.nom_rol.trim().toLowerCase();

        if (!usuarioModel.ROLES_PERMITIDOS.includes(rolNormalizado)) {

            return res.status(403).json({
                mensaje: "Este rol no tiene acceso al panel administrativo."
            });

        }

        // Soporta contraseñas ya hasheadas con bcrypt ($2...) y, como respaldo,
        // contraseñas antiguas en texto plano que aún no se hayan migrado.
        const esHashBcrypt = usuario.contrasena.startsWith("$2");
        const coincide = esHashBcrypt
            ? await bcrypt.compare(contrasena, usuario.contrasena)
            : contrasena === usuario.contrasena;

        if (!coincide) {

            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos."
            });

        }

        res.status(200).json({

            mensaje: "Inicio de sesión correcto.",
            usuario: {
                id_usuario: usuario.id_usuario,
                correo: usuario.correo,
                rol: usuario.nom_rol,
                nombre: usuario.nombre,
                apellido1: usuario.apellido1,
                apellido2: usuario.apellido2
            }

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            mensaje: "Error al iniciar sesión."
        });

    }

};