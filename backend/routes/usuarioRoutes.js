import express from "express";
import {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
} from "../controllers/usuarioController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { validarCampos } from "../middleware/validationMiddleware.js";
import { usuarioCreateRules, usuarioUpdateRules, idParam } from "../validators/usuarioValidator.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("Administrador"), listarUsuarios);
router.get("/:id", requireAuth, requireRole("Administrador"), idParam, validarCampos, obtenerUsuario);
router.post("/", requireAuth, requireRole("Administrador"), usuarioCreateRules, validarCampos, crearUsuario);
router.put("/:id", requireAuth, requireRole("Administrador"), idParam, usuarioUpdateRules, validarCampos, actualizarUsuario);
router.patch("/:id", requireAuth, requireRole("Administrador"), idParam, usuarioUpdateRules, validarCampos, actualizarUsuario);
router.delete("/:id", requireAuth, requireRole("Administrador"), idParam, validarCampos, eliminarUsuario);

export default router;
