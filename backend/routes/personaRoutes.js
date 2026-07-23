import express from "express";

import {
    listarPersonas,
    obtenerPersona,
    registrarPersona,
    actualizarPersona,
    eliminarPersona
} from "../controllers/personaController.js";

import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { personaRules, idPersonaParam } from "../validators/personaValidator.js";
import { validarCampos } from "../middleware/validationMiddleware.js";

const router = express.Router();

// Obtener todas las personas (cualquier usuario logueado)
router.get("/", requireAuth, listarPersonas);

// Obtener una persona por ID
router.get("/:id", requireAuth, idPersonaParam, validarCampos, obtenerPersona);

// Registrar una nueva persona (administrador o asistente)
router.post("/", requireAuth, requireRole("Administrador", "Asistente"), personaRules, validarCampos, registrarPersona);

// Actualizar una persona (administrador o asistente)
router.put("/:id", requireAuth, requireRole("Administrador", "Asistente"), idPersonaParam, personaRules, validarCampos, actualizarPersona);
router.patch("/:id", requireAuth, requireRole("Administrador", "Asistente"), idPersonaParam, personaRules, validarCampos, actualizarPersona);
router.post("/:id", requireAuth, requireRole("Administrador", "Asistente"), idPersonaParam, personaRules, validarCampos, actualizarPersona);

// Eliminar una persona (solo administrador)
router.delete("/:id", requireAuth, requireRole("Administrador"), idPersonaParam, validarCampos, eliminarPersona);

export default router;