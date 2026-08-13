import express from "express";
import { obtenerReporteCaso, obtenerReporteResumen, obtenerReporteDetalle } from "../controllers/reporteController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { reporteRules } from "../validators/reporteValidator.js";
import { validarCampos } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.get(
    "/reportes/caso",
    requireAuth,
    requireRole("Administrador", "Asistente", "Profesor"),
    reporteRules,
    validarCampos,
    obtenerReporteCaso
);

router.get(
    "/reportes/resumen",
    requireAuth,
    requireRole("Administrador", "Asistente", "Profesor"),
    reporteRules,
    validarCampos,
    obtenerReporteResumen
);

router.get(
    "/reportes/detalle",
    requireAuth,
    requireRole("Administrador", "Asistente", "Profesor"),
    reporteRules,
    validarCampos,
    obtenerReporteDetalle
);

export default router;
