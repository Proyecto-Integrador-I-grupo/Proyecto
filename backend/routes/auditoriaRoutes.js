import express from "express";

import {
    listarAuditorias,
    obtenerAuditoria,
    registrarAuditoria
} from "../controllers/auditoriaController.js";

import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Obtener todas las auditorías (requiere autenticación)
router.get("/", requireAuth, requireRole("administrador"), listarAuditorias);

// Obtener una auditoría por ID
router.get("/:id", requireAuth, requireRole("administrador"), obtenerAuditoria);

// Registrar una auditoría (se puede usar internamente)
router.post("/", requireAuth, registrarAuditoria);

export default router;
