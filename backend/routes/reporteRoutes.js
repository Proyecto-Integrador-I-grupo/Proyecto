import express from "express";
import { obtenerReporteResumen, obtenerReporteDetalle } from "../controllers/reporteController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { reporteRules } from "../validators/reporteValidator.js";
import { validarCampos } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.get(
    "/reportes/resumen",
    requireAuth,
    requireRole("Administrador"),
    reporteRules,
    validarCampos,
    obtenerReporteResumen
);

router.get(
    "/reportes/detalle",
    requireAuth,
    requireRole("Administrador"),
    reporteRules,
    validarCampos,
    obtenerReporteDetalle
);

export default router;
