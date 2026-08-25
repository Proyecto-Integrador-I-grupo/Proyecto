import * as usuarioModel from "../models/usuarioModel.js";
import { verificarSessionToken } from "../utils/sessionToken.js";

export const identificarUsuario = async (req, res, next) => {
  try {
    const authorization = String(req.headers.authorization || "");
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const tokenData = bearer ? verificarSessionToken(bearer) : null;

    let idUsuario = tokenData?.sub || null;
    const allowLegacy = String(process.env.ALLOW_LEGACY_USER_HEADER || "").toLowerCase() === "true";
    if (!idUsuario && allowLegacy) idUsuario = req.headers["x-user-id"] || null;

    if (!idUsuario) {
      req.usuarioActual = null;
      return next();
    }

    const usuario = await usuarioModel.obtenerUsuarioPorId(idUsuario);
    req.usuarioActual = usuario && usuario.estado ? usuario : null;
    return next();
  } catch (error) {
    console.error("Error identificando usuario:", error);
    req.usuarioActual = null;
    return next();
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.usuarioActual) {
    return res.status(401).json({ mensaje: "Debes iniciar sesión para realizar esta acción." });
  }
  return next();
};

export const requireRole = (...rolesPermitidos) => {
  const permitidosNormalizados = rolesPermitidos.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.usuarioActual) {
      return res.status(401).json({ mensaje: "Debes iniciar sesión para realizar esta acción." });
    }
    const rolActual = (req.usuarioActual.nom_rol || "").toLowerCase();
    if (!permitidosNormalizados.includes(rolActual)) {
      return res.status(403).json({ mensaje: "No tienes permisos para realizar esta acción con el rol asignado." });
    }
    return next();
  };
};


export const requirePermission = (codigo) => {
  return async (req, res, next) => {
    try {
      if (!req.usuarioActual) return res.status(401).json({ mensaje: "Debes iniciar sesión para realizar esta acción." });
      const rol = String(req.usuarioActual.nom_rol || '').toLowerCase();
      if (rol === 'administrador') return next();

      const usuarioModel = await import('../models/usuarioModel.js');
      const permitido = await usuarioModel.usuarioTienePermiso(req.usuarioActual.id_usuario, codigo);
      if (!permitido) {
        return res.status(403).json({ mensaje: "No tienes permiso para realizar esta acción." });
      }
      return next();
    } catch (error) {
      console.error('Error validando permiso por acción:', error);
      return res.status(500).json({ mensaje: 'No se pudo validar el permiso de la operación.' });
    }
  };
};
