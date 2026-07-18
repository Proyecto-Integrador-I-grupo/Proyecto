import express from "express";

import {
    listarPersonas,
    obtenerPersona,
    registrarPersona,
    actualizarPersona,
    eliminarPersona
} from "../controllers/personaController.js";

const router = express.Router();

// Obtener todas las personas
router.get("/", listarPersonas);

// Obtener una persona por ID
router.get("/:id", obtenerPersona);

// Registrar una nueva persona
router.post("/", registrarPersona);

// Actualizar una persona
router.put("/:id", actualizarPersona);

// Eliminar una persona (borrado lógico)
router.delete("/:id", eliminarPersona);

export default router;