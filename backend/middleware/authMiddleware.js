import * as usuarioModel from "../models/usuarioModel.js";

// Se aplica globalmente. Si la petición trae el header "x-user-id",
// carga ese usuario (con su rol) y lo cuelga de req.usuarioActual.
// No bloquea nada por sí solo: eso lo hacen requireAuth / requireRole.
export const identificarUsuario = async (req, res, next) => {

    try {

        const idUsuario = req.headers["x-user-id"];

        if (!idUsuario) {
            req.usuarioActual = null;
            return next();
        }

        const usuario = await usuarioModel.obtenerUsuarioPorId(idUsuario);

        req.usuarioActual = usuario && usuario.estado ? usuario : null;

        next();

    } catch (error) {

        console.error(error);
        req.usuarioActual = null;
        next();

    }

};

// Corta la petición si no hay una sesión válida
export const requireAuth = (req, res, next) => {

    if (!req.usuarioActual) {

        return res.status(401).json({
            mensaje: "Debes iniciar sesión para realizar esta acción."
        });

    }

    next();

};

// Corta la petición si el rol del usuario no está en la lista permitida
export const requireRole = (...rolesPermitidos) => {

    const permitidosNormalizados = rolesPermitidos.map((r) => r.toLowerCase());

    return (req, res, next) => {

        if (!req.usuarioActual) {

            return res.status(401).json({
                mensaje: "Debes iniciar sesión para realizar esta acción."
            });

        }

        const rolActual = (req.usuarioActual.nom_rol || "").toLowerCase();

        if (!permitidosNormalizados.includes(rolActual)) {

            return res.status(403).json({
                mensaje: "No tienes permisos para realizar esta acción."
            });

        }

        next();

    };

};