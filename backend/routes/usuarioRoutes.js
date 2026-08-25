import express from "express";

import {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    obtenerMiPerfil,
    actualizarMiPerfil,
    cambiarMiClave,
    obtenerPermisosAccionUsuario,
    actualizarPermisosAccionUsuario
} from "../controllers/usuarioController.js";

import {
    requireAuth,
    requireRole
} from "../middleware/authMiddleware.js";

import {
    validarCampos
} from "../middleware/validationMiddleware.js";

import {
    usuarioCreateRules,
    usuarioUpdateRules,
    idParam
} from "../validators/usuarioValidator.js";

const router = express.Router();

// Mi Perfil (Accesible por cualquier usuario autenticado)
router.get(
    "/perfil",
    requireAuth,
    obtenerMiPerfil
);

router.put(
    "/perfil",
    requireAuth,
    actualizarMiPerfil
);

router.put(
    "/perfil/clave",
    requireAuth,
    cambiarMiClave
);

// Administración de usuarios y Permisos (EXCLUSIVO ADMINISTRADOR)
router.get(
    "/",
    requireAuth,
    requireRole("Administrador"),
    listarUsuarios
);

router.get("/:id/permisos-accion", requireAuth, requireRole("Administrador"), obtenerPermisosAccionUsuario);
router.put("/:id/permisos-accion", requireAuth, requireRole("Administrador"), actualizarPermisosAccionUsuario);

router.get(
    "/:id",
    requireAuth,
    requireRole("Administrador"),
    idParam,
    validarCampos,
    obtenerUsuario
);

router.post(
    "/",
    requireAuth,
    requireRole("Administrador"),
    usuarioCreateRules,
    validarCampos,
    crearUsuario
);

router.put(
    "/:id",
    requireAuth,
    requireRole("Administrador"),
    idParam,
    usuarioUpdateRules,
    validarCampos,
    actualizarUsuario
);

router.patch(
    "/:id",
    requireAuth,
    requireRole("Administrador"),
    idParam,
    usuarioUpdateRules,
    validarCampos,
    actualizarUsuario
);

router.delete(
    "/:id",
    requireAuth,
    requireRole("Administrador"),
    idParam,
    validarCampos,
    eliminarUsuario
);

export default router;