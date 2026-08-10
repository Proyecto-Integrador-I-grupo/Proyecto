import * as usuarioModel from "../models/usuarioModel.js";

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

export const requireAuth = (req, res, next) => {
    if (!req.usuarioActual) {
        return res.status(401).json({
            mensaje: "Debes iniciar sesión para realizar esta acción."
        });
    }
    next();
};

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
                mensaje: "No tienes permisos para realizar esta acción con el rol asignado."
            });
        }

        next();
    };
};