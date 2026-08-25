import bcrypt from "bcryptjs";
import * as usuarioModel from "../models/usuarioModel.js";
import { validarCorreoInstitucional } from "../utils/emailDomain.js";
import { crearSessionToken } from "../utils/sessionToken.js";
import { clearLoginAttempts } from "../middleware/loginRateLimit.js";
import { procesarSuplenciasVencidas } from "../services/profesorService.js";

export const login = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        // Si venció una incapacidad, restaurar al titular antes de validar su acceso.
        try { await procesarSuplenciasVencidas(); } catch (e) { console.warn('Suplencias: no se pudo procesar un vencimiento automático:', e.message); }

        if (!correo || !contrasena) {
            return res.status(400).json({
                mensaje: "Correo y contraseña son obligatorios."
            });
        }

        let correoInstitucional;
        try {
            correoInstitucional = validarCorreoInstitucional(correo);
        } catch (errorDominio) {
            return res.status(403).json({ mensaje: errorDominio.message });
        }

        const usuario = await usuarioModel.obtenerUsuarioPorCorreo(correoInstitucional);

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

        const esHashBcrypt = usuario.contrasena.startsWith("$2");
        const coincide = esHashBcrypt
            ? await bcrypt.compare(contrasena, usuario.contrasena)
            : contrasena === usuario.contrasena;

        if (!coincide) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos."
            });
        }

        const esAdmin = rolNormalizado === "administrador";
        const permisosAccion = await usuarioModel.obtenerPermisosUsuario(usuario.id_usuario);
        clearLoginAttempts(req);
        const token = crearSessionToken(usuario);

        res.status(200).json({
            mensaje: "Inicio de sesión correcto.",
            usuario: {
                id_usuario: usuario.id_usuario,
                id_profesor: usuario.id_profesor || null,
                correo: usuario.correo,
                rol: usuario.nom_rol,
                nombre: usuario.nombre,
                apellido1: usuario.apellido1,
                apellido2: usuario.apellido2,
                token,
                permisos_accion: Object.fromEntries(permisosAccion.map((p) => [p.codigo, Boolean(p.permitido)])),
                permisos: {
                    eliminarEstudiantes: esAdmin,
                    gestionarUsuarios: esAdmin,
                    modificarConfiguracion: esAdmin,
                    registrarMatricula: true,
                    registrarAsistencia: true,
                    verEstudiantes: true
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al iniciar sesión."
        });
    }
};